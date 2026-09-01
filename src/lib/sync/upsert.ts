import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ParsedUser,
  ParsedStore,
  ParsedTariff,
  ParsedOrder,
  ParsedFinanceSubmission,
  ParsedPaymentClaim,
  ParsedPaymentValidation,
  ParsedBonus,
} from "./parsers";
import type { DerivedStore, DerivedUser } from "./bigquery-parsers";

export interface StepResult {
  read: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetail?: unknown;
}

function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    if (key) map.set(key, row); // last write wins — matches "latest sync state"
  }
  return Array.from(map.values());
}

export async function upsertUsers(rows: ParsedUser[]): Promise<{ result: StepResult; idByPhone: Map<string, string> }> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => r.phone);

  const { data, error } = await supabase
    .from("users")
    .upsert(
      deduped.map((r) => ({ phone: r.phone, full_name: r.fullName || null, email: r.email || null })),
      { onConflict: "phone" }
    )
    .select("id, phone");

  const idByPhone = new Map<string, string>((data ?? []).map((u) => [u.phone, u.id]));
  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error },
    idByPhone,
  };
}

/**
 * Users derived from BigQuery orders (email only, no phone) — upserts on
 * email instead of phone, since that natural key isn't available from
 * this source. See 0005_operational_sync.sql (phone is nullable now).
 */
export async function upsertUsersFromBigQuery(
  rows: DerivedUser[]
): Promise<{ result: StepResult; idByEmail: Map<string, string> }> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => r.email);

  const { data, error } = await supabase
    .from("users")
    .upsert(
      deduped.map((r) => ({ email: r.email, full_name: r.fullName || null })),
      { onConflict: "email" }
    )
    .select("id, email");

  const idByEmail = new Map<string, string>((data ?? []).map((u) => [u.email, u.id]));
  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error },
    idByEmail,
  };
}

/**
 * Stores derived from BigQuery orders (no tariff model / parking info —
 * that only lives in the paused Configuración de Tiendas sheet).
 */
export async function upsertStoresFromBigQuery(
  rows: DerivedStore[]
): Promise<{ result: StepResult; idByExtId: Map<string, string> }> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => r.storeExtId);

  const { data, error } = await supabase
    .from("stores")
    .upsert(
      deduped.map((r) => ({
        store_number: r.storeNumber,
        store_ext_id: r.storeExtId,
        name: r.name,
        state: r.state,
      })),
      { onConflict: "store_ext_id" }
    )
    .select("id, store_ext_id");

  const idByExtId = new Map<string, string>((data ?? []).map((s) => [s.store_ext_id, s.id]));
  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error },
    idByExtId,
  };
}

export async function upsertZones(names: string[]): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient();
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("zones")
    .upsert(
      unique.map((name) => ({ name })),
      { onConflict: "name" }
    )
    .select("id, name");

  return new Map((data ?? []).map((z) => [z.name, z.id]));
}

export async function upsertStores(
  rows: ParsedStore[]
): Promise<{ result: StepResult; idByExtId: Map<string, string> }> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => r.storeExtId);

  const { data, error } = await supabase
    .from("stores")
    .upsert(
      deduped.map((r) => ({
        store_number: r.storeNumber,
        store_ext_id: r.storeExtId,
        name: r.name,
        tariff_model: r.model,
        charges_parking: r.chargesParking,
        parking_amount: r.parkingAmount,
      })),
      { onConflict: "store_ext_id" }
    )
    .select("id, store_ext_id");

  const idByExtId = new Map<string, string>((data ?? []).map((s) => [s.store_ext_id, s.id]));
  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error },
    idByExtId,
  };
}

