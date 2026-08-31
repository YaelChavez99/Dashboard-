import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./demo-mode";
import { ORDERS, type MockOrder } from "./mock-dataset";

export type Granularity = "day" | "week" | "month";

export interface AnalyticsFilters {
  days?: number;
  granularity?: Granularity;
  zone?: string;
  storeId?: string;
  status?: string;
}

export interface TrendPoint {
  bucket: string;
  label: string;
  total: number;
  onTime: number;
  late: number;
  cancelled: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  pct: number;
}

export interface ZoneBreakdownItem {
  zone: string;
  count: number;
  onTimePct: number;
}

export interface StatePerformanceItem {
  state: string;
  count: number;
  onTimePct: number;
}

export interface StorePerformanceItem {
  storeId: string;
  storeName: string;
  zone: string;
  count: number;
  onTimePct: number;
  lateCount: number;
}

export interface UserPerformanceItem {
  userId: string;
  userName: string;
  phone: string;
  storeName: string;
  count: number;
  onTimePct: number;
  lateCount: number;
  avgDistance: number;
}

export interface AnalyticsOverview {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  onTimePct: number;
  lateCount: number;
  activeUsers: number;
  activeStores: number;
  trend: TrendPoint[];
  statusBreakdown: StatusBreakdownItem[];
  zoneBreakdown: ZoneBreakdownItem[];
  stateBreakdown: StatePerformanceItem[];
}

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  IN_PROGRESS: "En progreso",
  LATE: "Retrasado",
};

function bucketOf(date: Date, granularity: Granularity): { key: string; label: string } {
  if (granularity === "day") {
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) };
  }
  if (granularity === "week") {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    const key = d.toISOString().slice(0, 10);
    return { key, label: `Sem ${d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` };
  }
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
  return { key, label };
}

function applyFilters(rows: MockOrder[], filters: AnalyticsFilters): MockOrder[] {
  let out = rows;
  const days = filters.days ?? 30;
  const cutoff = new Date("2026-08-31T00:00:00Z");
  cutoff.setDate(cutoff.getDate() - days);
  out = out.filter((o) => o.date >= cutoff);

  if (filters.zone) out = out.filter((o) => o.store.zone === filters.zone);
  if (filters.storeId) out = out.filter((o) => o.store.id === filters.storeId);
  if (filters.status) out = out.filter((o) => o.status === filters.status);
  return out;
}

export async function getAnalyticsOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
  const granularity = filters.granularity ?? "day";

  if (isDemoMode()) {
    const rows = applyFilters(ORDERS, filters);

    const buckets = new Map<string, TrendPoint>();
    for (const o of rows) {
      const { key, label } = bucketOf(o.date, granularity);
      const point = buckets.get(key) ?? { bucket: key, label, total: 0, onTime: 0, late: 0, cancelled: 0 };
      point.total++;
      if (o.onTime) point.onTime++;
      if (o.isLate) point.late++;
      if (o.status === "CANCELLED") point.cancelled++;
      buckets.set(key, point);
    }
    const trend = Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));

    const statusCounts = new Map<string, number>();
    for (const o of rows) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
    const statusBreakdown: StatusBreakdownItem[] = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status: STATUS_LABELS[status] ?? status, count, pct: rows.length ? count / rows.length : 0 }))
      .sort((a, b) => b.count - a.count);

    const zoneMap = new Map<string, { count: number; onTime: number }>();
    for (const o of rows) {
      const z = zoneMap.get(o.store.zone) ?? { count: 0, onTime: 0 };
      z.count++;
      if (o.onTime) z.onTime++;
      zoneMap.set(o.store.zone, z);
    }
    const zoneBreakdown: ZoneBreakdownItem[] = Array.from(zoneMap.entries())
      .map(([zone, v]) => ({ zone, count: v.count, onTimePct: v.count ? v.onTime / v.count : 0 }))
      .sort((a, b) => b.count - a.count);

    const stateMap = new Map<string, { count: number; onTime: number }>();
    for (const o of rows) {
      const s = stateMap.get(o.store.state) ?? { count: 0, onTime: 0 };
      s.count++;
      if (o.onTime) s.onTime++;
      stateMap.set(o.store.state, s);
    }
    const stateBreakdown: StatePerformanceItem[] = Array.from(stateMap.entries())
      .map(([state, v]) => ({ state, count: v.count, onTimePct: v.count ? v.onTime / v.count : 0 }))
      .sort((a, b) => b.count - a.count);

    const delivered = rows.filter((o) => o.status === "DELIVERED");
    const lateCount = rows.filter((o) => o.isLate).length;

    return {
      totalOrders: rows.length,
      deliveredOrders: delivered.length,
      cancelledOrders: rows.filter((o) => o.status === "CANCELLED").length,
      onTimePct: delivered.length ? delivered.filter((o) => o.onTime).length / delivered.length : 0,
      lateCount,
      activeUsers: new Set(rows.map((o) => o.user.id)).size,
      activeStores: new Set(rows.map((o) => o.store.id)).size,
      trend,
      statusBreakdown,
      zoneBreakdown,
      stateBreakdown,
    };
  }

  // Live mode: aggregated client-side from raw rows for now — see
  // src/lib/data/overview.ts for the same tradeoff note. Once volume is
  // known this should move to a Postgres view/RPC with date_trunc().
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));

  let query = supabase
    .from("orders")
    .select("id, status, on_time, is_late, delivery_date, user_id, store_id, distance_km")
    .gte("delivery_date", since.toISOString());
  if (filters.storeId) query = query.eq("store_id", filters.storeId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data } = await query;
  const rows = data ?? [];

  const buckets = new Map<string, TrendPoint>();
  for (const o of rows) {
    if (!o.delivery_date) continue;
    const { key, label } = bucketOf(new Date(o.delivery_date), granularity);
    const point = buckets.get(key) ?? { bucket: key, label, total: 0, onTime: 0, late: 0, cancelled: 0 };
    point.total++;
    if (o.on_time) point.onTime++;
    if (o.is_late) point.late++;
    if (o.status === "CANCELLED") point.cancelled++;
    buckets.set(key, point);
  }
  const trend = Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));

  const statusCounts = new Map<string, number>();
  for (const o of rows) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  const statusBreakdown: StatusBreakdownItem[] = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status: STATUS_LABELS[status] ?? status, count, pct: rows.length ? count / rows.length : 0 }))
    .sort((a, b) => b.count - a.count);

  const delivered = rows.filter((o) => o.status === "DELIVERED");

  return {
    totalOrders: rows.length,
    deliveredOrders: delivered.length,
    cancelledOrders: rows.filter((o) => o.status === "CANCELLED").length,
    onTimePct: delivered.length ? delivered.filter((o) => o.on_time).length / delivered.length : 0,
    lateCount: rows.filter((o) => o.is_late).length,
    activeUsers: new Set(rows.map((o) => o.user_id).filter(Boolean)).size,
    activeStores: new Set(rows.map((o) => o.store_id).filter(Boolean)).size,
    trend,
    statusBreakdown,
    zoneBreakdown: [],
    stateBreakdown: [],
  };
}

