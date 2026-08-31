import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { getUsers } from "@/lib/data/users";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const { rows, total, pageSize } = await getUsers({ q: params.q, page });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          {total} usuarios, ordenados por total pagado.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <form action="/users" method="get">
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Buscar por nombre, teléfono o correo..."
              className="max-w-sm"
            />
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Tienda</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead className="text-right">Generado</TableHead>
              <TableHead className="text-right">Enviado Finanzas</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>Último Pago</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/users/${u.id}`} className="font-medium text-primary hover:underline">
                    {u.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{u.phone}</p>
                </TableCell>
                <TableCell>{u.storeName}</TableCell>
                <TableCell className="text-muted-foreground">{u.zoneName}</TableCell>
                <TableCell className="text-right">{formatCurrency(u.generated)}</TableCell>
                <TableCell className="text-right">{formatCurrency(u.submitted)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(u.paid)}</TableCell>
                <TableCell className="text-right text-warning">
                  {u.pending > 0 ? formatCurrency(u.pending) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.lastPaymentDate ? formatDate(u.lastPaymentDate) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === "ACTIVE" ? "success" : "muted"}>
                    {u.status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          makeHref={(p) => `/users?${params.q ? `q=${encodeURIComponent(params.q)}&` : ""}page=${p}`}
        />
      </Card>
    </div>
  );
}