export async function upsertTariffs(rows: ParsedTariff[]): Promise<StepResult> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(
    rows,
    (r) => `${r.model}|${r.linesMin}|${r.linesMax}|${r.kmMin}|${r.kmMax}`
  );

  const { error } = await supabase.from("tariffs").upsert(
    deduped.map((r) => ({
      model: r.model,
      lines_min: r.linesMin,
      lines_max: r.linesMax,
      km_min: r.kmMin,
      km_max: r.kmMax,
      amount: r.amount,
    })),
    { onConflict: "model,lines_min,lines_max,km_min,km_max" }
  );

  return { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error };
}

function findTariffAmount(
  tariffs: ParsedTariff[],
  model: string,
  lines: number,
  km: number
): number | null {
  const match = tariffs.find(
    (t) => t.model === model && lines >= t.linesMin && lines <= t.linesMax && km >= t.kmMin && km <= t.kmMax
  );
  return match ? match.amount : null;
}

export async function upsertOrders(
  rows: ParsedOrder[],
  ctx: {
    storeIdByExtId: Map<string, string>;
    storeModelByExtId: Map<string, string>;
    userIdByEmail: Map<string, string>;
    zoneIdByName: Map<string, string>;
    tariffs: ParsedTariff[];
  }
): Promise<StepResult> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => r.orderId);

  const payload = deduped.map((r) => {
    const model = ctx.storeModelByExtId.get(r.storeExtId);
    const generatedAmount =
      model != null ? findTariffAmount(ctx.tariffs, model, r.linesRequested, r.distanceKm) : null;

    return {
      order_id: r.orderId,
      status: r.status,
      store_id: ctx.storeIdByExtId.get(r.storeExtId) ?? null,
      delivery_date: r.deliveryDate,
      slot: r.slot,
      on_time: r.onTime,
      distance_km: r.distanceKm,
      user_id: ctx.userIdByEmail.get(r.shopperEmail) ?? null,
      lines_requested: r.linesRequested,
      is_late: r.isLate,
      zone_id: ctx.zoneIdByName.get(r.zoneName) ?? null,
      clean_date: r.cleanDate,
      generated_amount: generatedAmount,
    };
  });

  const { error } = await supabase.from("orders").upsert(payload, { onConflict: "order_id" });

  return { read: rows.length, inserted: deduped.length, updated: 0, errors: error ? 1 : 0, errorDetail: error };
}

// "Task: <order_id> dd/mm" — see docs/data-audit.md
function extractOrderIdFromDescription(description: string): string | null {
  const match = description.match(/Task:\s*(\S+)/i);
  return match ? match[1] : null;
}

export async function upsertFinanceSubmissions(
  rows: ParsedFinanceSubmission[],
  ctx: {
    storeIdByExtId: Map<string, string>;
    userIdByPhone: Map<string, string>;
    orderIdByOrderId: Map<string, string>;
  }
): Promise<StepResult> {
  const supabase = createServiceRoleClient();

  const payload = rows.map((r) => {
    const refOrderId = extractOrderIdFromDescription(r.description);
    return {
      submitted_date: r.submittedDate,
      store_id: ctx.storeIdByExtId.get(r.storeExtId) ?? null,
      user_id: ctx.userIdByPhone.get(r.userPhone) ?? null,
      description: r.description,
      amount: r.amount,
      tariff_model: r.model,
      master_pagos_approved: r.masterPagosApproved,
      order_id: refOrderId ? ctx.orderIdByOrderId.get(refOrderId) ?? null : null,
      raw_row: r,
    };
  });

  // No stable natural key spans the sheet reliably (no explicit row id),
  // so this step re-inserts on every sync rather than upserting — dedupe
  // happens at read time in getOverviewData/getPayments via order_id
  // linkage. Revisit once the sheet gets a stable per-row id column.
  const { error } = await supabase.from("finance_submissions").insert(payload);

  return { read: rows.length, inserted: payload.length, updated: 0, errors: error ? 1 : 0, errorDetail: error };
}

