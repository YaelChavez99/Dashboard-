# Base de datos y autenticación — para TechOps

Este documento resume la base de datos y el login de la app, para
provisionar Cloud SQL y el OAuth Client de Google Workspace.

## Motor: Cloud SQL for SQL Server

Confirmado con TI — el esquema vive en `prisma/schema.prisma` (Prisma
ORM, provider `sqlserver`), traducido desde el diseño original en
Postgres (`supabase/migrations/`, ya retirado). Diferencias deliberadas
frente al diseño original:

- **Sin enums nativos** (SQL Server/Prisma no los soportan) — los
  campos de estatus (`role`, estados de pago/reconciliación/sync) son
  `String`, con los mismos valores permitidos ya tipados en
  `src/types/database.ts`.
- **Sin Row Level Security a nivel de base de datos.** El login ya no
  es Supabase Auth, así que no existe un `auth.uid()` del cual colgar
  políticas RLS — la autorización (por rol, por tienda/zona) se aplica
  100% en la capa de aplicación (`src/lib/data/*.ts` + rutas API), como
  ya pasaba para los roles OPERATIONS/VIEWER incluso antes.
- **Relaciones sin cascada automática** (`onDelete/onUpdate: NoAction`
  en todo el esquema) — SQL Server no permite que varias rutas de
  cascada lleguen a la misma tabla, y para datos financieros es más
  seguro que un borrado nunca dispare cambios en cadena sin que la app
  lo controle explícitamente.
- **`reconciliation.difference`** se calcula en la app, no es columna
  generada por la base de datos (Prisma no soporta columnas generadas
  en SQL Server).
- **No existe `v_payment_ledger`** como vista — el mismo join
  (orders + finance_submissions + payments) se hace en código
  (`src/lib/data/payments.ts` / `users.ts`).

## Autenticación: Google Workspace (`zubale.com`)

Login vía NextAuth/Auth.js (`src/lib/auth.ts`) con Google OAuth,
restringido al dominio `zubale.com` (se valida el claim `hd` de Google,
no solo el sufijo del correo). No usa Supabase Auth ni ningún otro
proveedor externo.

**Lo que TechOps necesita crear:** un OAuth Client ID en Google Cloud
Console, dentro del proyecto de Zubale, con
`https://<dominio-del-deploy>/api/auth/callback/google` como redirect
URI autorizado. El Client ID y Client Secret resultantes van como
secrets (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`) — ver `.env.example`
y `cloudbuild.yaml`.

`profiles` (la tabla de cuentas de login, con el rol
ADMIN/FINANCE/OPERATIONS/VIEWER) se provisiona sola en el primer login
de cada persona — antes esto lo hacía un trigger de Supabase sobre
`auth.users`; ahora lo hace el callback `signIn` de NextAuth
directamente contra Prisma.

## Tablas

| Tabla | Origen (hoja real) | Notas |
|---|---|---|
| `zones` | `ZONA_CLASIFICACION` en Data BA | catálogo de zonas |
| `stores` | Configuración de Tiendas | tarifa/zona opcionales desde BigQuery |
| `users` | Usuarios / derivado de BigQuery | `phone` opcional, `email` único |
| `tariffs` | Tarifa_Piano | lookup de tarifas por modelo/líneas/km |
| `orders` | Data BA | GENERADO — pedidos operativos |
| `finance_submissions` | Reporte de Pagos | ENVIADO_A_FINANZAS |
| `payment_claims` | Aclaración de Pagos | reclamos de pago |
| `payments` | 1st/2nd Payment | PAGADO |
| `reconciliation` | derivada | comparación generado/enviado/pagado |
| `bonuses` | Bonos-Supply | bonos, no es parte del flujo de pagos |
| `profiles` | solo-app | cuenta de login — rol, tienda, zona |
| `sync_logs` | solo-app | bitácora de sincronización |
| `audit_logs` | solo-app | auditoría |

## Provisionar

1. Cloud SQL for SQL Server — crear la instancia y una base de datos.
2. Pasarnos la connection string como `DATABASE_URL` (secret, ver
   `.env.example` para el formato exacto).
3. Correr `npx prisma db push` (o `prisma migrate deploy` si prefieren
   migraciones versionadas) contra esa base para crear las tablas desde
   `prisma/schema.prisma` — no hace falta escribir DDL a mano.
4. Crear el OAuth Client de Google Workspace (arriba) y pasarnos
   `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
