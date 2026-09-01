import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

import { getCurrentUser } from "@/lib/data/current-user";
import { isDemoMode } from "@/lib/data/demo-mode";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseBigQueryOrders, deriveStoresFromBigQuery, deriveUsersFromBigQuery } from "@/lib/sync/bigquery-parsers";
import { upsertUsersFromBigQuery, upsertStoresFromBigQuery, upsertZones, upsertOrders } from "@/lib/sync/upsert";

async function logStep(sourceSheet: string, startedAt: string, result: { read: number; inserted: number; updated: number; errors: number; errorDetail?: unknown }) {
  const supabase = createServiceRoleClient();
  await supabase.from("sync_logs").insert({
    source_sheet: sourceSheet,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: result.errors > 0 ? "FAILED" : "SUCCESS",
    records_read: result.read,
    records_inserted: result.inserted,
    records_updated: result.updated,
    errors_count: result.errors,
    error_detail: result.errorDetail ?? null,
  });
}

export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "No hay un proyecto Supabase conectado — configura .env.local antes de cargar un CSV." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user || user.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede cargar datos." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: `Error leyendo el CSV: ${parsed.errors[0].message} (fila ${parsed.errors[0].row})` },
      { status: 400 }
    );
  }

  const rawRows = parsed.data;
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "El archivo no tiene filas de datos." }, { status: 400 });
  }
  if (rawRows[0].ORDER_ID === undefined) {
    return NextResponse.json(
      {
        error:
          "El CSV no tiene la columna ORDER_ID — debe ser un export directo de ext_bodega_aurrera " +
          "(mismas columnas: ORDER_ID, STATUS, STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, SLOT, " +
          "ON_TIME, DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL, NO_LINES_REQUESTED, STORE_ID, " +
          "PEDIDOS_LATE, ZONA_CLASIFICACION, FECHA_LIMPIA).",
      },
      { status: 400 }
    );
  }

  try {
    const sourceLabel = `CSV: ${file.name}`;

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
      fileName: file.name,
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
