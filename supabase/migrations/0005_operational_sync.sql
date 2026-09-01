-- Supports syncing orders straight from BigQuery (ext_bodega_aurrera)
-- without the financial-side Sheets (Usuarios, Configuración de Tiendas)
-- that are currently paused — see docs/data-audit.md. That source has
-- SHOPPER_EMAIL but no phone number, and STORE_NUMBER/STORE_NAME/STATE
-- but no tariff model, so both become optional here.

alter table users alter column phone drop not null;
create unique index if not exists users_email_unique_idx on users (email) where email is not null;

alter table stores alter column tariff_model drop not null;
alter table stores add column if not exists state text;
