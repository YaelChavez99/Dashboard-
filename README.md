# Finance & Operations Control

Hub centralizado de operación y finanzas para managers y directivos.
Reemplaza el flujo de "abrir el Google Sheets" con una aplicación web con
login, roles, un dashboard ejecutivo y una **Biblioteca** que centraliza
las herramientas del equipo en un solo lugar. Google Sheets/Forms y
BigQuery quedan como **fuente de datos**, sincronizada hacia una base de
datos propia, nunca como la interfaz.

La meta: un solo lugar donde ver, en vivo y en histórico, la operación y
los pagos de **Bodega Aurrera** (ya construido) y, en roadmap, de
**Walmart** y **Sam's** — con métricas cruzadas por día/semana/mes,
estado, ciudad, tienda, usuario y slot, totalmente interactivo: filtros
combinables y clic sobre cualquier desglose para hacer zoom directo al
detalle.

Ver `docs/data-audit.md` para la auditoría completa de las hojas reales
que sustentan el esquema (`supabase/migrations/0001_init.sql`), y
`docs/database-schema.md` para el resumen pensado para TechOps.

## Visión del Hub

| Marca | Operación | Estado |
|---|---|---|
| Bodega Aurrera | Órdenes, performance por tienda/usuario/zona/estado, revenue y margen por tienda | ✅ construido |
| Walmart | — | 🚧 roadmap, pendiente conectar fuente de datos |
| Sam's | — | 🚧 roadmap, pendiente conectar fuente de datos |

Cortes que el hub debe soportar, para cualquier marca conectada:

- Por periodo: día / semana / mes
- Por estado (geográfico) y por ciudad
- Por tienda
- Por usuario / shopper
- Por slot de entrega

Hoy Analytics ya soporta filtros combinables por tienda, estado, zona y
estatus, con clic en cualquier desglose (zona / estado / estatus) para
saltar directo al detalle filtrado. **Ciudad** y **slot** como cortes
propios (no solo como dato dentro del detalle) son el siguiente paso —
ver Roadmap al final.

## Estado actual

Construido en el orden recomendado para validar el modelo financiero antes
de expandir a más módulos y más marcas:

- ✅ Login (Supabase Auth) + roles (ADMIN / FINANCE / OPERATIONS / VIEWER)
- ✅ Overview — KPIs, Financial Flow (funnel), Financial Trend, alertas
- ✅ Finanzas (`/finance`) — revenue y margen por tienda, día/semana/mes
- ✅ Pagos — historial con filtros, búsqueda, export CSV, paginación
- ✅ Perfil de usuario — totales, historial, Cumulative Payments
- ✅ Conciliación — Generado vs Master Pagos vs Pagado, con estados
- ✅ Admin → Sincronización — panel con último estado, botón "Sincronizar
  datos", carga manual de CSV y bitácora (`sync_logs`)
- ✅ Bonos — hoja Bonos-Supply (confirmada por el usuario en
  `gid=2132023001` del mismo spreadsheet), tabla + KPIs
- ✅ Sync operativo BigQuery (`ext_bodega_aurrera`) → Supabase — deriva
  usuarios/tiendas y hace upsert de órdenes. El sync financiero vía
  Google Sheets (`src/lib/sync/`) sigue disponible en el código pero
  pausado — ver "Fuente operativa actual" abajo.
- ✅ Analytics (`/analytics`) — dashboard ejecutivo operativo, muy
  interactivo: tendencias de volumen y on-time % (día/semana/mes),
  filtros combinables por tienda/estado/zona/estatus, desglose clicable
  (zoom directo al detalle filtrado), ranking de tiendas y usuarios por
  performance.
- ✅ Biblioteca (`/library`) — centraliza dashboards, fuentes de datos
  (Google Sheet auditado, consola de BigQuery) y el repositorio, para que
  el equipo tenga visibilidad de todas las herramientas en un solo lugar.
- 🚧 Walmart y Sam's — misma operación, pendiente conectar fuente de datos.
- 🚧 Cortes dedicados por ciudad y por slot en Analytics.
- 🚧 Tiendas, Zonas, Calidad de Datos, Reportes — pantallas
  "Próximamente"; siguiente fase una vez validado lo anterior.

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
BigQuery (ext_bodega_aurrera) ──sync──────────────────▶      │
                                                              ▼
                                          Next.js (App Router) + Tailwind
                                          shadcn/ui-style components + Recharts
                                                              │
                                                              ▼
                                          Google Cloud Run (Zubale infra)
