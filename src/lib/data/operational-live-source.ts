import { getSheetValues } from "@/lib/google/sheets-client";
import { RANGES } from "@/lib/sync/config";
import {
  parseBigQueryOrders,
  deriveStoresFromBigQuery,
  deriveUsersFromBigQuery,
} from "@/lib/sync/bigquery-parsers";
import { ORDERS as DEMO_ORDERS, type MockOrder } from "./mock-dataset";

/**
 * No-Cloud-SQL data paths for Analytics — two ways in, same output shape:
 *
 * - Direct read (`hasSheetsSource` / `fetchLiveOrders`): the app itself
 *   reads "Data BA" with a Google service account. Needs
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, which TechOps hasn't been
 *   able to provide (no IAM access to create/share one).
 * - Webhook-fed (`setWebhookOrders` / `getWebhookOrders`): n8n reads the
 *   sheet with its own Google login and POSTs the rows to
 *   /api/webhooks/n8n-sync, same as it would for the Cloud-SQL path — but
 *   when there's no DATABASE_URL, that route stores them here instead of
 *   erroring. No service account, no database, at the cost of the cache
 *   living only in the Cloud Run instance that received the POST (fine
 *   for a low-traffic POC; not a substitute for real persistence).
 *
 * Once DATABASE_URL is set, neither path is used — analytics.ts's
 * live-mode branch (Prisma) takes over.
 *
 * Data BA / ext_bodega_aurrera (BigQuery) share the exact same column
 * names (see docs/data-audit.md), so the BigQuery parse/derive functions
 * are reused as-is for both paths; only the row source differs.
 */

const SHEETS_CACHE_TTL_MS = 10 * 60 * 1000;
let sheetsCache: { at: number; orders: MockOrder[] } | null = null;

// Longer-lived: this is only refreshed when n8n's schedule fires (every
// 30-60 min per docs/n8n-workflow.md), not on every request — stale data
// past a few hours means the n8n workflow itself stopped running.
const WEBHOOK_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// n8n sends one sync run as many sequential POSTs (one per 2000-row
// batch — 94,953 rows is ~48 calls). Each call only carries its own
// batch, so we upsert by orderId into a running map instead of replacing
// the cache outright (which would leave only the last batch behind). A
// gap of more than a couple minutes since the last POST is treated as
// the start of a new run, and the map is reset first — otherwise orders
// that disappeared from the sheet between runs would linger forever.
const WEBHOOK_NEW_RUN_GAP_MS = 2 * 60 * 1000;
let webhookOrdersById = new Map<string, MockOrder>();
let webhookLastWriteAt = 0;

export function hasSheetsSource(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

export function setWebhookOrders(orders: MockOrder[]) {
  const now = Date.now();
  if (now - webhookLastWriteAt > WEBHOOK_NEW_RUN_GAP_MS) {
    webhookOrdersById = new Map();
  }
  for (const order of orders) {
    webhookOrdersById.set(order.orderId, order);
  }
  webhookLastWriteAt = now;
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

/**
 * Shared by both data paths: turns raw Data BA / ext_bodega_aurrera rows
 * into the MockOrder shape Analytics already consumes.
 */
export function mapRecordsToOrders(records: Record<string, unknown>[]): MockOrder[] {
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

async function fetchLiveOrders(): Promise<MockOrder[]> {
  const values = await getSheetValues(RANGES.dataBA);
  return mapRecordsToOrders(rowsToRecords(values));
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
  if (webhookOrdersById.size > 0 && Date.now() - webhookLastWriteAt < WEBHOOK_CACHE_MAX_AGE_MS) {
    return { orders: Array.from(webhookOrdersById.values()), live: true };
  }

  if (!hasSheetsSource()) {
    return { orders: DEMO_ORDERS, live: false };
  }

  if (sheetsCache && Date.now() - sheetsCache.at < SHEETS_CACHE_TTL_MS) {
    return { orders: sheetsCache.orders, live: true };
  }

  try {
    const orders = await fetchLiveOrders();
    if (orders.length === 0) {
      return { orders: DEMO_ORDERS, live: false };
    }
    sheetsCache = { at: Date.now(), orders };
    return { orders, live: true };
  } catch (err) {
    console.error("[operational-live-source] Sheets fetch failed, falling back to demo data:", err);
    return { orders: DEMO_ORDERS, live: false };
  }
}
