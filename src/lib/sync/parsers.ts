// Parses raw Sheets rows into typed records. Every parser validates its
// header row against what was actually observed in the audit
// (docs/data-audit.md) and throws instead of guessing when it doesn't
// match — a silently-misread column is how money gets double-counted or
// dropped, which is the one thing the source spec explicitly forbids.

function assertHeader(rows: string[][], expected: string[], sheetLabel: string) {
  const header = (rows[0] ?? []).map((c) => String(c).trim());
  const mismatch = expected.some((col, i) => header[i] !== col);
  if (mismatch) {
    throw new Error(
      `[sync] "${sheetLabel}" header changed. Expected [${expected.join(", ")}] ` +
        `but got [${header.join(", ")}]. Update src/lib/sync/parsers.ts before re-running.`
    );
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/[$,]/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toBool01(value: unknown): boolean {
  return String(value).trim() === "1";
}

export interface ParsedUser {
  phone: string;
  fullName: string;
  email: string;
}

export function parseUsuarios(rows: string[][]): ParsedUser[] {
  assertHeader(rows, ["NOMBRE", "CORREO ELECTRONICO", "TELEFONO"], "Usuarios");
  return rows
    .slice(1)
    .filter((r) => r[2])
    .map((r) => ({ fullName: String(r[0] ?? "").trim(), email: String(r[1] ?? "").trim(), phone: String(r[2]).trim() }));
}

export interface ParsedStore {
  storeNumber: string;
  storeExtId: string;
  name: string;
  model: string;
  chargesParking: boolean;
  parkingAmount: number | null;
}

export function parseConfigTiendas(rows: string[][]): ParsedStore[] {
  assertHeader(
    rows,
    ["STORE_NUMBER", "STORE_ID", "STORE_NAME", "MODELO", "PAGO DE ESTACIONAMIENTO", "MONTO ESTACIONAMIENTO"],
    "Configuración de Tiendas"
  );
  return rows
    .slice(1)
    .filter((r) => r[1])
    .map((r) => ({
      storeNumber: String(r[0] ?? "").trim(),
      storeExtId: String(r[1]).trim(),
      name: String(r[2] ?? "").trim(),
      model: String(r[3] ?? "").trim(),
      chargesParking: String(r[4] ?? "").trim().toUpperCase() === "SI" || String(r[4] ?? "").trim().toUpperCase() === "YES",
      parkingAmount: r[5] ? toNumber(r[5]) : null,
    }));
}

export interface ParsedTariff {
  model: string;
  linesMin: number;
  linesMax: number;
  kmMin: number;
  kmMax: number;
  amount: number;
}

export function parseTarifaPiano(rows: string[][]): ParsedTariff[] {
  assertHeader(rows, ["TARIFA", "LINEAS_MIN", "LINEAS_MAX", "KM_MIN", "KM_MAX", "PAGO"], "Tarifa_Piano");
  return rows
    .slice(1)
    .filter((r) => r[0])
    .map((r) => ({
      model: String(r[0]).trim(),
      linesMin: toNumber(r[1]),
      linesMax: toNumber(r[2]),
      kmMin: toNumber(r[3]),
      kmMax: toNumber(r[4]),
      amount: toNumber(r[5]),
    }));
}

export interface ParsedOrder {
  orderId: string;
  status: string;
  storeExtId: string;
  deliveryDate: string | null;
  slot: string;
  onTime: boolean;
  distanceKm: number;
  shopperFullName: string;
  shopperEmail: string;
  linesRequested: number;
  isLate: boolean;
  zoneName: string;
  cleanDate: string | null;
}

export function parseDataBA(rows: string[][]): ParsedOrder[] {
  assertHeader(
    rows,
    [
      "ORDER_ID", "STATUS", "STORE_NUMBER", "STORE_NAME", "STATE", "DELIVERY_DATE", "SLOT", "ON_TIME",
      "DISTANCE_MAN_HAV", "SHOPPER_FULL_NAME", "SHOPPER_EMAIL", "NO_LINES_REQUESTED", "STORE ID",
      "PEDIDOS_LATE", "ZONA_CLASIFICACION", "FECHA_LIMPIA",
    ],
    "Data BA"
  );
  return rows
    .slice(1)
    .filter((r) => r[0])
    .map((r) => ({
      orderId: String(r[0]).trim(),
      status: String(r[1] ?? "").trim(),
      storeExtId: String(r[12] ?? "").trim(),
      deliveryDate: r[5] ? String(r[5]) : null,
      slot: String(r[6] ?? "").trim(),
      onTime: toBool01(r[7]),
      distanceKm: toNumber(r[8]),
      shopperFullName: String(r[9] ?? "").trim(),
      shopperEmail: String(r[10] ?? "").trim().toLowerCase(),
      linesRequested: toNumber(r[11]),
      isLate: toBool01(r[13]),
      zoneName: String(r[14] ?? "").trim(),
      cleanDate: r[15] ? String(r[15]) : null,
    }));
}

export interface ParsedFinanceSubmission {
  submittedDate: string;
  storeExtId: string;
  userPhone: string;
  description: string;
  amount: number;
  model: string;
  masterPagosApproved: boolean;
}

export function parseMasterPagos(rows: string[][]): ParsedFinanceSubmission[] {
  assertHeader(
    rows,
    ["FECHA", "STORE ID", "USER", "DESCRIPTION", "AMOUNT", "MODEL", "STORE NAME", "MASTER PAGOS"],
    "Reporte de Pagos BA-MX"
  );
  return rows
    .slice(1)
    .filter((r) => r[1] && r[2])
    .map((r) => ({
      submittedDate: String(r[0] ?? "").trim(),
      storeExtId: String(r[1]).trim(),
      userPhone: String(r[2]).trim(),
      description: String(r[3] ?? "").trim(),
      amount: toNumber(r[4]),
      model: String(r[5] ?? "").trim(),
      masterPagosApproved: String(r[7] ?? "").trim().toUpperCase() === "APROBADO",
    }));
}

export interface ParsedPaymentClaim {
  submittedAt: string;
  claimDate: string | null;
  folio: string;
  userPhone: string;
  evidenceUrl: string;
  status: string;
  dbDate: string | null;
  proceeds: boolean | null;
  storeExtId: string;
  dbPhone: string;
  description: string;
  amount: number;
  sendStatus: string;
  paidInMaster: boolean;
  comments: string;
}

export function parseAclaracionPagos(rows: string[][]): ParsedPaymentClaim[] {
  assertHeader(
    rows,
    [
      "Marca temporal", "Fecha", "Folio", "Teléfono User", "Evidencia (Ticket, Folio con Estatus  Completado)",
      "ESTATUS", "FECHA BD", "PROCEDE", "STORE ID", "TELEFONO BD", "DESCRIPCION", "AMOUNT",
      "ESTATUS ENVÍO", "PAGADO EN MASTER", "COMENTARI",
    ],
    "Aclaración de Pagos"
  );
  return rows
    .slice(1)
    .filter((r) => r[0])
    .map((r) => ({
      submittedAt: String(r[0]).trim(),
      claimDate: r[1] ? String(r[1]) : null,
      folio: String(r[2] ?? "").trim(),
      userPhone: String(r[3] ?? "").trim(),
      evidenceUrl: String(r[4] ?? "").trim(),
      status: String(r[5] ?? "").trim(),
      dbDate: r[6] ? String(r[6]) : null,
      proceeds: r[7] === "" || r[7] == null ? null : String(r[7]).trim().toUpperCase() === "SI",
      storeExtId: String(r[8] ?? "").trim(),
      dbPhone: String(r[9] ?? "").trim(),
      description: String(r[10] ?? "").trim(),
      amount: toNumber(r[11]),
      sendStatus: String(r[12] ?? "").trim(),
      paidInMaster: String(r[13] ?? "").trim().toUpperCase() === "SI",
      comments: String(r[14] ?? "").trim(),
    }));
}

/**
 * "1st Payment" / "2nd Payment" (the PAGADO source) were observed to lay
 * out more than one mini-table side by side in the same row range with
 * merged headers (see docs/data-audit.md) — the exact A1 column boundaries
 * could not be confirmed from the flattened text export used for the
 * audit. Parsing it with a guessed layout risks silently mis-summing real
 * money, so this stays a hard stop until someone opens the sheet and
 * confirms the real header row here.
 */
export function parsePaymentRound(): never {
  throw new Error(
    "[sync] 1st/2nd Payment column layout not yet confirmed against the live sheet — " +
      "see the comment on parsePaymentRound() in src/lib/sync/parsers.ts before enabling this sync step."
  );
}