```

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind v4.
- **UI**: componentes estilo shadcn/ui escritos a mano sobre Radix
  primitives (`src/components/ui`) — el CLI de shadcn (`ui.shadcn.com`)
  no es alcanzable desde este entorno de build, así que los componentes
  base se generaron manualmente siguiendo el mismo patrón/API.
- **Charts**: Recharts (`src/components/dashboard/*-chart.tsx`).
- **Backend/DB**: Supabase — Postgres + Auth + Row Level Security (ver
  `docs/database-schema.md` sobre la dependencia de Supabase Auth al
  migrar el hosting fuera de Supabase/Vercel).
- **Deploy**: Google Cloud Run dentro de la infraestructura de Zubale —
  ver `Procfile` y `cloudbuild.yaml`.
- **Data access**: cada dominio (`overview`, `finance`, `analytics`,
  `payments`, `users`, `reconciliation`) tiene un único módulo en
  `src/lib/data/` que decide entre el dataset demo y una consulta real a
  Supabase (`isDemoMode()`).

## Setup local

```bash
npm install
cp .env.example .env.local   # completa las credenciales de Supabase cuando existan
npm run dev
```

Sin completar `.env.local`, la app funciona igual en modo demo (ver arriba).

### Variables de entorno

Ver `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` es server-only — nunca se
expone al cliente ni se usa fuera de `src/lib/supabase/server.ts`.

### Antes del primer sync real (Google Sheets)

1. Crea un service account en Google Cloud, habilita la Google Sheets
   API, y comparte el spreadsheet auditado con el email del service
   account como **Viewer**.
2. Copia su email y private key a `GOOGLE_SERVICE_ACCOUNT_EMAIL` /
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` en `.env.local`
   (`GOOGLE_SHEETS_SPREADSHEET_ID` ya viene con el ID correcto).
3. **Verifica los nombres de tab en `src/lib/sync/config.ts`** contra la
   barra de pestañas real del spreadsheet — se infirieron de un export de
   texto plano (ver docs/data-audit.md), no de la API, así que un nombre
   de tab puede no coincidir exactamente. Si no coincide, el sync falla
   con un error claro (no lee datos silenciosamente mal).
4. La hoja **"Payment Validation"** (fuente de PAGADO) tiene tres
   mini-tablas ("1st Payment", "2nd Payment", "Payment Validation") una
   junto a otra con encabezados combinados — `TAB.paymentValidation` en
   `src/lib/sync/config.ts` es la conjetura menos confirmada de esta
   config (nombre de tab real sin verificar). Para compensarlo,
   `parsePaymentValidation()` no asume una columna fija: escanea el rango
   completo buscando la fila de encabezado real (`USER, Task, ..., Store,
   ..., Match`) y lee desde ahí — así que un corrimiento de columnas no
   rompe nada, pero un nombre de tab equivocado sí falla con un 404 claro
   de la API. Confírmalo contra la barra de pestañas antes del primer
   sync real.
5. Corre el sync desde Administración → Sincronizar datos (requiere rol
   ADMIN), o `POST /api/sync`.

### Fuente operativa actual: BigQuery (`ext_bodega_aurrera`)

El foco actual del proyecto es 100% operativo (órdenes, tiendas, usuarios —
sin el lado financiero). En vez de leer los tabs de Sheets uno por uno, la
fuente de datos operativa es la tabla `ext_bodega_aurrera` en BigQuery
(`zb-data-bu-mexico-dev`), que ya es alimentada por el pipeline propio de
Sheets → BigQuery de la empresa. `src/lib/sync/run-operational-sync.ts`
deriva usuarios y tiendas de esas mismas filas y hace upsert de órdenes —
deliberadamente no toca `finance_submissions` / `payment_claims` /
`payments` / `bonuses`.

Para correr este sync automatizado hace falta un service account de Google
Cloud con acceso de lectura a BigQuery
(`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` /
`BIGQUERY_PROJECT_ID` / `BIGQUERY_DATASET` en `.env.local`) — actualmente
bloqueado por permisos IAM del proyecto compartido.

#### Workaround mientras se habilita el acceso: carga manual de CSV

Administración → "Carga manual" acepta un CSV exportado directamente de
`ext_bodega_aurrera` desde BigQuery Studio (mismas columnas: `ORDER_ID`,
`STATUS`, `STORE_NUMBER`, `STORE_NAME`, `STATE`, `DELIVERY_DATE`, `SLOT`,
`ON_TIME`, `DISTANCE_MAN_HAV`, `SHOPPER_FULL_NAME`, `SHOPPER_EMAIL`,
`NO_LINES_REQUESTED`, `STORE_ID`, `PEDIDOS_LATE`, `ZONA_CLASIFICACION`,
`FECHA_LIMPIA`). Reutiliza los mismos parsers y upserts que el sync
automatizado (`src/app/api/sync/upload-csv/route.ts`), así que produce el
mismo resultado — sólo requiere que un ADMIN exporte y suba el archivo a
mano en lugar de que el server lo consulte directo.

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
`/payments` y el export CSV. Ver `docs/database-schema.md` para el
detalle completo pensado para TechOps, incluida la dependencia de
Supabase Auth.

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

1. **Walmart y Sam's** — conectar sus fuentes de datos operativos y
   extender `src/lib/sync/` + `src/lib/data/` para soportar múltiples
   marcas en los mismos dashboards.
2. **Cortes por ciudad y por slot** en Analytics, como desgloses propios
   (hoy solo viven como dato dentro del detalle de cada orden).
3. Decidir el destino final de la base de datos/auth (Supabase
   self-hosted vs. otro proveedor) — ver `docs/database-schema.md`.
4. Correr el primer sync real, confirmar `TAB.paymentValidation` y
   `TAB.bonosSupply` contra la barra de pestañas, y validar conteo de
   registros Sheets vs Supabase por hoja (sección 42 del brief original —
   conciliación de migración).
5. Confirmar la fuente de `Master Data BA` (no se encontró en el archivo
   auditado — ver `docs/data-audit.md`).
6. Tiendas, Zonas, Calidad de Datos, Reportes (audit log UI, system
   health, gestión de roles ya viven en Admin).
