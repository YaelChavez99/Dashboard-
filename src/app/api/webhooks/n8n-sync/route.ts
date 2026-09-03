import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/data/demo-mode";
import { parseBigQueryOrders, deriveStoresFromBigQuery, deriveUsersFromBigQuery } from "@/lib/sync/bigquery-parsers";
import { upsertUsersFromBigQuery, upsertStoresFromBigQuery, upsertZones, upsertOrders } from "@/lib/sync/upsert";

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
 * Server-to-server webhook for n8n — pushes rows from BigQuery/Google
 * Sheets straight into the app, sidestepping the need for this app to
 * hold its own BigQuery credentials (n8n runs with TechOps' own GCP
 * access instead). Same row shape and parse/upsert pipeline as the
 * manual CSV upload (src/app/api/sync/upload-csv/route.ts) and the
 * BigQuery-direct sync (src/lib/sync/run-operational-sync.ts) — only
 * the transport and auth differ.
 *
 * Auth: shared-secret header, not a user session — n8n can't do an
 * interactive Google Workspace login. Set N8N_WEBHOOK_SECRET (Passbolt)
 * and have n8n send it as `Authorization: Bearer <secret>`.
 */
export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "No hay una base de datos conectada — configura DATABASE_URL antes de sincronizar." },
      { status: 400 }
    );
  }

  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "N8N_WEBHOOK_SECRET no está configurado en el servidor." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: { source?: string; rows?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida: se esperaba JSON." }, { status: 400 });
  }

  const rawRows = body.rows;
  const sourceLabel = `n8n: ${body.source || "ext_bodega_aurrera"}`;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: "No se recibieron filas." }, { status: 400 });
  }
  if (rawRows[0].ORDER_ID === undefined) {
    return NextResponse.json(
      {
        error:
          "Las filas no tienen la columna ORDER_ID — deben tener las mismas columnas que " +
          "ext_bodega_aurrera (ORDER_ID, STATUS, STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, " +
          "SLOT, ON_TIME, DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL, NO_LINES_REQUESTED, " +
          "STORE_ID, PEDIDOS_LATE, ZONA_CLASIFICACION, FECHA_LIMPIA).",
      },
      { status: 400 }
    );
  }

  try {
    const derivedUsers = deriveUsersFromBigQuery(rawRows);
    const usersStartedAt = new Date().toISOString();
    const usersUpsert = await upsertUsersFromBigQuery(derivedUsers);
    await logStep(`${sourceLabel} — usuarios`, usersStartedAt, usersUpsert.result);

    const derivedStores = deriveStoresFromBigQuery(rawRows);
    const storesStartedAt = new Date().toISOString();
    const storesUpsert = await upsertStoresFromBigQuery(derivedStores);
    await logStep(`${sourceLabel} — tiendas`, storesStartedAt, storesUpsert.result);

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
    await logStep(sourceLabel, ordersStartedAt, ordersResult);

    return NextResponse.json({
      rowsRead: rawRows.length,
      usersUpserted: usersUpsert.result.inserted,
      storesUpserted: storesUpsert.result.inserted,
      ordersUpserted: ordersResult.inserted,
      errors: usersUpsert.result.errors + storesUpsert.result.errors + ordersResult.errors,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
