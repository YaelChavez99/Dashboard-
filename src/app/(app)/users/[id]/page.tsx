import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, Store, MapPin } from "lucide-react";
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
import { PaymentStatusBadge } from "@/components/dashboard/status-badge";
import { CumulativePaymentsChart } from "@/components/dashboard/cumulative-payments-chart";
import { getUserDetail } from "@/lib/data/users";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentFlowStatus } from "@/types/database";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  const stats = [
    { label: "Total Generado", value: user.generated },
    { label: "Enviado a Finanzas", value: user.submitted },
    { label: "Total Pagado", value: user.paid },
    { label: "Pendiente", value: user.pending },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/users"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Usuarios
        </Link>
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{user.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {user.phone}
              </span>
              {user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {user.email}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Store className="size-3.5" />
                {user.storeName}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {user.zoneName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Transacciones</p>
            <p className="mt-1 text-xl font-semibold">{user.transactionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Promedio por pago</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(user.averagePayment)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Último pago</p>
            <p className="mt-1 text-xl font-semibold">
              {user.lastPaymentDate ? formatDate(user.lastPaymentDate) : "Sin pagos registrados"}
            </p>
          </CardContent>
        </Card>
      </div>

      <CumulativePaymentsChart data={user.cumulative} />

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tienda</TableHead>
              <TableHead>Periodo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {user.history.slice(0, 50).map((h) => (
              <TableRow key={h.id}>
                <TableCell>{formatDate(h.date)}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{h.concept}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(h.amount)}</TableCell>
                <TableCell>
                  <PaymentStatusBadge status={h.status as PaymentFlowStatus} />
                </TableCell>
                <TableCell>{h.storeName}</TableCell>
                <TableCell className="text-muted-foreground capitalize">{h.period}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
