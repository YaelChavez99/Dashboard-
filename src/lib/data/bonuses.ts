import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./demo-mode";
import { BONUSES } from "./mock-dataset";

export interface BonusRow {
  id: string;
  date: string;
  userName: string;
  userPhone: string;
  storeName: string;
  area: string;
  typo: string;
  amount: number;
  paymentChecked: boolean;
}

export interface BonusesResult {
  rows: BonusRow[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
}

export async function getBonuses(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<BonusesResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  if (isDemoMode()) {
    let rows: BonusRow[] = BONUSES.map((b) => ({
      id: b.id,
      date: b.date.toISOString(),
      userName: b.user.full_name,
      userPhone: b.user.phone,
      storeName: b.store.name,
      area: b.area,
      typo: b.typo,
      amount: b.amount,
      paymentChecked: b.paymentChecked,
    }));

    if (params.q) {
      const q = params.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.storeName.toLowerCase().includes(q) ||
          r.typo.toLowerCase().includes(q)
      );
    }

    rows = rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    const total = rows.length;
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, totalAmount, page, pageSize };
  }

  const supabase = await createClient();
  let query = supabase
    .from("bonuses")
    .select(
      "id, bonus_date, area, typo, amount, payment_checked, users(full_name, phone), stores(name)",
      { count: "exact" }
    )
    .order("bonus_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (params.q) {
    query = query.or(`typo.ilike.%${params.q}%`);
  }

  const { data, count } = await query;

  const rows: BonusRow[] = (data ?? []).map((b) => {
    const user = Array.isArray(b.users) ? b.users[0] : b.users;
    const store = Array.isArray(b.stores) ? b.stores[0] : b.stores;
    return {
      id: b.id,
      date: b.bonus_date,
      userName: user?.full_name ?? "—",
      userPhone: user?.phone ?? "—",
      storeName: store?.name ?? "—",
      area: b.area ?? "—",
      typo: b.typo,
      amount: b.amount,
      paymentChecked: b.payment_checked,
    };
  });

  return {
    rows,
    total: count ?? 0,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    page,
    pageSize,
  };
}
