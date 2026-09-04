import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import { type MockOrder } from "./mock-dataset";
import { getOperationalOrders } from "./operational-live-source";

export interface AnalyticsFilters {
  days?: number;
  state?: string;
  storeId?: string;
}

export interface TrendPoint {
  bucket: string;
  label: string;
  total: number;
  onTime: number;
  eligible: number;
  late: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
  onTimePct: number;
}

export interface StorePerformanceItem {
  storeId: string;
  storeName: string;
  count: number;
  onTimePct: number;
  lateCount: number;
  avgDistance: number;
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
  avgLines: number;
}

export interface AnalyticsOverview {
  totalOrders: number;
  deliveredOrders: number;
  onTimePct: number;
  onTimeEligible: number;
  lateCount: number;
  avgDistanceKm: number;
  avgLines: number;
  trend: TrendPoint[];
  stateBreakdown: BreakdownItem[];
  slotBreakdown: BreakdownItem[];
  distanceBreakdown: BreakdownItem[];
  linesBreakdown: BreakdownItem[];
}

// ON_TIME (col H) is 1 / 0 / blank — blank means "no aplica" (order never
// reached a delivered state to evaluate), not "late". It must be excluded
// from the on-time% denominator entirely, not counted against it — see
// ParsedOrder.onTime / MockOrder.onTime (boolean | null).
function isEligible(o: { onTime: boolean | null }): boolean {
  return o.onTime !== null;
}

// Buckets chosen to separate "short hop" from "long haul" deliveries —
// DISTANCE_MAN_HAV (col I). Adjust the cutoffs if the real distribution
// turns out to cluster differently once more data flows through.
function distanceBucket(km: number): string {
  if (km < 2) return "0–2 km";
  if (km < 5) return "2–5 km";
  if (km < 10) return "5–10 km";
  return "10+ km";
}

// NO_LINES_REQUESTED (col L) — order size in line items.
function linesBucket(n: number): string {
  if (n <= 10) return "1–10 líneas";
  if (n <= 25) return "11–25 líneas";
  if (n <= 50) return "26–50 líneas";
  return "51+ líneas";
}

function bucketOfDay(date: Date): { key: string; label: string } {
  const key = date.toISOString().slice(0, 10);
  return { key, label: date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) };
}

// The synthetic demo dataset is seeded relative to a fixed "today" (see
// mock-dataset.ts) so its date filter must anchor to that same fixed
// date, not the real clock. Real data (live Sheets/webhook) has no such
// anchor — filtering "últimos 30 días" must mean the actual last 30 days,
// or a sheet spanning many months (like ours does) would filter almost
// everything out relative to a stale fixed date.
function applyFilters(rows: MockOrder[], filters: AnalyticsFilters, live: boolean): MockOrder[] {
  let out = rows;
  const days = filters.days ?? 30;
  const cutoff = live ? new Date() : new Date("2026-08-31T00:00:00Z");
  cutoff.setDate(cutoff.getDate() - days);
  out = out.filter((o) => o.date >= cutoff);

  if (filters.state) out = out.filter((o) => o.store.state === filters.state);
  if (filters.storeId) out = out.filter((o) => o.store.id === filters.storeId);
  return out;
}

function buildBreakdown(rows: MockOrder[], keyFn: (o: MockOrder) => string): BreakdownItem[] {
  const map = new Map<string, { count: number; onTime: number; eligible: number }>();
  for (const o of rows) {
    const key = keyFn(o);
    const acc = map.get(key) ?? { count: 0, onTime: 0, eligible: 0 };
    acc.count++;
    if (isEligible(o)) {
      acc.eligible++;
      if (o.onTime) acc.onTime++;
    }
    map.set(key, acc);
  }
  // Worst on-time first — this is the "where's the problem" view. Volume
  // is still shown alongside so a low-count outlier reads as noise, not
  // signal.
  return Array.from(map.entries())
    .map(([label, v]) => ({ label, count: v.count, onTimePct: v.eligible ? v.onTime / v.eligible : 0 }))
    .sort((a, b) => a.onTimePct - b.onTimePct);
}

// Shared live-mode order fetch — bounded by date range + optional
// store filter (state requires the store relation, applied in-memory
// below since it's not an indexed column on `orders`).
async function fetchLiveOrders(filters: AnalyticsFilters) {
  const since = new Date();
  since.setDate(since.getDate() - (filters.days ?? 30));

  const rows = await db.order.findMany({
    where: { delivery_date: { gte: since }, store_id: filters.storeId || undefined },
    include: { store: true, user: true },
  });

  if (!filters.state) return rows;
  return rows.filter((o) => o.store?.state === filters.state);
}

