import { db } from "@/lib/db";
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

  const where = params.q ? { typo: { contains: params.q } } : undefined;

  const [data, count, totalAgg] = await Promise.all([
    db.bonus.findMany({
      where,
      include: { user: true, store: true },
      orderBy: { bonus_date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.bonus.count({ where }),
    db.bonus.aggregate({ where, _sum: { amount: true } }),
  ]);

  const rows: BonusRow[] = data.map((b) => ({
    id: b.id,
    date: b.bonus_date.toISOString(),
    userName: b.user?.full_name ?? "—",
    userPhone: b.user?.phone ?? "—",
    storeName: b.store?.name ?? "—",
    area: b.area ?? "—",
    typo: b.typo,
    amount: Number(b.amount),
    paymentChecked: b.payment_checked,
  }));

  return {
    rows,
    total: count,
    totalAmount: Number(totalAgg._sum.amount ?? 0),
    page,
    pageSize,
  };
}
