import { db } from "@/lib/db";
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
  const deduped = dedupeByKey(rows, (r) => r.phone);
  const idByPhone = new Map<string, string>();
  let errorDetail: unknown;

  try {
    const results = await db.$transaction(
      deduped.map((r) =>
        db.appUser.upsert({
          where: { phone: r.phone },
          update: { full_name: r.fullName || null, email: r.email || null },
          create: { phone: r.phone, full_name: r.fullName || null, email: r.email || null },
        })
      )
    );
    for (const u of results) if (u.phone) idByPhone.set(u.phone, u.id);
  } catch (err) {
    errorDetail = String(err);
  }

  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail },
    idByPhone,
  };
}

/**
 * Users derived from BigQuery orders (email only, no phone) — upserts on
 * email instead of phone, since that natural key isn't available from
 * this source. See prisma/schema.prisma (phone is optional).
 */
export async function upsertUsersFromBigQuery(
  rows: DerivedUser[]
): Promise<{ result: StepResult; idByEmail: Map<string, string> }> {
  const deduped = dedupeByKey(rows, (r) => r.email);
  const idByEmail = new Map<string, string>();
  let errorDetail: unknown;

  try {
    const results = await db.$transaction(
      deduped.map((r) =>
        db.appUser.upsert({
          where: { email: r.email },
          update: { full_name: r.fullName || null },
          create: { email: r.email, full_name: r.fullName || null },
        })
      )
    );
    for (const u of results) if (u.email) idByEmail.set(u.email, u.id);
  } catch (err) {
    errorDetail = String(err);
  }

  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail },
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
  const deduped = dedupeByKey(rows, (r) => r.storeExtId);
  const idByExtId = new Map<string, string>();
  let errorDetail: unknown;

  try {
    const results = await db.$transaction(
      deduped.map((r) =>
        db.store.upsert({
          where: { store_ext_id: r.storeExtId },
          update: { store_number: r.storeNumber, name: r.name, state: r.state },
          create: { store_number: r.storeNumber, store_ext_id: r.storeExtId, name: r.name, state: r.state },
        })
      )
    );
    for (const s of results) idByExtId.set(s.store_ext_id, s.id);
  } catch (err) {
    errorDetail = String(err);
  }

  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail },
    idByExtId,
  };
}

export async function upsertZones(names: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const results = await db.$transaction(
    unique.map((name) => db.zone.upsert({ where: { name }, update: {}, create: { name } }))
  );

  return new Map(results.map((z) => [z.name, z.id]));
}

export async function upsertStores(
  rows: ParsedStore[]
): Promise<{ result: StepResult; idByExtId: Map<string, string> }> {
  const deduped = dedupeByKey(rows, (r) => r.storeExtId);
  const idByExtId = new Map<string, string>();
  let errorDetail: unknown;

  try {
    const results = await db.$transaction(
      deduped.map((r) =>
        db.store.upsert({
          where: { store_ext_id: r.storeExtId },
          update: {
            store_number: r.storeNumber,
            name: r.name,
            tariff_model: r.model,
            charges_parking: r.chargesParking,
            parking_amount: r.parkingAmount,
          },
          create: {
            store_number: r.storeNumber,
            store_ext_id: r.storeExtId,
            name: r.name,
            tariff_model: r.model,
            charges_parking: r.chargesParking,
            parking_amount: r.parkingAmount,
          },
        })
      )
    );
    for (const s of results) idByExtId.set(s.store_ext_id, s.id);
  } catch (err) {
    errorDetail = String(err);
  }

  return {
    result: { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail },
    idByExtId,
  };
}

export async function upsertTariffs(rows: ParsedTariff[]): Promise<StepResult> {
  const deduped = dedupeByKey(
    rows,
    (r) => `${r.model}|${r.linesMin}|${r.linesMax}|${r.kmMin}|${r.kmMax}`
  );
  let errorDetail: unknown;

  try {
    await db.$transaction(
      deduped.map((r) =>
        db.tariff.upsert({
          where: {
            model_lines_min_lines_max_km_min_km_max: {
              model: r.model,
              lines_min: r.linesMin,
              lines_max: r.linesMax,
              km_min: r.kmMin,
              km_max: r.kmMax,
            },
          },
          update: { amount: r.amount },
          create: {
            model: r.model,
            lines_min: r.linesMin,
            lines_max: r.linesMax,
            km_min: r.kmMin,
            km_max: r.kmMax,
            amount: r.amount,
          },
        })
      )
    );
  } catch (err) {
    errorDetail = String(err);
  }

  return { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail };
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
  const deduped = dedupeByKey(rows, (r) => r.orderId);
  let errorDetail: unknown;

  try {
    await db.$transaction(
      deduped.map((r) => {
        const model = ctx.storeModelByExtId.get(r.storeExtId);
        const generatedAmount =
          model != null ? findTariffAmount(ctx.tariffs, model, r.linesRequested, r.distanceKm) : null;
        const storeId = ctx.storeIdByExtId.get(r.storeExtId) ?? null;
        const userId = ctx.userIdByEmail.get(r.shopperEmail) ?? null;
        const zoneId = ctx.zoneIdByName.get(r.zoneName) ?? null;

        const data = {
          status: r.status,
          store_id: storeId,
          delivery_date: r.deliveryDate ? new Date(r.deliveryDate) : null,
          slot: r.slot,
          on_time: r.onTime,
          distance_km: r.distanceKm,
          user_id: userId,
          lines_requested: r.linesRequested,
          is_late: r.isLate,
          zone_id: zoneId,
          clean_date: r.cleanDate ? new Date(r.cleanDate) : null,
          generated_amount: generatedAmount,
        };

        return db.order.upsert({
          where: { order_id: r.orderId },
          update: data,
          create: { order_id: r.orderId, ...data },
        });
      })
    );
  } catch (err) {
    errorDetail = String(err);
  }

  return { read: rows.length, inserted: deduped.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail };
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
  const payload = rows.map((r) => {
    const refOrderId = extractOrderIdFromDescription(r.description);
    return {
      submitted_date: new Date(r.submittedDate),
      store_id: ctx.storeIdByExtId.get(r.storeExtId) ?? null,
      user_id: ctx.userIdByPhone.get(r.userPhone) ?? null,
      description: r.description,
      amount: r.amount,
      tariff_model: r.model,
      master_pagos_approved: r.masterPagosApproved,
      order_id: refOrderId ? ctx.orderIdByOrderId.get(refOrderId) ?? null : null,
      raw_row: JSON.stringify(r),
    };
  });

  // No stable natural key spans the sheet reliably (no explicit row id),
  // so this step re-inserts on every sync rather than upserting — dedupe
  // happens at read time via order_id linkage. Revisit once the sheet
  // gets a stable per-row id column.
  let errorDetail: unknown;
  try {
    if (payload.length) await db.financeSubmission.createMany({ data: payload });
  } catch (err) {
    errorDetail = String(err);
  }

  return { read: rows.length, inserted: payload.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail };
}

