import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import { TRANSACTIONS } from "./mock-dataset";

export type Granularity = "day" | "week" | "month";

export interface FinanceFilters {
  days?: number;
  granularity?: Granularity;
}

export interface FinanceTrendPoint {
  bucket: string;
  label: string;
  revenue: number;
  margin: number;
}

export interface StoreFinanceItem {
  storeId: string;
  storeName: string;
  state: string;
  orders: number;
  revenue: number;
  margin: number;
  marginPct: number;
}

export interface FinanceOverview {
  totalRevenue: number;
  totalMargin: number;
  marginPct: number;
  revenueDeltaPct: number | null;
  trend: FinanceTrendPoint[];
  byStore: StoreFinanceItem[];
}

// Deterministic per-store margin rate (18%–38%) derived from the store's
// external id, so it's stable across requests without needing a real cost
// source yet — every figure downstream of this is illustrative until
// finance data connects for real (see the demo-mode banner on this page).
function marginRateForStore(storeExtId: string): number {
  let hash = 0;
  for (let i = 0; i < storeExtId.length; i++) hash = (hash * 31 + storeExtId.charCodeAt(i)) >>> 0;
  return 0.18 + (hash % 1000) / 1000 / 5; // 0.18–0.38
}

function bucketOf(date: Date, granularity: Granularity): { key: string; label: string } {
  if (granularity === "day") {
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) };
  }
  if (granularity === "week") {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    const key = d.toISOString().slice(0, 10);
    return { key, label: `Sem ${d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` };
  }
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
  return { key, label };
}

export async function getFinanceOverview(filters: FinanceFilters): Promise<FinanceOverview> {
  const granularity = filters.granularity ?? "day";
  const days = filters.days ?? 30;

  if (isDemoMode()) {
    const cutoff = new Date("2026-08-31T00:00:00Z");
    cutoff.setDate(cutoff.getDate() - days);
    const rows = TRANSACTIONS.filter((t) => t.date >= cutoff && t.generated > 0);

    const prevCutoff = new Date(cutoff);
    prevCutoff.setDate(prevCutoff.getDate() - days);
    const prevRows = TRANSACTIONS.filter((t) => t.date >= prevCutoff && t.date < cutoff && t.generated > 0);
    const prevRevenue = prevRows.reduce((s, r) => s + r.generated, 0);

    const buckets = new Map<string, FinanceTrendPoint>();
    const byStore = new Map<string, StoreFinanceItem & { rate: number }>();

    for (const r of rows) {
      const rate = marginRateForStore(r.store.store_ext_id);
      const margin = r.generated * rate;

      const { key, label } = bucketOf(r.date, granularity);
      const point = buckets.get(key) ?? { bucket: key, label, revenue: 0, margin: 0 };
      point.revenue += r.generated;
      point.margin += margin;
      buckets.set(key, point);

      const store = byStore.get(r.store.id) ?? {
        storeId: r.store.id,
        storeName: r.store.name,
        state: r.store.state,
        orders: 0,
        revenue: 0,
        margin: 0,
        marginPct: 0,
        rate,
      };
      store.orders += 1;
      store.revenue += r.generated;
      store.margin += margin;
      byStore.set(r.store.id, store);
    }

    const trend = Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
    const totalRevenue = rows.reduce((s, r) => s + r.generated, 0);
    const totalMargin = trend.reduce((s, t) => s + t.margin, 0);

    const storeList: StoreFinanceItem[] = Array.from(byStore.values())
      .map((s) => ({ ...s, marginPct: s.revenue ? s.margin / s.revenue : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalMargin,
      marginPct: totalRevenue ? totalMargin / totalRevenue : 0,
      revenueDeltaPct: prevRevenue ? (totalRevenue - prevRevenue) / prevRevenue : null,
      trend,
      byStore: storeList,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db.order.findMany({
    where: { delivery_date: { gte: since }, generated_amount: { not: null } },
    include: { store: true },
  });

  const buckets = new Map<string, FinanceTrendPoint>();
  const byStore = new Map<string, StoreFinanceItem>();

  for (const r of rows) {
    if (!r.delivery_date || r.generated_amount == null) continue;
    const rate = marginRateForStore(r.store?.store_ext_id ?? "0");
    const revenue = Number(r.generated_amount);
    const margin = revenue * rate;

    const { key, label } = bucketOf(r.delivery_date, granularity);
    const point = buckets.get(key) ?? { bucket: key, label, revenue: 0, margin: 0 };
    point.revenue += revenue;
    point.margin += margin;
    buckets.set(key, point);

    if (r.store_id) {
      const existing = byStore.get(r.store_id) ?? {
        storeId: r.store_id,
        storeName: r.store?.name ?? "—",
        state: r.store?.state ?? "",
        orders: 0,
        revenue: 0,
        margin: 0,
        marginPct: 0,
      };
      existing.orders += 1;
      existing.revenue += revenue;
      existing.margin += margin;
      byStore.set(r.store_id, existing);
    }
  }

  const trend = Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
  const totalRevenue = trend.reduce((s, t) => s + t.revenue, 0);
  const totalMargin = trend.reduce((s, t) => s + t.margin, 0);

  return {
    totalRevenue,
    totalMargin,
    marginPct: totalRevenue ? totalMargin / totalRevenue : 0,
    revenueDeltaPct: null,
    trend,
    byStore: Array.from(byStore.values())
      .map((s) => ({ ...s, marginPct: s.revenue ? s.margin / s.revenue : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}
