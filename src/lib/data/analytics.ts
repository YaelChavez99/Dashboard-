import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import { type MockOrder } from "./mock-dataset";
import { getOperationalOrders } from "./operational-live-source";

export type Granularity = "day" | "week" | "month";

export interface AnalyticsFilters {
  days?: number;
  granularity?: Granularity;
  zone?: string;
  state?: string;
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
  code: string;
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

// The synthetic demo dataset is seeded relative to a fixed "today"
// (see mock-dataset.ts) so its date filters must anchor to that same
// fixed date, not the real clock. Real data (live Sheets/webhook) has no
// such anchor — filtering "últimos 30 días" must mean the actual last 30
// days, or a sheet spanning many months (like ours does) would filter
// almost everything out relative to a stale fixed date.
function applyFilters(rows: MockOrder[], filters: AnalyticsFilters, live: boolean): MockOrder[] {
  let out = rows;
  const days = filters.days ?? 30;
  const cutoff = live ? new Date() : new Date("2026-08-31T00:00:00Z");
  cutoff.setDate(cutoff.getDate() - days);
  out = out.filter((o) => o.date >= cutoff);

  if (filters.zone) out = out.filter((o) => o.store.zone === filters.zone);
  if (filters.state) out = out.filter((o) => o.store.state === filters.state);
  if (filters.storeId) out = out.filter((o) => o.store.id === filters.storeId);
  if (filters.status) out = out.filter((o) => o.status === filters.status);
  return out;
}

// Shared live-mode order fetch — bounded by date range + optional
// store/status filters (zone/state require the store relation, applied
// in-memory below since they're not indexed columns on `orders`).
async function fetchLiveOrders(filters: AnalyticsFilters) {
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));

  const rows = await db.order.findMany({
    where: {
      delivery_date: { gte: since },
      store_id: filters.storeId || undefined,
      status: filters.status || undefined,
    },
    include: { store: { include: { zone: true } }, user: true },
  });

  if (!filters.zone && !filters.state) return rows;
  return rows.filter(
    (o) =>
      (!filters.zone || o.store?.zone?.name === filters.zone) &&
      (!filters.state || o.store?.state === filters.state)
  );
}

export async function getAnalyticsOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
  const granularity = filters.granularity ?? "day";

  if (isDemoMode()) {
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);

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
      .map(([status, count]) => ({ status: STATUS_LABELS[status] ?? status, code: status, count, pct: rows.length ? count / rows.length : 0 }))
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

  // Live mode: aggregated in application code for now — see
  // src/lib/data/overview.ts for the same tradeoff note. Once volume is
  // known this should move to a SQL Server view/stored proc.
  const rows = await fetchLiveOrders(filters);

  const buckets = new Map<string, TrendPoint>();
  for (const o of rows) {
    if (!o.delivery_date) continue;
    const { key, label } = bucketOf(o.delivery_date, granularity);
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
    .map(([status, count]) => ({ status: STATUS_LABELS[status] ?? status, code: status, count, pct: rows.length ? count / rows.length : 0 }))
    .sort((a, b) => b.count - a.count);

  const zoneMap = new Map<string, { count: number; onTime: number }>();
  const stateMap = new Map<string, { count: number; onTime: number }>();
  for (const o of rows) {
    const zoneName = o.store?.zone?.name;
    if (zoneName) {
      const z = zoneMap.get(zoneName) ?? { count: 0, onTime: 0 };
      z.count++;
      if (o.on_time) z.onTime++;
      zoneMap.set(zoneName, z);
    }
    const stateName = o.store?.state;
    if (stateName) {
      const s = stateMap.get(stateName) ?? { count: 0, onTime: 0 };
      s.count++;
      if (o.on_time) s.onTime++;
      stateMap.set(stateName, s);
    }
  }
  const zoneBreakdown: ZoneBreakdownItem[] = Array.from(zoneMap.entries())
    .map(([zone, v]) => ({ zone, count: v.count, onTimePct: v.count ? v.onTime / v.count : 0 }))
    .sort((a, b) => b.count - a.count);
  const stateBreakdown: StatePerformanceItem[] = Array.from(stateMap.entries())
    .map(([state, v]) => ({ state, count: v.count, onTimePct: v.count ? v.onTime / v.count : 0 }))
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
    zoneBreakdown,
    stateBreakdown,
  };
}

export async function getStorePerformance(filters: AnalyticsFilters): Promise<StorePerformanceItem[]> {
  if (isDemoMode()) {
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);
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

  const rows = await fetchLiveOrders(filters);
  const map = new Map<string, StorePerformanceItem & { onTime: number }>();
  for (const o of rows) {
    if (!o.store_id) continue;
    const existing = map.get(o.store_id) ?? {
      storeId: o.store_id,
      storeName: o.store?.name ?? "—",
      zone: o.store?.zone?.name ?? "—",
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
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);
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

  const rows = await fetchLiveOrders(filters);
  const map = new Map<string, UserPerformanceItem & { onTime: number; distanceSum: number }>();
  for (const o of rows) {
    if (!o.user_id) continue;
    const existing = map.get(o.user_id) ?? {
      userId: o.user_id,
      userName: o.user?.full_name ?? "—",
      phone: o.user?.phone ?? "—",
      storeName: o.store?.name ?? "—",
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
    existing.distanceSum += Number(o.distance_km ?? 0);
    map.set(o.user_id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, onTimePct: v.count ? v.onTime / v.count : 0, avgDistance: v.count ? v.distanceSum / v.count : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getZoneOptions() {
  if (isDemoMode()) {
    const { orders } = await getOperationalOrders();
    return Array.from(new Set(orders.map((o) => o.store.zone))).sort();
  }
  return [];
}

export async function getStateOptions() {
  if (isDemoMode()) {
    const { orders } = await getOperationalOrders();
    return Array.from(new Set(orders.map((o) => o.store.state))).sort();
  }
  return [];
}

export interface StoreOption {
  id: string;
  name: string;
}

export async function getStoreOptions(): Promise<StoreOption[]> {
  if (isDemoMode()) {
    const { orders } = await getOperationalOrders();
    const map = new Map<string, string>();
    for (const o of orders) map.set(o.store.id, o.store.name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}

/**
 * Whether the demo-mode data currently being served is live Google Sheets
 * data (Option B — no database, see operational-live-source.ts) or purely
 * synthetic demo data. Only meaningful when isDemoMode() is true.
 */
export async function isOperationalDataLive(): Promise<boolean> {
  const { live } = await getOperationalOrders();
  return live;
}
