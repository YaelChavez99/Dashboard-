import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReconciliationStatusBadge } from "@/components/dashboard/status-badge";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { getReconciliation } from "@/lib/data/reconciliation";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { ReconciliationStatus } from "@/types/database";

const STATUS_KPIS: { key: ReconciliationStatus | "TOTAL"; label: string }[] = [
  { key: "TOTAL", label: "Total registros" },
  { key: "CONCILIADO", label: "Conciliados" },
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "DIFERENCIA", label: "Diferencias" },
  { key: "DUPLICADO", label: "Duplicados" },
  { key: "SIN_MATCH", label: "Sin Match" },
];

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const status = params.status as ReconciliationStatus | undefined;

  const { rows, total, pageSize, counts } = await getReconciliation({ status, page });
  const totalAll = Object.values(counts).reduce((s, v) => s + v, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Conciliación</h1>
        <p className="text-sm text-muted-foreground">
          Comparación entre Generado, Master Pagos y Pago Confirmado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {STATUS_KPIS.map((kpi) => {
          const value = kpi.key === "TOTAL" ? totalAll : counts[kpi.key];
          const active = params.status === kpi.key;
          const href = kpi.key === "TOTAL" ? "/reconciliation" : `/reconciliation?status=${kpi.key}`;
          return (
            <Link key={kpi.key} href={href}>
              <Card
                className={cn(
                  "transition-shadow hover:shadow-md",
                  active && "ring-2 ring-primary"
                )}
              >
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-xl font-semibold">{value.toLocaleString("es-MX")}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Tienda</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead className="text-right">Generado</TableHead>
              <TableHead className="text-right">Enviado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No hay registros para este filtro.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell className="font-medium">{r.userName}</TableCell>
                <TableCell>{r.storeName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.orderRef}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.generated)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.submitted)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.paid)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    r.difference !== 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {formatCurrency(r.difference)}
                </TableCell>
                <TableCell>
                  <ReconciliationStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          makeHref={(p) => `/reconciliation?${status ? `status=${status}&` : ""}page=${p}`}
        />
      </Card>
    </div>
  );
}