export async function getAnalyticsOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
  if (isDemoMode()) {
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);

    const buckets = new Map<string, TrendPoint>();
    for (const o of rows) {
      const { key, label } = bucketOfDay(o.date);
      const point = buckets.get(key) ?? { bucket: key, label, total: 0, onTime: 0, eligible: 0, late: 0 };
      point.total++;
      if (isEligible(o)) {
        point.eligible++;
        if (o.onTime) point.onTime++;
        else point.late++;
      }
      buckets.set(key, point);
    }
    const trend = Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1));

    const stateBreakdown = buildBreakdown(rows, (o) => o.store.state);
    const slotBreakdown = buildBreakdown(rows, (o) => o.slot || "Sin slot");
    const distanceBreakdown = buildBreakdown(rows, (o) => distanceBucket(o.distanceKm));
    const linesBreakdown = buildBreakdown(rows, (o) => linesBucket(o.linesRequested));

    const eligibleRows = rows.filter(isEligible);
    const onTimeRows = eligibleRows.filter((o) => o.onTime);

    return {
      totalOrders: rows.length,
      deliveredOrders: rows.filter((o) => o.status === "DELIVERED").length,
      onTimePct: eligibleRows.length ? onTimeRows.length / eligibleRows.length : 0,
      onTimeEligible: eligibleRows.length,
      lateCount: eligibleRows.length - onTimeRows.length,
      avgDistanceKm: rows.length ? rows.reduce((s, o) => s + o.distanceKm, 0) / rows.length : 0,
      avgLines: rows.length ? rows.reduce((s, o) => s + o.linesRequested, 0) / rows.length : 0,
      trend,
      stateBreakdown,
      slotBreakdown,
      distanceBreakdown,
      linesBreakdown,
    };
  }

  // Live mode (Cloud SQL): aggregated in application code for now — once
  // volume is known this should move to a SQL Server view/stored proc.
  const rows = await fetchLiveOrders(filters);

  const buckets = new Map<string, TrendPoint>();
  const stateAcc = new Map<string, { count: number; onTime: number; eligible: number }>();
  const slotAcc = new Map<string, { count: number; onTime: number; eligible: number }>();
  const distanceAcc = new Map<string, { count: number; onTime: number; eligible: number }>();
  const linesAcc = new Map<string, { count: number; onTime: number; eligible: number }>();

  const bump = (map: Map<string, { count: number; onTime: number; eligible: number }>, key: string, onTime: boolean | null) => {
    const acc = map.get(key) ?? { count: 0, onTime: 0, eligible: 0 };
    acc.count++;
    if (onTime !== null) {
      acc.eligible++;
      if (onTime) acc.onTime++;
    }
    map.set(key, acc);
  };
  const toBreakdown = (map: Map<string, { count: number; onTime: number; eligible: number }>): BreakdownItem[] =>
    Array.from(map.entries())
      .map(([label, v]) => ({ label, count: v.count, onTimePct: v.eligible ? v.onTime / v.eligible : 0 }))
      .sort((a, b) => a.onTimePct - b.onTimePct);

  let eligibleCount = 0;
  let onTimeCount = 0;
  let distanceSum = 0;
  let linesSum = 0;

  for (const o of rows) {
    const onTime = o.on_time;
    if (o.delivery_date) {
      const { key, label } = bucketOfDay(o.delivery_date);
      const point = buckets.get(key) ?? { bucket: key, label, total: 0, onTime: 0, eligible: 0, late: 0 };
      point.total++;
      if (onTime !== null) {
        point.eligible++;
        if (onTime) point.onTime++;
        else point.late++;
      }
      buckets.set(key, point);
    }

    if (o.store?.state) bump(stateAcc, o.store.state, onTime);
    bump(slotAcc, o.slot || "Sin slot", onTime);
    bump(distanceAcc, distanceBucket(Number(o.distance_km ?? 0)), onTime);
    bump(linesAcc, linesBucket(o.lines_requested ?? 0), onTime);

    if (onTime !== null) {
      eligibleCount++;
      if (onTime) onTimeCount++;
    }
    distanceSum += Number(o.distance_km ?? 0);
    linesSum += o.lines_requested ?? 0;
  }

  return {
    totalOrders: rows.length,
    deliveredOrders: rows.filter((o) => o.status === "DELIVERED").length,
    onTimePct: eligibleCount ? onTimeCount / eligibleCount : 0,
    onTimeEligible: eligibleCount,
    lateCount: eligibleCount - onTimeCount,
    avgDistanceKm: rows.length ? distanceSum / rows.length : 0,
    avgLines: rows.length ? linesSum / rows.length : 0,
    trend: Array.from(buckets.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1)),
    stateBreakdown: toBreakdown(stateAcc),
    slotBreakdown: toBreakdown(slotAcc),
    distanceBreakdown: toBreakdown(distanceAcc),
    linesBreakdown: toBreakdown(linesAcc),
  };
}

