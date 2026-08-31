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
  // "1st Payment", "2nd Payment" and "Payment Validation" live as three
  // mini-tables side by side on what appears to be ONE tab (they showed
  // up back-to-back with no tab break in the audit dump) — the tab's
  // real name is the least confirmed of this whole config. Best guess
  // below; parsePaymentValidation() scans for its header row within
  // whatever range this points to, so a too-narrow (wrong tab) range
  // fails loudly rather than silently, but a wrong TAB NAME still 404s
  // at the Sheets API — confirm this against the tab bar first.
  paymentValidation: "Payment Validation",
  // Confirmed by the user at gid=2132023001 of this same spreadsheet — a
  // clean single-header table (unlike Payment Validation above), but its
  // literal tab name wasn't directly observable either; "Bonos-Supply" is
  // how the user identified it.
  bonosSupply: "Bonos-Supply",
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
  // Wide on purpose — covers all three mini-tables regardless of which
  // column the "Payment Validation" one actually starts at.
  paymentValidation: `${TAB.paymentValidation}!A1:AG5000`,
  bonosSupply: `${TAB.bonosSupply}!A1:X20000`,
} as const;
