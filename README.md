# Finance & Operations Control

Centro de control financiero y operativo. Reemplaza el flujo de "abrir el
Google Sheets" con una aplicación web con login, roles y un dashboard
ejecutivo — Google Sheets/Forms quedan como **fuente de datos**, sincronizada
hacia una base de datos propia (Supabase/Postgres), nunca como la interfaz.

Ver `docs/data-audit.md` para la auditoría completa de las hojas reales que
sustentan el esquema (`supabase/migrations/0001_init.sql`).

## Estado actual

Construido en el orden recomendado para validar el modelo financiero antes
de expandir a más módulos:

- ✅ Login (Supabase Auth) + roles (ADMIN / FINANCE / OPERATIONS / VIEWER)
- ✅ Overview — KPIs, Financial Flow (funnel), Financial Trend, alertas
- ✅ Pagos — historial con filtros, búsqueda, export CSV, paginación
- ✅ Perfil de usuario — totales, historial, Cumulative Payments
- ✅ Conciliación — Generado vs Master Pagos vs Pagado, con estados
- 🚧 Tiendas, Zonas, Bonos, Analytics, Calidad de Datos, Reportes, Admin —
  pantallas "Próximamente"; siguiente fase una vez validado lo anterior.
- 🚧 Sync job Google Sheets → Supabase — el esquema y la vista de
  conciliación ya están listos para recibirlo (ver Roadmap).

**No hay un proyecto Supabase conectado todavía.** La app corre en **modo
demo**: cuando `NEXT_PUBLIC_SUPABASE_URL` no está configurada (o es el
placeholder de `.env.example`), toda la capa de datos (`src/lib/data/*`)
sirve un dataset sembrado con la misma forma del esquema real, generado a
partir de los nombres de tienda/zona/modelo encontrados en la auditoría.
Esto incluye un bypass de autenticación (usuario `ADMIN` fijo) para poder
navegar la app sin credenciales reales. En cuanto se configuran las env
vars de Supabase, ambos bypasses se desactivan solos.

## Arquitectura

```
Google Forms ──▶ Google Sheets ──sync/ETL──▶ Supabase (Postgres + Auth + RLS)
                                                        │
                                                        ▼
                                          Next.js (App Router) + Tailwind
                                          shadcn/ui-style components + Recharts
                                                        │
                                                        ▼
                                              URL compartida (Vercel)
```

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind v4.
- **UI**: componentes estilo shadcn/ui escritos a mano sobre Radix
  primitives (`src/components/ui`) — el CLI de shadcn (`ui.shadcn.com`)
  no es alcanzable desde este entorno de build, así que los componentes
  base se generaron manualmente siguiendo el mismo patrón/API.
- **Charts**: Recharts (`src/components/dashboard/*-chart.tsx`).
- **Backend/DB**: Supabase — Postgres + Auth + Row Level Security.
- **Data access**: cada dominio (`overview`, `payments`, `users`,
  `reconciliation`) tiene un único módulo en `src/lib/data/` que decide
  entre el dataset demo y una consulta real a Supabase (`isDemoMode()`).

## Setup local

```bash
npm install
cp .env.example .env.local   # completa las credenciales de Supabase cuando existan
npm run dev
```

Sin completar `.env.local`, la app funciona igual en modo demo (ver arriba).

### Conectar Supabase real

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Corre las migraciones de `supabase/migrations/` en orden (SQL editor o
   `supabase db push`).
3. Copia `Project URL`, `anon public key` y `service_role key` a
   `.env.local` según `.env.example`.
4. Crea al menos un usuario en Supabase Auth y una fila en `profiles` con
   `role = 'ADMIN'` para poder entrar.

### Variables de entorno

Ver `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` es server-only — nunca se
expone al cliente ni se usa fuera de `src/lib/supabase/server.ts`.

## Esquema de base de datos

`supabase/migrations/0001_init.sql`:

| Tabla | Origen (hoja real) |
|---|---|
| `zones`, `stores`, `users`, `tariffs` | Config_Tiendas, Usuarios, Tarifa_Piano |
| `orders` | Data BA — GENERADO |
| `finance_submissions` | Reporte de Pagos BA-MX ("Master Pagos") — ENVIADO_A_FINANZAS |
| `payment_claims` | Aclaración de Pagos (destino del Google Form) |
| `payments` | 1st/2nd Payment, Payment Validation — PAGADO |
| `reconciliation` | derivada — Generado vs Enviado vs Pagado |
| `profiles`, `sync_logs`, `audit_logs` | solo-app, no vienen de Sheets |

`0002_views.sql` agrega `v_payment_ledger`, la vista aplanada que alimenta
`/payments` y el export CSV.

RLS está activo en todas las tablas: lectura para cualquier usuario
autenticado, escritura reservada a rutas server-side con la service role
key (el sync job) y a los roles ADMIN/FINANCE donde aplica.

## Flujo financiero (regla central)

```
GENERADO (orders) → ENVIADO A FINANZAS (finance_submissions) → PAGADO (payments)
```

`finance_submissions.master_pagos_approved` (el "Master Pagos" original)
**nunca** se trata como pago confirmado — solo significa que el registro
fue aprobado para envío. El estado `PAGADO` solo se asigna cuando existe
una fila real en `payments`.

## Roadmap / siguiente fase

1. Conectar el proyecto Supabase real y correr las migraciones.
2. Sync job Google Sheets → Supabase (API route + Google service account,
   ver `.env.example`) — validar conteo de registros Sheets vs Supabase.
3. Confirmar la fuente de `Bonos-Supply` / `Master Data BA` (no se
   encontraron en el archivo auditado — ver `docs/data-audit.md`) y
   construir `/bonuses`.
4. Tiendas, Zonas, Analytics, Calidad de Datos, Reportes, Admin (audit
   log UI, system health, gestión de roles).
