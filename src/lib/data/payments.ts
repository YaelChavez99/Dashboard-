import { db } from "@/lib/db";
import { isDemoMode } from "./demo-mode";
import { TRANSACTIONS, type MockTxn } from "./mock-dataset";
import type { PaymentFlowStatus } from "@/types/database";

export interface LedgerRow {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userPhone: string;
  storeName: string;
  zoneName: string;
  concept: string;
  amount: number;
  status: PaymentFlowStatus;
  sentDate: string | null;
  paidDate: string | null;
  reference: string;
}

export interface PaymentsFilters {
  q?: string;
  status?: PaymentFlowStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentsResult {
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
}

function mockToLedgerRow(t: MockTxn): LedgerRow {
  return {
    id: t.id,
    date: t.date.toISOString(),
    userId: t.user.id,
    userName: t.user.full_name,
    userPhone: t.user.phone,
    storeName: t.store.name,
    zoneName: t.store.zone,
    concept: `Task: ${t.id} ${t.date.toISOString().slice(0, 10)}`,
    amount: t.generated,
    status: t.status,
    sentDate: t.submitted > 0 ? t.date.toISOString() : null,
    paidDate: t.paid > 0 ? t.date.toISOString() : null,
    reference: t.id.toUpperCase(),
  };
}

export async function getPayments(filters: PaymentsFilters): Promise<PaymentsResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  if (isDemoMode()) {
    let rows = TRANSACTIONS.map(mockToLedgerRow);

    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.userPhone.includes(q) ||
          r.storeName.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q)
      );
    }
    if (filters.from) rows = rows.filter((r) => r.date >= filters.from!);
    if (filters.to) rows = rows.filter((r) => r.date <= filters.to! + "T23:59:59");

    rows = rows.sort((a, b) => (a.date < b.date ? 1 : -1));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  }

  return getLivePayments(filters, page, pageSize);
}

// Replicates the old `v_payment_ledger` Postgres view (supabase/migrations/
// 0002_views.sql) in application code — Prisma has no first-class support
// for that join shape (payments joins orders on shared user/store keys,
// not a real foreign key). Fetches a bounded, date-scoped window of
// orders with their relations, joins finance_submissions/payments by key
// in memory, then filters/sorts/paginates. Follow-up once volume is
// known: move this to a SQL Server view or stored proc instead.
async function getLivePayments(
  filters: PaymentsFilters,
  page: number,
  pageSize: number
): Promise<PaymentsResult> {
  const orders = await db.order.findMany({
    where: {
      delivery_date: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined,
      },
    },
    include: { user: true, store: true, zone: true },
    orderBy: { delivery_date: "desc" },
    take: 5000,
  });

  const orderIds = orders.map((o) => o.id);
  const [submissions, allPayments] = await Promise.all([
    db.financeSubmission.findMany({ where: { order_id: { in: orderIds } } }),
    db.payment.findMany({
      where: {
        OR: orders.map((o) => ({ user_id: o.user_id ?? "", store_id: o.store_id })).filter((k) => k.user_id),
      },
    }),
  ]);

  const submissionByOrderId = new Map(submissions.map((s) => [s.order_id, s]));
  const paymentByUserStore = new Map(allPayments.map((p) => [`${p.user_id}|${p.store_id ?? ""}`, p]));

  let rows: LedgerRow[] = orders.map((o) => {
    const fs = submissionByOrderId.get(o.id);
    const payment = o.user_id ? paymentByUserStore.get(`${o.user_id}|${o.store_id ?? ""}`) : undefined;

    let status: PaymentFlowStatus;
    if (payment) status = "PAGADO";
    else if (fs?.master_pagos_approved) status = "ENVIADO_A_FINANZAS";
    else if (fs) status = "EN_PROCESO";
    else status = "GENERADO";

    return {
      id: o.id,
      date: (o.delivery_date ?? o.created_at).toISOString(),
      userId: o.user_id ?? "",
      userName: o.user?.full_name ?? "—",
      userPhone: o.user?.phone ?? "—",
      storeName: o.store?.name ?? "—",
      zoneName: o.zone?.name ?? "—",
      concept: `Task: ${o.order_id}`,
      amount: Number(o.generated_amount ?? 0),
      status,
      sentDate: fs?.submitted_date?.toISOString() ?? null,
      paidDate: payment?.paid_at?.toISOString() ?? null,
      reference: o.order_id,
    };
  });

  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.userName.toLowerCase().includes(q) ||
        r.userPhone.includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q)
    );
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}