export async function getStorePerformance(filters: AnalyticsFilters): Promise<StorePerformanceItem[]> {
  if (isDemoMode()) {
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);
    const map = new Map<string, StorePerformanceItem & { onTime: number; eligible: number; distanceSum: number }>();
    for (const o of rows) {
      const existing = map.get(o.store.id) ?? {
        storeId: o.store.id,
        storeName: o.store.name,
        count: 0,
        onTime: 0,
        eligible: 0,
        onTimePct: 0,
        lateCount: 0,
        distanceSum: 0,
        avgDistance: 0,
      };
      existing.count++;
      if (isEligible(o)) {
        existing.eligible++;
        if (o.onTime) existing.onTime++;
      }
      existing.distanceSum += o.distanceKm;
      map.set(o.store.id, existing);
    }
    return Array.from(map.values())
      .map((v) => ({
        ...v,
        onTimePct: v.eligible ? v.onTime / v.eligible : 0,
        lateCount: v.eligible - v.onTime,
        avgDistance: v.count ? v.distanceSum / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  const rows = await fetchLiveOrders(filters);
  const map = new Map<string, StorePerformanceItem & { onTime: number; eligible: number; distanceSum: number }>();
  for (const o of rows) {
    if (!o.store_id) continue;
    const existing = map.get(o.store_id) ?? {
      storeId: o.store_id,
      storeName: o.store?.name ?? "—",
      count: 0,
      onTime: 0,
      eligible: 0,
      onTimePct: 0,
      lateCount: 0,
      distanceSum: 0,
      avgDistance: 0,
    };
    existing.count++;
    if (o.on_time !== null) {
      existing.eligible++;
      if (o.on_time) existing.onTime++;
    }
    existing.distanceSum += Number(o.distance_km ?? 0);
    map.set(o.store_id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({
      ...v,
      onTimePct: v.eligible ? v.onTime / v.eligible : 0,
      lateCount: v.eligible - v.onTime,
      avgDistance: v.count ? v.distanceSum / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getUserPerformance(filters: AnalyticsFilters): Promise<UserPerformanceItem[]> {
  if (isDemoMode()) {
    const { orders, live } = await getOperationalOrders();
    const rows = applyFilters(orders, filters, live);
    const map = new Map<
      string,
      UserPerformanceItem & { onTime: number; eligible: number; distanceSum: number; linesSum: number }
    >();
    for (const o of rows) {
      const existing = map.get(o.user.id) ?? {
        userId: o.user.id,
        userName: o.user.full_name,
        phone: o.user.phone,
        storeName: o.store.name,
        count: 0,
        onTime: 0,
        eligible: 0,
        onTimePct: 0,
        lateCount: 0,
        distanceSum: 0,
        avgDistance: 0,
        linesSum: 0,
        avgLines: 0,
      };
      existing.count++;
      if (isEligible(o)) {
        existing.eligible++;
        if (o.onTime) existing.onTime++;
      }
      existing.distanceSum += o.distanceKm;
      existing.linesSum += o.linesRequested;
      map.set(o.user.id, existing);
    }
    return Array.from(map.values())
      .map((v) => ({
        ...v,
        onTimePct: v.eligible ? v.onTime / v.eligible : 0,
        lateCount: v.eligible - v.onTime,
        avgDistance: v.count ? v.distanceSum / v.count : 0,
        avgLines: v.count ? v.linesSum / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  const rows = await fetchLiveOrders(filters);
  const map = new Map<
    string,
    UserPerformanceItem & { onTime: number; eligible: number; distanceSum: number; linesSum: number }
  >();
  for (const o of rows) {
    if (!o.user_id) continue;
    const existing = map.get(o.user_id) ?? {
      userId: o.user_id,
      userName: o.user?.full_name ?? "—",
      phone: o.user?.phone ?? "—",
      storeName: o.store?.name ?? "—",
      count: 0,
      onTime: 0,
      eligible: 0,
      onTimePct: 0,
      lateCount: 0,
      distanceSum: 0,
      avgDistance: 0,
      linesSum: 0,
      avgLines: 0,
    };
    existing.count++;
    if (o.on_time !== null) {
      existing.eligible++;
      if (o.on_time) existing.onTime++;
    }
    existing.distanceSum += Number(o.distance_km ?? 0);
    existing.linesSum += o.lines_requested ?? 0;
    map.set(o.user_id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({
      ...v,
      onTimePct: v.eligible ? v.onTime / v.eligible : 0,
      lateCount: v.eligible - v.onTime,
      avgDistance: v.count ? v.distanceSum / v.count : 0,
      avgLines: v.count ? v.linesSum / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
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
