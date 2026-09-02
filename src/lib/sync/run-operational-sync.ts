import { queryBigQuery } from "@/lib/google/bigquery-client";
import { parseBigQueryOrders, deriveStoresFromBigQuery, deriveUsersFromBigQuery } from "./bigquery-parsers";
import { upsertUsersFromBigQuery, upsertStoresFromBigQuery, upsertZones, upsertOrders } from "./upsert";
import type { SyncStepReport, SyncSummary } from "./run-sync";
import { db } from "@/lib/db";

const BIGQUERY_TABLE = "ext_bodega_aurrera";

async function logStep(sourceSheet: string, startedAt: string, result: { read: number; inserted: number; updated: number; errors: number; errorDetail?: unknown }) {
  await db.syncLog.create({
    data: {
      source_sheet: sourceSheet,
      started_at: new Date(startedAt),
      finished_at: new Date(),
      status: result.errors > 0 ? "FAILED" : "SUCCESS",
      records_read: result.read,
      records_inserted: result.inserted,
      records_updated: result.updated,
      errors_count: result.errors,
      error_detail: result.errorDetail != null ? JSON.stringify(result.errorDetail) : null,
    },
  });
}

/**
 * Operational-only sync: pulls orders straight from BigQuery
 * (ext_bodega_aurrera, already fed by the company's own Sheets -> BigQuery
 * pipeline) instead of the Google Sheets API. Stores and users are derived
 * from the same rows — no Usuarios/Configuración de Tiendas source needed.
 *
 * Deliberately doesn't touch finance_submissions/payment_claims/payments/
 * bonuses — that data still lives only in the raw Sheet (Master Pagos,
 * Aclaración de Pagos, Payment Validation, Bonos-Supply), which the
 * service account doesn't have Sheets API access to yet. See
 * src/lib/sync/run-sync.ts for that path once it's re-enabled.
 */
export async function runOperationalSync(days = 180): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const steps: SyncStepReport[] = [];

  const projectId = process.env.BIGQUERY_PROJECT_ID;
  const dataset = process.env.BIGQUERY_DATASET;
  if (!projectId || !dataset) {
    throw new Error("BIGQUERY_PROJECT_ID / BIGQUERY_DATASET missing — see .env.example.");
  }

  const sql = `
    SELECT *
    FROM \`${projectId}.${dataset}.${BIGQUERY_TABLE}\`
    WHERE DELIVERY_DATE >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
  `;
  const rawRows = await queryBigQuery(sql);

  const derivedUsers = deriveUsersFromBigQuery(rawRows);
  const usersStartedAt = new Date().toISOString();
  const usersUpsert = await upsertUsersFromBigQuery(derivedUsers);
  await logStep("BigQuery: usuarios (derivado)", usersStartedAt, usersUpsert.result);
  steps.push({
    sheet: "Usuarios (derivado de BigQuery)",
    status: usersUpsert.result.errors > 0 ? "FAILED" : "SUCCESS",
    read: usersUpsert.result.read,
    inserted: usersUpsert.result.inserted,
    errors: usersUpsert.result.errors,
    errorDetail: usersUpsert.result.errorDetail,
  });

  const derivedStores = deriveStoresFromBigQuery(rawRows);
  const storesStartedAt = new Date().toISOString();
  const storesUpsert = await upsertStoresFromBigQuery(derivedStores);
  await logStep("BigQuery: tiendas (derivado)", storesStartedAt, storesUpsert.result);
  steps.push({
    sheet: "Tiendas (derivado de BigQuery)",
    status: storesUpsert.result.errors > 0 ? "FAILED" : "SUCCESS",
    read: storesUpsert.result.read,
    inserted: storesUpsert.result.inserted,
    errors: storesUpsert.result.errors,
    errorDetail: storesUpsert.result.errorDetail,
  });

  const parsedOrders = parseBigQueryOrders(rawRows);
  const zoneIdByName = await upsertZones(parsedOrders.map((o) => o.zoneName));

  const ordersStartedAt = new Date().toISOString();
  const ordersResult = await upsertOrders(parsedOrders, {
    storeIdByExtId: storesUpsert.idByExtId,
    storeModelByExtId: new Map(),
    userIdByEmail: usersUpsert.idByEmail,
    zoneIdByName,
    tariffs: [],
  });
  await logStep("ext_bodega_aurrera (BigQuery)", ordersStartedAt, ordersResult);
  steps.push({
    sheet: "Órdenes (ext_bodega_aurrera / BigQuery)",
    status: ordersResult.errors > 0 ? "FAILED" : "SUCCESS",
    read: ordersResult.read,
    inserted: ordersResult.inserted,
    errors: ordersResult.errors,
    errorDetail: ordersResult.errorDetail,
  });

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    totalErrors: steps.reduce((s, step) => s + step.errors, 0),
  };
}
