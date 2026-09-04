import type { ParsedOrder } from "./parsers";

// BigQuery's Node client wraps TIMESTAMP/DATE columns in objects like
// { value: "2026-07-12T01:00:00.000Z" } instead of plain strings.
function bqValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return String((v as { value: unknown }).value);
  }
  return String(v);
}

function isBlank(v: unknown): boolean {
  return v == null || v === "";
}

/**
 * Raw rows from `ext_bodega_aurrera` (BigQuery) — schema confirmed
 * directly from the table (see docs/data-audit.md): ORDER_ID, STATUS,
 * STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, SLOT, ON_TIME,
 * DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL, NO_LINES_REQUESTED,
 * STORE_ID, PEDIDOS_LATE, ZONA_CLASIFICACION, FECHA_LIMPIA — already
 * typed by BigQuery (INTEGER/STRING/TIMESTAMP/FLOAT/DATE), unlike the raw
 * Sheet, so there's no header-row shape to validate against.
 *
 * STORE_ID legitimately comes back blank for CANCELLED orders that never
 * got assigned to a store — those are kept (with no store attribution)
 * rather than dropped, since they still count for order-volume analytics.
 */
export function parseBigQueryOrders(rows: Record<string, unknown>[]): ParsedOrder[] {
  return rows
    .filter((r) => r.ORDER_ID != null)
    .map((r) => ({
      orderId: String(r.ORDER_ID),
      status: String(r.STATUS ?? ""),
      storeExtId: isBlank(r.STORE_ID) ? "" : String(r.STORE_ID),
      deliveryDate: bqValue(r.DELIVERY_DATE),
      slot: String(r.SLOT ?? ""),
      onTime: isBlank(r.ON_TIME) ? null : Number(r.ON_TIME) === 1,
      distanceKm: Number(r.DISTANCE_MAN_HAV ?? 0),
      shopperFullName: String(r.SHOPPER_FULL_NAME ?? ""),
      shopperEmail: String(r.SHOPPER_EMAIL ?? "").toLowerCase(),
      linesRequested: Number(r.NO_LINES_REQUESTED ?? 0),
      isLate: Number(r.PEDIDOS_LATE) === 1,
      zoneName: String(r.ZONA_CLASIFICACION ?? ""),
      cleanDate: bqValue(r.FECHA_LIMPIA),
    }));
}

export interface DerivedStore {
  storeNumber: string;
  storeExtId: string;
  name: string;
  state: string;
}

/** Distinct stores embedded in the orders rows — no separate Config_Tiendas source needed. */
export function deriveStoresFromBigQuery(rows: Record<string, unknown>[]): DerivedStore[] {
  const map = new Map<string, DerivedStore>();
  for (const r of rows) {
    if (isBlank(r.STORE_ID)) continue;
    const storeExtId = String(r.STORE_ID);
    map.set(storeExtId, {
      storeNumber: String(r.STORE_NUMBER ?? storeExtId),
      storeExtId,
      name: String(r.STORE_NAME ?? "—"),
      state: String(r.STATE ?? ""),
    });
  }
  return Array.from(map.values());
}

export interface DerivedUser {
  email: string;
  fullName: string;
}

/** Distinct shoppers embedded in the orders rows — no separate Usuarios source needed. */
export function deriveUsersFromBigQuery(rows: Record<string, unknown>[]): DerivedUser[] {
  const map = new Map<string, DerivedUser>();
  for (const r of rows) {
    const email = String(r.SHOPPER_EMAIL ?? "").toLowerCase().trim();
    if (!email) continue;
    map.set(email, { email, fullName: String(r.SHOPPER_FULL_NAME ?? "") });
  }
  return Array.from(map.values());
}
