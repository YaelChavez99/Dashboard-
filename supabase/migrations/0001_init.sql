-- Finance & Operations Control — initial schema
--
-- Modeled directly from the audited source spreadsheet
-- "Automation Payments BA-MX Abril-Jun" (Google Sheets id
-- 1dOfBB8gcZsBR-GTPkYQcOdTbpbXH0MQk0FHuri6uRqY). See /docs/data-audit.md
-- for the raw column-by-column audit this schema is derived from.
--
-- Financial flow modeled explicitly, matching what the source already does
-- in its "Aclaracion de Pagos" sheet (ESTATUS ENVIO vs PAGADO EN MASTER):
--
--   orders (Data BA)  --generates-->  GENERADO
--   finance_submissions (Reporte de Pagos / "Master Pagos")  -->  ENVIADO_A_FINANZAS
--   payments (1st/2nd Payment)  -->  PAGADO
--
-- Master Pagos is NEVER treated as "paid" — its own MASTER_PAGOS column
-- (Aprobado / NO) only means "submitted for approval", not disbursed.

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER');

create type payment_flow_status as enum (
  'GENERADO',
  'ENVIADO_A_FINANZAS',
  'PAGADO',
  'PENDIENTE',
  'RECHAZADO',
  'EN_PROCESO'
);

create type reconciliation_status as enum (
  'CONCILIADO',
  'PENDIENTE',
  'DIFERENCIA',
  'DUPLICADO',
  'SIN_MATCH'
);

create type sync_status as enum ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- ============================================================
-- CORE REFERENCE TABLES
-- ============================================================

-- ZONA_CLASIFICACION in Data BA
create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Hoja "Configuración de Tiendas | Asignación de Modelo de Pago"
create table stores (
  id uuid primary key default gen_random_uuid(),
  store_number text not null unique,       -- STORE_NUMBER
  store_ext_id text not null unique,       -- STORE_ID (this is the id used to join Data BA / Master Pagos)
  name text not null,                      -- STORE_NAME
  zone_id uuid references zones (id),
  tariff_model text not null,              -- MODELO (M99 / M105 / M109 / M119 ...)
  charges_parking boolean not null default false, -- PAGO DE ESTACIONAMIENTO
  parking_amount numeric(12, 2),           -- MONTO ESTACIONAMIENTO
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stores_zone_id_idx on stores (zone_id);

-- Hoja "Usuarios | Dato de Usuarios Bodega Aurrera"
-- Natural key is the phone number: it's what Master Pagos, Payment
-- Validation and Aclaracion de Pagos all use as USER / TELEFONO.
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,              -- TELEFONO / USER / TELEFONO BD
  full_name text,                          -- NOMBRE / SHOPPER_FULL_NAME
  email text,                              -- CORREO ELECTRONICO / SHOPPER_EMAIL
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_email_idx on users (email);

-- Hoja "Tarifa_Piano" — lookup used to compute the GENERADO amount
-- for an order from its model + lines + distance.
create table tariffs (
  id uuid primary key default gen_random_uuid(),
  model text not null,                     -- TARIFA (M99, M105, M109, M119...)
  lines_min integer not null,
  lines_max integer not null,
  km_min numeric(6, 2) not null,
  km_max numeric(6, 2) not null,
  amount numeric(12, 2) not null,          -- PAGO
  created_at timestamptz not null default now(),
  unique (model, lines_min, lines_max, km_min, km_max)
);

create index tariffs_model_idx on tariffs (model);

-- ============================================================
-- GENERADO — Hoja "Data BA"
-- ============================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,           -- ORDER_ID
  status text not null,                    -- STATUS (DELIVERED, ...)
  store_id uuid references stores (id),
  delivery_date timestamptz,               -- DELIVERY_DATE
  slot text,                                -- SLOT
  on_time boolean,                          -- ON_TIME (0/1)
  distance_km numeric(10, 4),               -- DISTANCE_MAN_HAV
  user_id uuid references users (id),       -- matched via SHOPPER_EMAIL / SHOPPER_FULL_NAME
  lines_requested integer,                  -- NO_LINES_REQUESTED
  is_late boolean not null default false,   -- PEDIDOS_LATE
  zone_id uuid references zones (id),       -- ZONA_CLASIFICACION
  clean_date date,                          -- FECHA_LIMPIA
  generated_amount numeric(12, 2),          -- resolved via tariffs at ingestion time
  tariff_id uuid references tariffs (id),
  raw_row jsonb,                            -- original row, for audit/debugging
  created_at timestamptz not null default now()
);

create index orders_store_id_idx on orders (store_id);
create index orders_user_id_idx on orders (user_id);
create index orders_zone_id_idx on orders (zone_id);
create index orders_delivery_date_idx on orders (delivery_date);
create index orders_clean_date_idx on orders (clean_date);

-- ============================================================
-- ENVIADO A FINANZAS — Hoja "Reporte de Pagos BA-MX | Layout Pagos"
-- ============================================================

create table finance_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_date date not null,             -- FECHA
  store_id uuid references stores (id),     -- STORE ID
  user_id uuid references users (id),       -- USER
  description text,                         -- DESCRIPTION (e.g. "Task: ... dd/mm")
  amount numeric(12, 2) not null,           -- AMOUNT
  tariff_model text,                        -- MODEL
  -- MASTER_PAGOS = Aprobado/NO. This is submission approval, NOT payment
  -- confirmation — never collapse this into "paid".
  master_pagos_approved boolean not null default false,
  order_id uuid references orders (id),     -- matched by task ref inside DESCRIPTION when possible
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create index finance_submissions_store_id_idx on finance_submissions (store_id);
create index finance_submissions_user_id_idx on finance_submissions (user_id);
create index finance_submissions_submitted_date_idx on finance_submissions (submitted_date);

