#!/usr/bin/env node
// Standalone connection check for the Google Sheets service account — run
// this BEFORE putting the key into Passbolt/Cloud Build, to catch a bad
// key, a wrong spreadsheet ID, or a missing "share with this email" step
// locally instead of after a deploy.
//
// Usage: npm run test:sheets
// Reads GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY /
// GOOGLE_SHEETS_SPREADSHEET_ID from .env.local (same vars as .env.example).

import { readFileSync, existsSync } from "node:fs";
import { google } from "googleapis";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Must match src/lib/sync/config.ts (TAB.dataBA / RANGES.dataBA) — kept as
// a plain string here since this script runs outside Next.js's `@/` alias.
const DATA_BA_RANGE = "Data BA!A1:P50000";

async function main() {
  loadEnvLocal();

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  const missing = [
    !email && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    !key && "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    !spreadsheetId && "GOOGLE_SHEETS_SPREADSHEET_ID",
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Faltan variables en .env.local: ${missing.join(", ")}`);
    console.error("Ver .env.example para el formato esperado.");
    process.exit(1);
  }

  console.log(`Cuenta de servicio: ${email}`);
  console.log(`Spreadsheet ID:     ${spreadsheetId}`);
  console.log(`Rango:              ${DATA_BA_RANGE}`);
  console.log("Conectando...\n");

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: DATA_BA_RANGE,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const values = res.data.values ?? [];

    if (values.length === 0) {
      console.warn("Conectó, pero el rango vino vacío — revisa el nombre del tab y el rango.");
      return;
    }

    const [header, ...rows] = values;
    console.log(`OK — ${rows.length} filas de datos encontradas.`);
    console.log(`Columnas (${header.length}): ${header.join(", ")}`);
    if (rows[0]) console.log(`\nPrimera fila de ejemplo:\n${JSON.stringify(rows[0])}`);
  } catch (err) {
    console.error("\nFalló la conexión:");
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "\nCausas comunes: el Sheet no está compartido con la cuenta de servicio como Lector, " +
        "la Google Sheets API no está habilitada en el proyecto, o el ID/rango es incorrecto."
    );
    process.exit(1);
  }
}

main();