export async function upsertPaymentClaims(
  rows: ParsedPaymentClaim[],
  ctx: { storeIdByExtId: Map<string, string>; userIdByPhone: Map<string, string> }
): Promise<StepResult> {
  const deduped = dedupeByKey(rows, (r) => `${r.folio}|${r.submittedAt}`);

  const payload = deduped.map((r) => ({
    submitted_at: new Date(r.submittedAt),
    claim_date: r.claimDate ? new Date(r.claimDate) : null,
    folio: r.folio,
    user_phone: r.userPhone,
    evidence_url: r.evidenceUrl,
    status: r.status,
    db_date: r.dbDate ? new Date(r.dbDate) : null,
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

  let errorDetail: unknown;
  try {
    if (payload.length) await db.paymentClaim.createMany({ data: payload });
  } catch (err) {
    errorDetail = String(err);
  }

  return { read: rows.length, inserted: payload.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail };
}

export async function upsertPayments(
  rows: ParsedPaymentValidation[],
  ctx: { userIdByPhone: Map<string, string>; storeIdByNameUpper: Map<string, string> }
): Promise<StepResult> {
  const deduped = dedupeByKey(rows, (r) => `${r.userPhone}|${r.task}`);

  // Payment Validation already reconciles 1st + 2nd = Total per Match — so
  // one validated record becomes up to two payments rows, one per round,
  // splitting only the amounts that are actually non-zero. The whole
  // record's adjustment is attached to round 2 (adjustments are applied
  // at the reconciliation/2nd-payment stage in the source sheet).
  const payload: {
    user_id: string;
    store_id: string | null;
    period_label: null;
    task_ref: string;
    matched: boolean;
    raw_row: string;
    payment_round: number;
    amount: number;
    adjustment: number;
  }[] = [];

  for (const r of deduped) {
    const userId = ctx.userIdByPhone.get(r.userPhone);
    if (!userId) continue;
    const storeId = ctx.storeIdByNameUpper.get(r.storeName.toUpperCase()) ?? null;
    const base = {
      user_id: userId,
      store_id: storeId,
      period_label: null as null,
      task_ref: r.task,
      matched: r.matched ?? false,
      raw_row: JSON.stringify(r),
    };
    if (r.firstPayment !== 0) {
      payload.push({ ...base, payment_round: 1, amount: r.firstPayment, adjustment: 0 });
    }
    if (r.secondPayment !== 0) {
      payload.push({ ...base, payment_round: 2, amount: r.secondPayment, adjustment: r.adjustment });
    }
  }

  let errorDetail: unknown;
  try {
    if (payload.length) await db.payment.createMany({ data: payload });
  } catch (err) {
    errorDetail = String(err);
  }

  return {
    read: rows.length,
    inserted: payload.length,
    updated: 0,
    errors: errorDetail ? 1 : 0,
    errorDetail,
  };
}

export async function upsertBonuses(
  rows: ParsedBonus[],
  ctx: { storeIdByExtId: Map<string, string>; userIdByPhone: Map<string, string> }
): Promise<StepResult> {
  const deduped = dedupeByKey(rows, (r) => `${r.userPhone}|${r.bonusDate}|${r.typo}|${r.description}`);

  const payload = deduped.map((r) => ({
    bonus_date: new Date(r.bonusDate),
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
    raw_row: JSON.stringify(r),
  }));

  // Same as finance_submissions/payment_claims — no stable per-row id in
  // the sheet, so this re-inserts on every sync rather than upserting.
  let errorDetail: unknown;
  try {
    if (payload.length) await db.bonus.createMany({ data: payload });
  } catch (err) {
    errorDetail = String(err);
  }

  return { read: rows.length, inserted: payload.length, updated: 0, errors: errorDetail ? 1 : 0, errorDetail };
}
