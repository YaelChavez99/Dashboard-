import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import { totalsForPeriod, STORES, USERS } from "./mock-dataset";

export interface OverviewTotals {
  generated: number;
  submitted: number;
  paid: number;
  pendingSubmission: number;
  pendingPayment: number;
  userCount: number;
  storeCount: number;
  transactionCount: number;
}

export interface TrendPoint {
  date: string;
  generated: number;
  submitted: number;
  paid: number;
}

export interface OverviewData {
  totals: OverviewTotals;
  previousTotals: OverviewTotals;
  trend: TrendPoint[];
  alerts: { label: string; count: number; href: string }[];
}

export async function getOverviewData(periodDays = 30): Promise<OverviewData> {
  if (isDemoMode()) {
    return getDemoOverviewData(periodDays);
  }
  return getLiveOverviewData(periodDays);
}

function getDemoOverviewData(periodDays: number): OverviewData {
  const current = totalsForPeriod(periodDays);
  const previous = totalsForPeriod(periodDays * 2);
  const previousOnly = {
    generated: previous.generated - current.generated,
    submitted: previous.submitted - current.submitted,
    paid: previous.paid - current.paid,
    count: previous.count - current.count,
  };

  const toTotals = (t: { generated: number; submitted: number; paid: number; count: number }): OverviewTotals => ({
    generated: t.generated,
    submitted: t.submitted,
    paid: t.paid,
    pendingSubmission: Math.max(t.generated - t.submitted, 0),
    pendingPayment: Math.max(t.submitted - t.paid, 0),
    userCount: USERS.length,
    storeCount: STORES.length,
    transactionCount: t.count,
  });

  const trendDays = Math.min(periodDays, 30);
  const trend: TrendPoint[] = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const dayRows = current.rows.filter((r) => {
      const diffDays = Math.floor(
        (new Date("2026-08-31").getTime() - r.date.getTime()) / 86400000
      );
      return diffDays === i;
    });
    const date = new Date("2026-08-31");
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toISOString().slice(0, 10),
      generated: dayRows.reduce((s, r) => s + r.generated, 0),
      submitted: dayRows.reduce((s, r) => s + r.submitted, 0),
      paid: dayRows.reduce((s, r) => s + r.paid, 0),
    });
  }

  const pendingPaymentCount = current.rows.filter(
    (r) => r.status === "ENVIADO_A_FINANZAS" || r.status === "EN_PROCESO"
  ).length;
  const rejectedCount = current.rows.filter((r) => r.status === "RECHAZADO").length;

  return {
    totals: toTotals(current),
    previousTotals: toTotals(previousOnly),
    trend,
    alerts: [
      { label: "pagos pendientes de envío o proceso", count: pendingPaymentCount, href: "/payments?status=PENDIENTE" },
      { label: "reclamos rechazados", count: rejectedCount, href: "/payments?status=RECHAZADO" },
      { label: "diferencias de conciliación por revisar", count: Math.round(current.count * 0.02), href: "/reconciliation?status=DIFERENCIA" },
    ].filter((a) => a.count > 0),
  };
}

async function getLiveOverviewData(periodDays: number): Promise<OverviewData> {
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const [submissionsAgg, paymentsAgg, ordersAgg, userCount, storeCount] = await Promise.all([
    db.financeSubmission.aggregate({ _sum: { amount: true }, where: { submitted_date: { gte: since } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paid_at: { gte: since } } }),
    db.order.aggregate({
      _sum: { generated_amount: true },
      _count: { _all: true },
      where: { delivery_date: { gte: since } },
    }),
    db.appUser.count(),
    db.store.count(),
  ]);

  const generated = Number(ordersAgg._sum.generated_amount ?? 0);
  const submitted = Number(submissionsAgg._sum.amount ?? 0);
  const paid = Number(paymentsAgg._sum.amount ?? 0);

  const totals: OverviewTotals = {
    generated,
    submitted,
    paid,
    pendingSubmission: Math.max(generated - submitted, 0),
    pendingPayment: Math.max(submitted - paid, 0),
    userCount,
    storeCount,
    transactionCount: ordersAgg._count._all,
  };

  // Previous-period comparison and daily trend are left as a follow-up:
  // once real volume is known these should be SQL Server views/RPCs
  // rather than client-side aggregation.
  return {
    totals,
    previousTotals: totals,
    trend: [],
    alerts: [],
  };
}
