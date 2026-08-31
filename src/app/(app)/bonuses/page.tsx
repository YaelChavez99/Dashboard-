import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/dashboard/pagination-bar";
import { getBonuses } from "@/lib/data/bonuses";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function BonusesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const { rows, total, totalAmount, pageSize } = await getBonuses({ q: params.q, page });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Bonos</h1>
        <p className="text-sm text-muted-foreground">
          Fuente: hoja Bonos-Supply — bonos y reembolsos operativos por usuario y tienda.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Total Bonos</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Registros</p>
            <p className="mt-1 text-xl font-semibold">{total.toLocaleString("es-MX")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Verificados</p>
            <p className="mt-1 text-xl font-semibold">
              {rows.filter((r) => r.paymentChecked).length} / {rows.length}{" "}
              <span className="text-sm font-normal text-muted-foreground">(esta página)</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">Promedio</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(total > 0 ? totalAmount / total : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <form action="/bonuses" method="get">
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Buscar por usuario, tienda o tipo de bono..."
              className="max-w-sm"
            />
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Tienda</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Verificado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No se encontraron bonos con estos filtros.
                </TableCell>
              </TableRow>
            )}
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{formatDate(b.date)}</TableCell>
                <TableCell>
                  <p className="font-medium">{b.userName}</p>
                  <p className="text-xs text-muted-foreground">{b.userPhone}</p>
                </TableCell>
                <TableCell>{b.storeName}</TableCell>
                <TableCell className="text-muted-foreground">{b.area}</TableCell>
                <TableCell className="max-w-56 truncate">{b.typo}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(b.amount)}</TableCell>
                <TableCell>
                  <Badge variant={b.paymentChecked ? "success" : "muted"}>
                    {b.paymentChecked ? "Verificado" : "Pendiente"}
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
          makeHref={(p) => `/bonuses?${params.q ? `q=${encodeURIComponent(params.q)}&` : ""}page=${p}`}
        />
      </Card>
    </div>
  );
}
