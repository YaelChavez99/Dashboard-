import { db } from "@/lib/db";
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

  // Live mode: reconciliation is a materialized comparison best computed
  // in a SQL Server view once real submission/payment data exists.
  const [rowsData, total, countRows] = await Promise.all([
    db.reconciliation.findMany({
      where: params.status ? { status: params.status } : undefined,
      include: { user: true, store: true, order: true },
      orderBy: { computed_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.reconciliation.count({ where: params.status ? { status: params.status } : undefined }),
    db.reconciliation.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const rows: ReconciliationRowView[] = rowsData.map((r) => ({
    id: r.id,
    userName: r.user?.full_name ?? "—",
    storeName: r.store?.name ?? "—",
    orderRef: r.order?.order_id ?? "—",
    date: r.computed_at.toISOString(),
    generated: Number(r.generated_amount),
    submitted: Number(r.submitted_amount),
    paid: Number(r.paid_amount),
    difference: Number(r.submitted_amount) - Number(r.paid_amount),
    status: r.status as ReconciliationStatus,
  }));

  const counts: Record<ReconciliationStatus, number> = {
    CONCILIADO: 0,
    PENDIENTE: 0,
    DIFERENCIA: 0,
    DUPLICADO: 0,
    SIN_MATCH: 0,
  };
  for (const c of countRows) {
    counts[c.status as ReconciliationStatus] = c._count._all;
  }

  return { rows, total, page, pageSize, counts };
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
