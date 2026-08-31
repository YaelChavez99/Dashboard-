import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/dashboard/status-badge";
import { PaymentsFilterBar } from "@/components/dashboard/payments-filter-bar";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { getPayments } from "@/lib/data/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentFlowStatus } from "@/types/database";

interface PaymentsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const { rows, total, pageSize } = await getPayments({
    q: params.q,
    status: params.status as PaymentFlowStatus | undefined,
    from: params.from,
    to: params.to,
    page,
  });

  const makeHref = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status) sp.set("status", params.status);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    sp.set("page", String(targetPage));
    return `/payments?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Historial de Pagos
        </h1>
        <p className="text-sm text-muted-foreground">
          Generado, enviado a Finanzas y pagado — {total} registros.
        </p>
      </div>

      <Card className="overflow-hidden">
        <PaymentsFilterBar />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Tienda</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha envío</TableHead>
              <TableHead>Fecha pago</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No se encontraron registros con estos filtros.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell>
                  <Link href={`/users/${row.userId}`} className="font-medium text-primary hover:underline">
                    {row.userName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.userPhone}</p>
                </TableCell>
                <TableCell>{row.storeName}</TableCell>
                <TableCell className="text-muted-foreground">{row.zoneName}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {row.concept}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.sentDate ? formatDate(row.sentDate) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.paidDate ? formatDate(row.paidDate) : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.reference}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} pageSize={pageSize} total={total} makeHref={makeHref} />
      </Card>
    </div>
  );
}
