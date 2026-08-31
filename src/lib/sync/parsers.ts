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

export interface ParsedPaymentValidation {
  userPhone: string;
  task: string;
  paymentPerTask: number;
  storeName: string;
  firstPayment: number;
  secondPayment: number;
  totalPayment: number;
  matched: boolean;
  adjustment: number;
}

/**
 * "1st Payment" / "2nd Payment" / "Payment Validation" live as three
 * mini-tables side by side in the same tab, with merged section headers
 * above them (see docs/data-audit.md) — so unlike every other parser in
 * this file, the column position can't be hardcoded from a fixed header
 * row index.
 *
 * "Payment Validation" is the authoritative one: it already reconciles
 * 1st + 2nd = Total per user with a Match flag, which is exactly PAGADO.
 * Rather than guess its column offset, this scans the fetched grid for
 * its header row (USER, Task, Payment per task, Store, 1st Payment,
 * 2nd Payment, Total Payment, Match, Adjustment appearing consecutively)
 * and reads from there — robust to the two other mini-tables shifting
 * around it, but still fails loudly if that header sequence isn't found
 * anywhere in the fetched range.
 */
export function parsePaymentValidation(rows: string[][]): ParsedPaymentValidation[] {
  const EXPECTED = ["USER", "Task", "Store", "Match"] as const;

  let headerRow = -1;
  let startCol = -1;

  outer: for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] ?? "").trim() !== "USER") continue;
      const task = String(row[c + 1] ?? "").trim();
      const store = String(row[c + 3] ?? "").trim();
      const match = String(row[c + 7] ?? "").trim();
      if (task === EXPECTED[1] && store === EXPECTED[2] && match === EXPECTED[3]) {
        headerRow = r;
        startCol = c;
        break outer;
      }
    }
  }

  if (headerRow === -1) {
    throw new Error(
      '[sync] Could not find the "Payment Validation" header row (USER, Task, ..., Store, ..., Match) ' +
        "in the fetched range — the sheet layout changed, or RANGES.paymentValidation in " +
        "src/lib/sync/config.ts needs a wider range. See parsePaymentValidation() in parsers.ts."
    );
  }

  const c = startCol;
  return rows
    .slice(headerRow + 1)
    .filter((r) => r[c])
    .map((r) => ({
      userPhone: String(r[c] ?? "").trim(),
      task: String(r[c + 1] ?? "").trim(),
      paymentPerTask: toNumber(r[c + 2]),
      storeName: String(r[c + 3] ?? "").trim(),
      firstPayment: toNumber(r[c + 4]),
      secondPayment: toNumber(r[c + 5]),
      totalPayment: toNumber(r[c + 6]),
      matched: String(r[c + 7] ?? "").trim().toUpperCase() === "TRUE",
      adjustment: toNumber(r[c + 8]),
    }));
}
