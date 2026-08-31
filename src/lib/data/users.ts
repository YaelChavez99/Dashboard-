import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./demo-mode";
import { TRANSACTIONS, USERS as MOCK_USERS } from "./mock-dataset";

export interface UserSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  storeName: string;
  zoneName: string;
  generated: number;
  submitted: number;
  paid: number;
  pending: number;
  lastPaymentDate: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface UserDetail extends UserSummary {
  transactionCount: number;
  averagePayment: number;
  history: {
    id: string;
    date: string;
    concept: string;
    amount: number;
    status: string;
    storeName: string;
    period: string;
  }[];
  cumulative: { date: string; total: number }[];
}

function buildSummaries(): UserSummary[] {
  const byUser = new Map<string, UserSummary & { _lastTs: number }>();

  for (const t of TRANSACTIONS) {
    const key = t.user.id;
    const existing = byUser.get(key);
    const entry =
      existing ??
      ({
        id: t.user.id,
        fullName: t.user.full_name,
        phone: t.user.phone,
        email: t.user.email,
        storeName: t.store.name,
        zoneName: t.store.zone,
        generated: 0,
        submitted: 0,
        paid: 0,
        pending: 0,
        lastPaymentDate: null,
        status: "ACTIVE",
        _lastTs: 0,
      } satisfies UserSummary & { _lastTs: number });

    entry.generated += t.generated;
    entry.submitted += t.submitted;
    entry.paid += t.paid;
    if (t.paid > 0 && t.date.getTime() > entry._lastTs) {
      entry._lastTs = t.date.getTime();
      entry.lastPaymentDate = t.date.toISOString();
    }
    byUser.set(key, entry);
  }

  return Array.from(byUser.values()).map((u) => ({
    ...u,
    pending: Math.max(u.submitted - u.paid, 0),
  }));
}

export async function getUsers(params: { q?: string; page?: number; pageSize?: number }) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  if (isDemoMode()) {
    let rows = buildSummaries();
    if (params.q) {
      const q = params.q.toLowerCase();
      rows = rows.filter(
        (r) => r.fullName.toLowerCase().includes(q) || r.phone.includes(q) || r.email?.toLowerCase().includes(q)
      );
    }
    rows = rows.sort((a, b) => b.paid - a.paid);

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  }

  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select("id, full_name, phone, email, status", { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,phone.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  }

  const { data, count } = await query;

  const rows: UserSummary[] = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name ?? "—",
    phone: u.phone,
    email: u.email,
    storeName: "—",
    zoneName: "—",
    generated: 0,
    submitted: 0,
    paid: 0,
    pending: 0,
    lastPaymentDate: null,
    status: u.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  if (isDemoMode()) {
    const mockUser = MOCK_USERS.find((u) => u.id === id);
    if (!mockUser) return null;

    const txns = TRANSACTIONS.filter((t) => t.user.id === id).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    const summary = buildSummaries().find((s) => s.id === id)!;

    let running = 0;
    const cumulative = [...txns]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .filter((t) => t.paid > 0)
      .map((t) => {
        running += t.paid;
        return { date: t.date.toISOString().slice(0, 10), total: running };
      });

    return {
      ...summary,
      transactionCount: txns.length,
      averagePayment: txns.length ? summary.paid / txns.filter((t) => t.paid > 0).length || 0 : 0,
      history: txns.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        concept: `Task: ${t.id}`,
        amount: t.generated,
        status: t.status,
        storeName: t.store.name,
        period: t.date.toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
      })),
      cumulative,
    };
  }

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, phone, email, status")
    .eq("id", id)
    .maybeSingle();

  if (!user) return null;

  const { data: ledger } = await supabase
    .from("v_payment_ledger")
    .select("*")
    .eq("user_id", id)
    .order("event_date", { ascending: false });

  const rows = ledger ?? [];
  const generated = rows.reduce((s, r) => s + (r.generated_amount ?? 0), 0);
  const submitted = rows.reduce((s, r) => s + (r.submitted_amount ?? 0), 0);
  const paid = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);

  let running = 0;
  const cumulative = [...rows]
    .filter((r) => r.paid_amount)
    .sort((a, b) => (a.event_date < b.event_date ? -1 : 1))
    .map((r) => {
      running += r.paid_amount;
      return { date: r.event_date.slice(0, 10), total: running };
    });

  return {
    id: user.id,
    fullName: user.full_name ?? "—",
    phone: user.phone,
    email: user.email,
    storeName: rows[0]?.store_name ?? "—",
    zoneName: rows[0]?.zone_name ?? "—",
    generated,
    submitted,
    paid,
    pending: Math.max(submitted - paid, 0),
    lastPaymentDate: rows.find((r) => r.paid_at)?.paid_at ?? null,
    status: user.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    transactionCount: rows.length,
    averagePayment: rows.length ? paid / rows.length : 0,
    history: rows.map((r) => ({
      id: r.order_pk,
      date: r.event_date,
      concept: r.reference,
      amount: r.generated_amount,
      status: r.status,
      storeName: r.store_name,
      period: new Date(r.event_date).toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
    })),
    cumulative,
  };
}
