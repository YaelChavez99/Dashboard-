import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  const sinceIso = since.toISOString();

  const [{ data: submissions }, { data: payments }, { data: orders }, { count: userCount }, { count: storeCount }] =
    await Promise.all([
      supabase.from("finance_submissions").select("amount, submitted_date").gte("submitted_date", sinceIso),
      supabase.from("payments").select("amount, paid_at").gte("paid_at", sinceIso),
      supabase.from("orders").select("generated_amount, delivery_date").gte("delivery_date", sinceIso),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }),
    ]);

  const generated = (orders ?? []).reduce((s, r) => s + (r.generated_amount ?? 0), 0);
  const submitted = (submissions ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const paid = (payments ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  const totals: OverviewTotals = {
    generated,
    submitted,
    paid,
    pendingSubmission: Math.max(generated - submitted, 0),
    pendingPayment: Math.max(submitted - paid, 0),
    userCount: userCount ?? 0,
    storeCount: storeCount ?? 0,
    transactionCount: orders?.length ?? 0,
  };

  // Previous-period comparison and daily trend are left as a follow-up:
  // once real volume is known these should be Postgres views/RPCs
  // (see supabase/migrations) rather than client-side aggregation.
  return {
    totals,
    previousTotals: totals,
    trend: [],
    alerts: [],
  };
}
