import { NextRequest, NextResponse } from "next/server";

import { getPayments } from "@/lib/data/payments";
import type { PaymentFlowStatus } from "@/types/database";

function toCsvValue(value: string | number | null) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const { rows } = await getPayments({
    q: params.get("q") ?? undefined,
    status: (params.get("status") as PaymentFlowStatus) ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: 1,
    pageSize: 10000,
  });

  const header = [
    "Fecha",
    "Usuario",
    "Telefono",
    "Tienda",
    "Zona",
    "Concepto",
    "Monto",
    "Estado",
    "FechaEnvio",
    "FechaPago",
    "Referencia",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.date.slice(0, 10),
        r.userName,
        r.userPhone,
        r.storeName,
        r.zoneName,
        r.concept,
        r.amount,
        r.status,
        r.sentDate?.slice(0, 10) ?? "",
        r.paidDate?.slice(0, 10) ?? "",
        r.reference,
      ]
        .map(toCsvValue)
        .join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
