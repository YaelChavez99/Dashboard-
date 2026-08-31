import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./demo-mode";
import { TRANSACTIONS } from "./mock-dataset";
import type { ReconciliationStatus } from "@/types/database";

export interface ReconciliationRowView {
  id: string;
  userName: string;
  storeName: string;
  orderRef: string;
  date: string;
  generated: number;
  submitted: number;
  paid: number;
  difference: number;
  status: ReconciliationStatus;
}

export interface ReconciliationResult {
  rows: ReconciliationRowView[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ReconciliationStatus, number>;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);

function buildRows(): ReconciliationRowView[] {
  return TRANSACTIONS.map((t) => {
    let status: ReconciliationStatus;
    let paid = t.paid;
    const submitted = t.submitted;

    if (t.status === "RECHAZADO") {
      status = "SIN_MATCH";
    } else if (t.status === "GENERADO" || t.status === "PENDIENTE") {
      status = "PENDIENTE";
    } else if (t.status === "ENVIADO_A_FINANZAS" || t.status === "EN_PROCESO") {
      status = "PENDIENTE";
    } else {
      // PAGADO — inject occasional discrepancies/duplicates for realism
      const roll = rand();
      if (roll < 0.03) {
        paid = Math.round(t.paid * 0.85);
        status = "DIFERENCIA";
      } else if (roll < 0.05) {
        status = "DUPLICADO";
      } else {
        status = "CONCILIADO";
      }
    }

    return {
      id: t.id,
      userName: t.user.full_name,
      storeName: t.store.name,
      orderRef: t.id.toUpperCase(),
      date: t.date.toISOString(),
      generated: t.generated,
      submitted,
      paid,
      difference: submitted - paid,
      status,
    };
  });
}

export async function getReconciliation(params: {
  status?: ReconciliationStatus;
  page?: number;
  pageSize?: number;
}): Promise<ReconciliationResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  if (isDemoMode()) {
    const all = buildRows();
    const counts = countByStatus(all);

    let rows = all;
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    rows = rows.sort((a, b) => (a.date < b.date ? 1 : -1));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize, counts };
  }

  // Live mode: reconciliation is a materialized comparison best computed in
  // Postgres (see 0002_views.sql) once real submission/payment data exists.
  const supabase = await createClient();
  let query = supabase
    .from("reconciliation")
    .select("*", { count: "exact" })
    .order("computed_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (params.status) query = query.eq("status", params.status);
  const { data, count } = await query;

  const rows: ReconciliationRowView[] = (data ?? []).map((r) => ({
    id: r.id,
    userName: r.user_id,
    storeName: r.store_id,
    orderRef: r.order_id ?? "—",
    date: r.computed_at,
    generated: r.generated_amount,
    submitted: r.submitted_amount,
    paid: r.paid_amount,
    difference: r.difference,
    status: r.status,
  }));

  return {
    rows,
    total: count ?? 0,
    page,
    pageSize,
    counts: { CONCILIADO: 0, PENDIENTE: 0, DIFERENCIA: 0, DUPLICADO: 0, SIN_MATCH: 0 },
  };
}

function countByStatus(rows: ReconciliationRowView[]): Record<ReconciliationStatus, number> {
  const counts: Record<ReconciliationStatus, number> = {
    CONCILIADO: 0,
    PENDIENTE: 0,
    DIFERENCIA: 0,
    DUPLICADO: 0,
    SIN_MATCH: 0,
  };
  for (const r of rows) counts[r.status]++;
  return counts;
}