-- ============================================================
-- Aclaración de Pagos — the Google Form destination sheet.
-- This is the one place the source already tracks
-- GENERADO -> ENVIADO -> PAGADO explicitly per claim.
-- ============================================================

create table payment_claims (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null,        -- Marca temporal
  claim_date date,                          -- Fecha
  folio text,                               -- Folio
  user_phone text,                          -- Teléfono User
  evidence_url text,                        -- Evidencia
  status text,                              -- ESTATUS
  db_date date,                             -- FECHA BD
  proceeds boolean,                         -- PROCEDE
  store_id uuid references stores (id),     -- STORE ID
  db_phone text,                            -- TELEFONO BD
  description text,                         -- DESCRIPCION
  amount numeric(12, 2),                    -- AMOUNT
  send_status text,                         -- ESTATUS ENVÍO
  paid_in_master boolean not null default false, -- PAGADO EN MASTER
  comments text,                            -- COMENTARIOS
  user_id uuid references users (id),
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create index payment_claims_user_id_idx on payment_claims (user_id);
create index payment_claims_store_id_idx on payment_claims (store_id);
create index payment_claims_submitted_at_idx on payment_claims (submitted_at);

-- ============================================================
-- PAGADO — Hojas "1st Payment" / "2nd Payment" / "Payment Validation"
-- ============================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) not null, -- USER
  store_id uuid references stores (id),         -- Store
  period_label text,                             -- e.g. "2-3-4 Jul 2026"
  payment_round smallint not null,               -- 1 = 1st Payment, 2 = 2nd Payment
  task_ref text,                                 -- Task
  amount numeric(12, 2) not null,                -- Payment / Real Payment Amount / Total Payment
  adjustment numeric(12, 2) not null default 0,  -- Adjustment
  matched boolean,                                -- Match (TRUE/FALSE)
  paid_at date,
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create index payments_user_id_idx on payments (user_id);
create index payments_store_id_idx on payments (store_id);
create index payments_paid_at_idx on payments (paid_at);

-- ============================================================
-- RECONCILIATION — derived table comparing the three amounts
-- ============================================================

create table reconciliation (
  id uuid primary key default gen_random_uuid(),
  period_label text,
  user_id uuid references users (id),
  store_id uuid references stores (id),
  order_id uuid references orders (id),
  generated_amount numeric(12, 2) not null default 0,
  submitted_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  difference numeric(12, 2) generated always as
    (submitted_amount - paid_amount) stored,
  status reconciliation_status not null default 'PENDIENTE',
  computed_at timestamptz not null default now()
);

create index reconciliation_user_id_idx on reconciliation (user_id);
create index reconciliation_store_id_idx on reconciliation (store_id);
create index reconciliation_status_idx on reconciliation (status);

-- ============================================================
-- PLATFORM TABLES (app-only, not present in the source Sheets)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role user_role not null default 'VIEWER',
  store_id uuid references stores (id),
  zone_id uuid references zones (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  source_sheet text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status sync_status not null default 'RUNNING',
  records_read integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  errors_count integer not null default 0,
  error_detail jsonb,
  triggered_by uuid references auth.users (id)
);

create index sync_logs_started_at_idx on sync_logs (started_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on audit_logs (created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table zones enable row level security;
alter table stores enable row level security;
alter table users enable row level security;
alter table tariffs enable row level security;
alter table orders enable row level security;
alter table finance_submissions enable row level security;
alter table payment_claims enable row level security;
alter table payments enable row level security;
alter table reconciliation enable row level security;
alter table profiles enable row level security;
alter table sync_logs enable row level security;
alter table audit_logs enable row level security;

create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- Any authenticated user with a profile can read the operational/financial
-- data — fine-grained scoping (own store/zone only) is applied in the
-- application layer for OPERATIONS/VIEWER roles; RLS here is the floor.
create policy "authenticated read" on zones for select using (auth.role() = 'authenticated');
create policy "authenticated read" on stores for select using (auth.role() = 'authenticated');
create policy "authenticated read" on users for select using (auth.role() = 'authenticated');
create policy "authenticated read" on tariffs for select using (auth.role() = 'authenticated');
create policy "authenticated read" on orders for select using (auth.role() = 'authenticated');
create policy "authenticated read" on finance_submissions for select using (auth.role() = 'authenticated');
create policy "authenticated read" on payment_claims for select using (auth.role() = 'authenticated');
create policy "authenticated read" on payments for select using (auth.role() = 'authenticated');
create policy "authenticated read" on reconciliation for select using (auth.role() = 'authenticated');
create policy "authenticated read" on sync_logs for select using (auth.role() = 'authenticated');
create policy "authenticated read" on audit_logs for select using (auth.role() = 'authenticated');

create policy "self read" on profiles for select using (auth.uid() = id);
create policy "admin manage profiles" on profiles for all
  using (current_user_role() = 'ADMIN')
  with check (current_user_role() = 'ADMIN');

-- Writes to financial/operational data are server-side only (sync job,
-- API routes using the service role key) — no direct client insert/update
-- policies are granted, so RLS defaults to deny for those.

create policy "admin+finance write payment status" on payment_claims for update
  using (current_user_role() in ('ADMIN', 'FINANCE'))
  with check (current_user_role() in ('ADMIN', 'FINANCE'));
