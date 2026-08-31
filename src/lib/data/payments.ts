import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  let query = supabase
    .from("v_payment_ledger")
    .select("*", { count: "exact" })
    .order("event_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("event_date", filters.from);
  if (filters.to) query = query.lte("event_date", filters.to);
  if (filters.q) {
    query = query.or(
      `user_name.ilike.%${filters.q}%,user_phone.ilike.%${filters.q}%,store_name.ilike.%${filters.q}%,reference.ilike.%${filters.q}%`
    );
  }

  const { data, count } = await query;

  const rows: LedgerRow[] = (data ?? []).map((r) => ({
    id: r.order_pk,
    date: r.event_date,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    storeName: r.store_name,
    zoneName: r.zone_name,
    concept: r.reference,
    amount: r.generated_amount,
    status: r.status,
    sentDate: r.submitted_date,
    paidDate: r.paid_at,
    reference: r.reference,
  }));

  return { rows, total: count ?? 0, page, pageSize };
}