export async function upsertPaymentClaims(
  rows: ParsedPaymentClaim[],
  ctx: { storeIdByExtId: Map<string, string>; userIdByPhone: Map<string, string> }
): Promise<StepResult> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => `${r.folio}|${r.submittedAt}`);

  const payload = deduped.map((r) => ({
    submitted_at: r.submittedAt,
    claim_date: r.claimDate,
    folio: r.folio,
    user_phone: r.userPhone,
    evidence_url: r.evidenceUrl,
    status: r.status,
    db_date: r.dbDate,
    proceeds: r.proceeds,
    store_id: ctx.storeIdByExtId.get(r.storeExtId) ?? null,
    db_phone: r.dbPhone,
    description: r.description,
    amount: r.amount,
    send_status: r.sendStatus,
    paid_in_master: r.paidInMaster,
    comments: r.comments,
    user_id: ctx.userIdByPhone.get(r.userPhone) ?? ctx.userIdByPhone.get(r.dbPhone) ?? null,
  }));

  const { error } = await supabase.from("payment_claims").insert(payload);

  return { read: rows.length, inserted: payload.length, updated: 0, errors: error ? 1 : 0, errorDetail: error };
}

export async function upsertPayments(
  rows: ParsedPaymentValidation[],
  ctx: { userIdByPhone: Map<string, string>; storeIdByNameUpper: Map<string, string> }
): Promise<StepResult> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => `${r.userPhone}|${r.task}`);

  // Payment Validation already reconciles 1st + 2nd = Total per Match — so
  // one validated record becomes up to two payments rows, one per round,
  // splitting only the amounts that are actually non-zero. The whole
  // record's adjustment is attached to round 2 (adjustments are applied
  // at the reconciliation/2nd-payment stage in the source sheet).
  const payload: Record<string, unknown>[] = [];
  for (const r of deduped) {
    const userId = ctx.userIdByPhone.get(r.userPhone) ?? null;
    const storeId = ctx.storeIdByNameUpper.get(r.storeName.toUpperCase()) ?? null;
    const base = {
      user_id: userId,
      store_id: storeId,
      period_label: null,
      task_ref: r.task,
      matched: r.matched,
      raw_row: r,
    };
    if (r.firstPayment !== 0) {
      payload.push({ ...base, payment_round: 1, amount: r.firstPayment, adjustment: 0 });
    }
    if (r.secondPayment !== 0) {
      payload.push({ ...base, payment_round: 2, amount: r.secondPayment, adjustment: r.adjustment });
    }
  }

  const withUser = payload.filter((p) => p.user_id != null);
  const { error } = withUser.length ? await supabase.from("payments").insert(withUser) : { error: null };

  return {
    read: rows.length,
    inserted: withUser.length,
    updated: 0,
    errors: error ? 1 : 0,
    errorDetail: error,
  };
}

export async function upsertBonuses(
  rows: ParsedBonus[],
  ctx: { storeIdByExtId: Map<string, string>; userIdByPhone: Map<string, string> }
): Promise<StepResult> {
  const supabase = createServiceRoleClient();
  const deduped = dedupeByKey(rows, (r) => `${r.userPhone}|${r.bonusDate}|${r.typo}|${r.description}`);

  const payload = deduped.map((r) => ({
    bonus_date: r.bonusDate,
    week_service: r.weekService || null,
    brand: r.brand,
    area: r.area || null,
    owner: r.owner || null,
    typo: r.typo,
    store_id: ctx.storeIdByExtId.get(r.storeExtId) ?? null,
    user_id: ctx.userIdByPhone.get(r.userPhone) ?? null,
    description: r.description || null,
    amount: r.amount,
    payment_checked: r.paymentChecked,
    ot: r.ot || null,
    validation: r.validation || null,
    comments: r.comments || null,
    raw_row: r,
  }));

  // Same as finance_submissions/payment_claims — no stable per-row id in
  // the sheet, so this re-inserts on every sync rather than upserting.
  const { error } = payload.length ? await supabase.from("bonuses").insert(payload) : { error: null };

  return { read: rows.length, inserted: payload.length, updated: 0, errors: error ? 1 : 0, errorDetail: error };
}
