import { createServiceRoleClient } from "@/lib/supabase/server";
import { getSheetValues } from "@/lib/google/sheets-client";
import { RANGES } from "./config";
import {
  parseUsuarios,
  parseConfigTiendas,
  parseTarifaPiano,
  parseDataBA,
  parseMasterPagos,
  parseAclaracionPagos,
  parsePaymentValidation,
  parseBonosSupply,
} from "./parsers";
import {
  upsertUsers,
  upsertZones,
  upsertStores,
  upsertTariffs,
  upsertOrders,
  upsertFinanceSubmissions,
  upsertPaymentClaims,
  upsertPayments,
  upsertBonuses,
  type StepResult,
} from "./upsert";

export interface SyncStepReport {
  sheet: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  read: number;
  inserted: number;
  errors: number;
  errorDetail?: unknown;
}

export interface SyncSummary {
  startedAt: string;
  finishedAt: string;
  steps: SyncStepReport[];
  totalErrors: number;
}

async function logStep(sourceSheet: string, startedAt: string, result: StepResult) {
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

async function runStep(
  sheet: string,
  fn: () => Promise<StepResult>
): Promise<SyncStepReport> {
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    await logStep(sheet, startedAt, result);
    return {
      sheet,
      status: result.errors > 0 ? "FAILED" : "SUCCESS",
      read: result.read,
      inserted: result.inserted,
      errors: result.errors,
      errorDetail: result.errorDetail,
    };
  } catch (err) {
    const result: StepResult = { read: 0, inserted: 0, updated: 0, errors: 1, errorDetail: String(err) };
    await logStep(sheet, startedAt, result);
    return { sheet, status: "FAILED", read: 0, inserted: 0, errors: 1, errorDetail: String(err) };
  }
}

/**
 * Runs the full Google Sheets -> Supabase sync, reference tables first so
 * later steps can resolve foreign keys. Each step is logged to
 * sync_logs independently — one sheet failing doesn't stop the others.
 */
export async function runSync(): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const steps: SyncStepReport[] = [];

  const usuariosRows = await getSheetValues(RANGES.usuarios);
  const parsedUsuarios = parseUsuarios(usuariosRows);
  const usersStartedAt = new Date().toISOString();
  const usersUpsert = await upsertUsers(parsedUsuarios);
  await logStep("Usuarios", usersStartedAt, usersUpsert.result);
  steps.push({
    sheet: "Usuarios",
    status: usersUpsert.result.errors > 0 ? "FAILED" : "SUCCESS",
    read: usersUpsert.result.read,
    inserted: usersUpsert.result.inserted,
    errors: usersUpsert.result.errors,
    errorDetail: usersUpsert.result.errorDetail,
  });
  const idByEmail = new Map<string, string>();
  for (const u of parsedUsuarios) {
    const id = usersUpsert.idByPhone.get(u.phone);
    if (id && u.email) idByEmail.set(u.email.toLowerCase(), id);
  }

  const tiendasRows = await getSheetValues(RANGES.configTiendas);
  const parsedStores = parseConfigTiendas(tiendasRows);
  const storesStartedAt = new Date().toISOString();
  const storesUpsert = await upsertStores(parsedStores);
  await logStep("Configuración de Tiendas", storesStartedAt, storesUpsert.result);
  steps.push({
    sheet: "Configuración de Tiendas",
    status: storesUpsert.result.errors > 0 ? "FAILED" : "SUCCESS",
    read: storesUpsert.result.read,
    inserted: storesUpsert.result.inserted,
    errors: storesUpsert.result.errors,
    errorDetail: storesUpsert.result.errorDetail,
  });
  const storeModelByExtId = new Map(parsedStores.map((s) => [s.storeExtId, s.model]));

  const tarifaRows = await getSheetValues(RANGES.tarifaPiano);
  const parsedTariffs = parseTarifaPiano(tarifaRows);
  steps.push(await runStep("Tarifa_Piano", () => upsertTariffs(parsedTariffs)));

  const dataBARows = await getSheetValues(RANGES.dataBA);
  const parsedOrders = parseDataBA(dataBARows);
  const zoneIdByName = await upsertZones(parsedOrders.map((o) => o.zoneName));
  steps.push(
    await runStep("Data BA", () =>
      upsertOrders(parsedOrders, {
        storeIdByExtId: storesUpsert.idByExtId,
        storeModelByExtId,
        userIdByEmail: idByEmail,
        zoneIdByName,
        tariffs: parsedTariffs,
      })
    )
  );

  // order_id -> internal uuid, needed to link finance_submissions back to orders
  const supabase = createServiceRoleClient();
  const { data: orderRows } = await supabase.from("orders").select("id, order_id");
  const orderIdByOrderId = new Map<string, string>((orderRows ?? []).map((o) => [o.order_id, o.id]));

  const masterPagosRows = await getSheetValues(RANGES.masterPagos);
  const parsedSubmissions = parseMasterPagos(masterPagosRows);
  steps.push(
    await runStep("Reporte de Pagos BA-MX", () =>
      upsertFinanceSubmissions(parsedSubmissions, {
        storeIdByExtId: storesUpsert.idByExtId,
        userIdByPhone: usersUpsert.idByPhone,
        orderIdByOrderId,
      })
    )
  );

  const aclaracionRows = await getSheetValues(RANGES.aclaracionPagos);
  const parsedClaims = parseAclaracionPagos(aclaracionRows);
  steps.push(
    await runStep("Aclaración de Pagos", () =>
      upsertPaymentClaims(parsedClaims, {
        storeIdByExtId: storesUpsert.idByExtId,
        userIdByPhone: usersUpsert.idByPhone,
      })
    )
  );

  const storeIdByNameUpper = new Map(
    parsedStores.map((s) => [s.name.toUpperCase(), storesUpsert.idByExtId.get(s.storeExtId)]).filter(
      (entry): entry is [string, string] => entry[1] != null
    )
  );

  const paymentValidationRows = await getSheetValues(RANGES.paymentValidation);
  const parsedPayments = parsePaymentValidation(paymentValidationRows);
  steps.push(
    await runStep("Payment Validation (PAGADO)", () =>
      upsertPayments(parsedPayments, {
        userIdByPhone: usersUpsert.idByPhone,
        storeIdByNameUpper,
      })
    )
  );

  const bonosRows = await getSheetValues(RANGES.bonosSupply);
  const parsedBonuses = parseBonosSupply(bonosRows);
  steps.push(
    await runStep("Bonos-Supply", () =>
      upsertBonuses(parsedBonuses, {
        storeIdByExtId: storesUpsert.idByExtId,
        userIdByPhone: usersUpsert.idByPhone,
      })
    )
  );

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    totalErrors: steps.reduce((s, step) => s + step.errors, 0),
  };
}
