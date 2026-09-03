import { getSheetValues } from "@/lib/google/sheets-client";
import { RANGES } from "@/lib/sync/config";
import {
  parseBigQueryOrders,
  deriveStoresFromBigQuery,
  deriveUsersFromBigQuery,
} from "@/lib/sync/bigquery-parsers";
import { ORDERS as DEMO_ORDERS, type MockOrder } from "./mock-dataset";

/**
 * "Option B" data path — no Cloud SQL required. Reads the "Data BA" tab of
 * the same Google Sheet audited in docs/data-audit.md directly on each
 * request, so Analytics can show real operational data while Cloud SQL
 * provisioning is still pending on TechOps' side. Once DATABASE_URL is set
 * this path is unused — analytics.ts's live-mode branch (Prisma) takes
 * over instead.
 *
 * Data BA has the exact same column names as `ext_bodega_aurrera`
 * (BigQuery) — see docs/data-audit.md — so the BigQuery parse/derive
 * functions are reused as-is; only the row source differs.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; orders: MockOrder[] } | null = null;

export function hasSheetsSource(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

function rowsToRecords(values: string[][]): Record<string, unknown>[] {
  if (values.length < 2) return [];
  const [header, ...rows] = values;
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    header.forEach((key, i) => {
      record[key] = row[i];
    });
    return record;
  });
}

async function fetchLiveOrders(): Promise<MockOrder[]> {
  const values = await getSheetValues(RANGES.dataBA);
  const records = rowsToRecords(values);

  const parsedOrders = parseBigQueryOrders(records);
  const storeByExtId = new Map(deriveStoresFromBigQuery(records).map((s) => [s.storeExtId, s]));
  const userByEmail = new Map(deriveUsersFromBigQuery(records).map((u) => [u.email, u]));

  return parsedOrders
    .filter((o) => o.deliveryDate)
    .map((o, i) => {
      const derivedStore = o.storeExtId ? storeByExtId.get(o.storeExtId) : undefined;
      const store: MockOrder["store"] = {
        id: o.storeExtId ? `live-store-${o.storeExtId}` : "live-store-unknown",
        store_number: derivedStore?.storeNumber ?? "—",
        store_ext_id: o.storeExtId,
        name: derivedStore?.name ?? "Sin tienda",
        model: "",
        state: derivedStore?.state ?? "—",
        zone: o.zoneName || "Sin zona",
      };

      const derivedUser = o.shopperEmail ? userByEmail.get(o.shopperEmail) : undefined;
      const user: MockOrder["user"] = {
        id: o.shopperEmail ? `live-user-${o.shopperEmail}` : "live-user-unknown",
        phone: "—",
        full_name: derivedUser?.fullName || o.shopperFullName || "—",
        email: o.shopperEmail,
        store,
      };

      return {
        id: `live-order-${o.orderId}-${i}`,
        orderId: o.orderId,
        date: new Date(o.deliveryDate as string),
        slot: o.slot,
        status: o.status,
        onTime: o.onTime,
        isLate: o.isLate,
        distanceKm: o.distanceKm,
        linesRequested: o.linesRequested,
        user,
        store,
      };
    })
    .filter((o) => !Number.isNaN(o.date.getTime()));
}

export interface OperationalOrders {
  orders: MockOrder[];
  live: boolean;
}

/**
 * Never throws — any Sheets/config failure falls back to the synthetic
 * demo dataset so a broken credential can't break the page.
 */
export async function getOperationalOrders(): Promise<OperationalOrders> {
  if (!hasSheetsSource()) {
    return { orders: DEMO_ORDERS, live: false };
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { orders: cache.orders, live: true };
  }

  try {
    const orders = await fetchLiveOrders();
    if (orders.length === 0) {
      return { orders: DEMO_ORDERS, live: false };
    }
    cache = { at: Date.now(), orders };
    return { orders, live: true };
  } catch (err) {
    console.error("[operational-live-source] Sheets fetch failed, falling back to demo data:", err);
    return { orders: DEMO_ORDERS, live: false };
  }
}
