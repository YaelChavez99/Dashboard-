import { db } from "@/lib/db";
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

  const where = params.q
    ? {
        OR: [
          { full_name: { contains: params.q } },
          { phone: { contains: params.q } },
          { email: { contains: params.q } },
        ],
      }
    : undefined;

  const [data, count] = await Promise.all([
    db.appUser.findMany({
      where,
      select: { id: true, full_name: true, phone: true, email: true, status: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.appUser.count({ where }),
  ]);

  const rows: UserSummary[] = data.map((u) => ({
    id: u.id,
    fullName: u.full_name ?? "—",
    phone: u.phone ?? "—",
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

  return { rows, total: count, page, pageSize };
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

  const user = await db.appUser.findUnique({
    where: { id },
    select: { id: true, full_name: true, phone: true, email: true, status: true },
  });
  if (!user) return null;

  // Same ledger join as getPayments() (see src/lib/data/payments.ts),
  // scoped to this one user — cheap enough to do per-request here.
  const orders = await db.order.findMany({
    where: { user_id: id },
    include: { store: true, zone: true },
    orderBy: { delivery_date: "desc" },
  });
  const orderIds = orders.map((o) => o.id);
  const [submissions, payments] = await Promise.all([
    db.financeSubmission.findMany({ where: { order_id: { in: orderIds } } }),
    db.payment.findMany({ where: { user_id: id } }),
  ]);
  const submissionByOrderId = new Map(submissions.map((s) => [s.order_id, s]));
  const paymentByStore = new Map(payments.map((p) => [p.store_id ?? "", p]));

  const history = orders.map((o) => {
    const fs = submissionByOrderId.get(o.id);
    const payment = paymentByStore.get(o.store_id ?? "");
    let status: string;
    if (payment) status = "PAGADO";
    else if (fs?.master_pagos_approved) status = "ENVIADO_A_FINANZAS";
    else if (fs) status = "EN_PROCESO";
    else status = "GENERADO";

    return {
      id: o.id,
      date: (o.delivery_date ?? o.created_at).toISOString(),
      concept: `Task: ${o.order_id}`,
      amount: Number(o.generated_amount ?? 0),
      status,
      storeName: o.store?.name ?? "—",
      period: (o.delivery_date ?? o.created_at).toLocaleDateString("es-MX", {
        month: "short",
        year: "numeric",
      }),
      _storeName: o.store?.name,
      _zoneName: o.zone?.name,
      _paidAmount: payment ? Number(payment.amount) : 0,
      _paidAt: payment?.paid_at ?? null,
      _submittedAmount: fs ? Number(fs.amount) : 0,
    };
  });

  const generated = history.reduce((s, r) => s + r.amount, 0);
  const submitted = history.reduce((s, r) => s + r._submittedAmount, 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);

  let running = 0;
  const cumulative = [...history]
    .filter((r) => r._paidAmount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => {
      running += r._paidAmount;
      return { date: r.date.slice(0, 10), total: running };
    });

  return {
    id: user.id,
    fullName: user.full_name ?? "—",
    phone: user.phone ?? "—",
    email: user.email,
    storeName: history[0]?._storeName ?? "—",
    zoneName: history[0]?._zoneName ?? "—",
    generated,
    submitted,
    paid,
    pending: Math.max(submitted - paid, 0),
    lastPaymentDate: payments.find((p) => p.paid_at)?.paid_at?.toISOString() ?? null,
    status: user.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    transactionCount: history.length,
    averagePayment: history.length ? paid / history.length : 0,
    history: history.map(({ id, date, concept, amount, status, storeName, period }) => ({
      id,
      date,
      concept,
      amount,
      status,
      storeName,
      period,
    })),
    cumulative,
  };
}