export async function getStorePerformance(filters: AnalyticsFilters): Promise<StorePerformanceItem[]> {
  if (isDemoMode()) {
    const rows = applyFilters(ORDERS, filters);
    const map = new Map<string, StorePerformanceItem & { onTime: number }>();
    for (const o of rows) {
      const existing = map.get(o.store.id) ?? {
        storeId: o.store.id,
        storeName: o.store.name,
        zone: o.store.zone,
        count: 0,
        onTime: 0,
        onTimePct: 0,
        lateCount: 0,
      };
      existing.count++;
      if (o.onTime) existing.onTime++;
      if (o.isLate) existing.lateCount++;
      map.set(o.store.id, existing);
    }
    return Array.from(map.values())
      .map((v) => ({ ...v, onTimePct: v.count ? v.onTime / v.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));
  const { data } = await supabase
    .from("orders")
    .select("store_id, on_time, is_late, stores(name, zone_id)")
    .gte("delivery_date", since.toISOString());

  const map = new Map<string, StorePerformanceItem & { onTime: number }>();
  for (const o of data ?? []) {
    if (!o.store_id) continue;
    const store = Array.isArray(o.stores) ? o.stores[0] : o.stores;
    const existing = map.get(o.store_id) ?? {
      storeId: o.store_id,
      storeName: store?.name ?? "—",
      zone: "—",
      count: 0,
      onTime: 0,
      onTimePct: 0,
      lateCount: 0,
    };
    existing.count++;
    if (o.on_time) existing.onTime++;
    if (o.is_late) existing.lateCount++;
    map.set(o.store_id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, onTimePct: v.count ? v.onTime / v.count : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getUserPerformance(filters: AnalyticsFilters): Promise<UserPerformanceItem[]> {
  if (isDemoMode()) {
    const rows = applyFilters(ORDERS, filters);
    const map = new Map<string, UserPerformanceItem & { onTime: number; distanceSum: number }>();
    for (const o of rows) {
      const existing = map.get(o.user.id) ?? {
        userId: o.user.id,
        userName: o.user.full_name,
        phone: o.user.phone,
        storeName: o.store.name,
        count: 0,
        onTime: 0,
        onTimePct: 0,
        lateCount: 0,
        distanceSum: 0,
        avgDistance: 0,
      };
      existing.count++;
      if (o.onTime) existing.onTime++;
      if (o.isLate) existing.lateCount++;
      existing.distanceSum += o.distanceKm;
      map.set(o.user.id, existing);
    }
    return Array.from(map.values())
      .map((v) => ({ ...v, onTimePct: v.count ? v.onTime / v.count : 0, avgDistance: v.count ? v.distanceSum / v.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));
  const { data } = await supabase
    .from("orders")
    .select("user_id, on_time, is_late, distance_km, users(full_name, phone), stores(name)")
    .gte("delivery_date", since.toISOString());

  const map = new Map<string, UserPerformanceItem & { onTime: number; distanceSum: number }>();
  for (const o of data ?? []) {
    if (!o.user_id) continue;
    const user = Array.isArray(o.users) ? o.users[0] : o.users;
    const store = Array.isArray(o.stores) ? o.stores[0] : o.stores;
    const existing = map.get(o.user_id) ?? {
      userId: o.user_id,
      userName: user?.full_name ?? "—",
      phone: user?.phone ?? "—",
      storeName: store?.name ?? "—",
      count: 0,
      onTime: 0,
      onTimePct: 0,
      lateCount: 0,
      distanceSum: 0,
      avgDistance: 0,
    };
    existing.count++;
    if (o.on_time) existing.onTime++;
    if (o.is_late) existing.lateCount++;
    existing.distanceSum += o.distance_km ?? 0;
    map.set(o.user_id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, onTimePct: v.count ? v.onTime / v.count : 0, avgDistance: v.count ? v.distanceSum / v.count : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function getZoneOptions() {
  if (isDemoMode()) {
    return Array.from(new Set(ORDERS.map((o) => o.store.zone))).sort();
  }
  return [];
}
