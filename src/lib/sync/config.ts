/**
 * Sheet tab names and expected header rows, based on the audit in
 * docs/data-audit.md (read via Google Drive's document export, which
 * concatenates every tab — exact tab names as they appear on the sheet's
 * tab bar were not directly observable that way).
 *
 * ⚠️ VERIFY before first run: open the spreadsheet, check each tab name
 * in `TAB` below against the actual tab bar, and fix any mismatch. The
 * parser fails loudly (see parsers.ts) if a header row doesn't match
 * EXPECTED_HEADER, rather than silently misreading columns — so a wrong
 * tab name surfaces as a clear sync error, not corrupted data.
 */
export const TAB = {
  usuarios: "Usuarios",
  configTiendas: "Configuración de Tiendas",
  tarifaPiano: "Tarifa_Piano",
  dataBA: "Data BA",
  masterPagos: "Reporte de Pagos BA-MX",
  aclaracionPagos: "Aclaración de Pagos",
  payment1st: "1st Payment",
  payment2nd: "2nd Payment",
} as const;

// Row range is generous (2000-20000) since exact row counts vary per sync
// and unfilled trailing rows are simply skipped by the parsers.
export const RANGES = {
  usuarios: `${TAB.usuarios}!A1:C5000`,
  configTiendas: `${TAB.configTiendas}!A1:F2000`,
  tarifaPiano: `${TAB.tarifaPiano}!A1:F200`,
  dataBA: `${TAB.dataBA}!A1:P50000`,
  masterPagos: `${TAB.masterPagos}!A1:H50000`,
  aclaracionPagos: `${TAB.aclaracionPagos}!A1:O5000`,
  payment1st: `${TAB.payment1st}!A1:H5000`,
  payment2nd: `${TAB.payment2nd}!A1:H5000`,
} as const;
