# Esquema de base de datos — para TechOps

Este documento resume qué tipo de base de datos necesita esta app y el DDL
completo, para que TechOps sepa qué aprovisionar al migrar fuera de Supabase.

## Motor requerido

**PostgreSQL 14+.** El esquema usa tipos `uuid`, `jsonb`, `numeric`,
`timestamptz`, la extensión `pgcrypto` (para `gen_random_uuid()`), enums
nativos, índices, una vista, un trigger y Row Level Security (RLS).

## ⚠️ Dependencia de Supabase Auth — leer antes de aprovisionar

El esquema **no es un Postgres genérico plano**: varias piezas asumen el
esquema `auth` que provee Supabase Auth (Supabase corre sobre GoTrue +
Postgres, y expone la tabla `auth.users` y funciones `auth.uid()` /
`auth.role()` dentro de la misma base de datos):

- `profiles.id` es **foreign key a `auth.users(id)`** — la tabla de
  usuarios de autenticación.
- El trigger `on_auth_user_created` (`0004_profile_trigger.sql`) se
  dispara sobre `auth.users` para crear el perfil automáticamente al
  registrarse.
- Todas las políticas RLS usan `auth.role() = 'authenticated'` y
  `auth.uid()` — funciones que expone Supabase, no Postgres puro.
- El login de la app usa `@supabase/ssr` (Supabase Auth), no un proveedor
  de auth genérico.

**Esto significa que si TechOps aprovisiona un Cloud SQL / Postgres
genérico (sin Supabase), el login y el auto-registro de perfiles no van a
funcionar tal cual** — hace falta una de estas dos rutas, y vale la pena
que Eliab/TechOps opinen cuál prefieren antes de migrar:

1. **Supabase self-hosted** dentro de la infraestructura de Zubale (mismo
   motor, mismo esquema `auth`, cero cambios de código) — la ruta más
   simple.
2. **Postgres genérico + reemplazar el proveedor de auth** (ej. su propio
   SSO/IdP interno) — requiere que yo adapte `profiles`, el trigger y las
   políticas RLS al nuevo proveedor antes de que funcione el login.

## Tablas

| Tabla | Origen (hoja real) | Notas |
|---|---|---|
| `zones` | `ZONA_CLASIFICACION` en Data BA | catálogo de zonas |
| `stores` | Configuración de Tiendas | tarifa/zona opcionales desde BigQuery (`0005`) |
| `users` | Usuarios / derivado de BigQuery | `phone` ahora opcional, `email` único (`0005`) |
| `tariffs` | Tarifa_Piano | lookup de tarifas por modelo/líneas/km |
| `orders` | Data BA | GENERADO — pedidos operativos |
| `finance_submissions` | Reporte de Pagos | ENVIADO_A_FINANZAS |
| `payment_claims` | Aclaración de Pagos | reclamos de pago |
| `payments` | 1st/2nd Payment | PAGADO |
| `reconciliation` | derivada | comparación generado/enviado/pagado |
| `bonuses` | Bonos-Supply | bonos, no es parte del flujo de pagos |
| `profiles` | solo-app | perfil + rol, requiere `auth.users` (ver arriba) |
| `sync_logs` | solo-app | bitácora de sincronización |
| `audit_logs` | solo-app | auditoría |

Vista `v_payment_ledger`: ledger aplanado que une `orders` +
`finance_submissions` + `payments` para `/payments` y el export CSV.

## DDL completo

Las migraciones, en orden, están en `supabase/migrations/`:

1. `0001_init.sql` — esquema inicial completo (enums, tablas, índices, RLS)
2. `0002_views.sql` — vista `v_payment_ledger`
3. `0003_bonuses.sql` — tabla `bonuses`
4. `0004_profile_trigger.sql` — trigger de auto-registro de perfil
5. `0005_operational_sync.sql` — columnas opcionales para la fuente BigQuery

Aplíquenlas en ese orden tal cual (son idempotentes con `if not exists`
donde aplica). No hace falta que yo las concatene — son el DDL real y
único que corre hoy contra Supabase.
