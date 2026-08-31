-- Bonos-Supply — see docs/data-audit.md for the real audited columns
-- (gid=2132023001 of the same spreadsheet as 0001_init.sql).
--
-- Modeled separately from the GENERADO/ENVIADO/PAGADO payments flow: this
-- sheet has no explicit "Aprobado"/"Pagado" status column, only a
-- "Payment check" boolean, so `payment_checked` stays a verification
-- signal — never collapsed into "paid" without further evidence.

create table bonuses (
  id uuid primary key default gen_random_uuid(),
  bonus_date date not null,               -- DATE
  week_service text,                      -- WEEK SERVICE
  brand text not null,                    -- BRAND (filtered to 'Bodega Aurrera' at sync time)
  area text,                              -- AREA
  owner text,                             -- OWNER
  typo text not null,                     -- TYPO (bonus type/category)
  store_id uuid references stores (id),   -- STORE ID
  user_id uuid references users (id),     -- USER
  description text,                       -- DESCRIPTION
  amount numeric(12, 2) not null,         -- AMOUNT
  payment_checked boolean not null default false, -- "Payment check"
  ot text,                                -- OT
  validation text,                        -- Validación
  comments text,                          -- Comentario
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create index bonuses_store_id_idx on bonuses (store_id);
create index bonuses_user_id_idx on bonuses (user_id);
create index bonuses_bonus_date_idx on bonuses (bonus_date);
create index bonuses_typo_idx on bonuses (typo);

alter table bonuses enable row level security;

create policy "authenticated read" on bonuses for select using (auth.role() = 'authenticated');
