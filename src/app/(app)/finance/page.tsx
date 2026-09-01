import { DollarSign, TrendingUp, Percent, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceFilterBar } from "@/components/dashboard/finance-filter-bar";
import { RevenueMarginChart } from "@/components/dashboard/revenue-margin-chart";
import { getFinanceOverview, type Granularity } from "@/lib/data/finance";
import { isDemoMode } from "@/lib/data/demo-mode";
import { formatCompactCurrency, formatPercent } from "@/lib/utils";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; days?: string }>;
}) {
  const params = await searchParams;
  const granularity = (params.granularity as Granularity) ?? "day";
  const days = params.days ? Number(params.days) : 30;

  const finance = await getFinanceOverview({ days, granularity });
  const demo = isDemoMode();

  const kpis = [
    {
      label: "Revenue",
      value: formatCompactCurrency(finance.totalRevenue),
      icon: DollarSign,
      tone: "default" as const,
    },
    {
      label: "Margen",
      value: formatCompactCurrency(finance.totalMargin),
      icon: TrendingUp,
      tone: "success" as const,
    },
    {
      label: "Margen %",
      value: formatPercent(finance.marginPct, 1),
      icon: Percent,
      tone: "default" as const,
    },
  ];

  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Revenue y margen por tienda.</p>
      </div>

      {!demo && finance.totalRevenue === 0 && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Aún no hay revenue calculado en los pedidos sincronizados — depende de conectar el modelo
            de tarifas por tienda a la sincronización operativa. Esta página se llenará automáticamente
            en cuanto eso quede conectado.
          </CardContent>
        </Card>
      )}

      <FinanceFilterBar />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <div className={`flex size-7 items-center justify-center rounded-md ${toneClasses[kpi.tone]}`}>
                    <Icon className="size-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-semibold tracking-tight">{kpi.value}</p>
                {kpi.label === "Revenue" && finance.revenueDeltaPct != null && (
                  <p
                    className={`flex items-center gap-1 text-xs font-medium ${
                      finance.revenueDeltaPct >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {finance.revenueDeltaPct >= 0 ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                    {formatPercent(Math.abs(finance.revenueDeltaPct), 1)} vs. periodo anterior
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RevenueMarginChart data={finance.trend} />

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Revenue y Margen por Tienda</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tienda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-right">Margen %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finance.byStore.map((s) => (
              <TableRow key={s.storeId}>
                <TableCell className="font-medium">{s.storeName}</TableCell>
                <TableCell className="text-muted-foreground">{s.state}</TableCell>
                <TableCell className="text-right">{s.orders.toLocaleString("es-MX")}</TableCell>
                <TableCell className="text-right">{formatCompactCurrency(s.revenue)}</TableCell>
                <TableCell className="text-right text-success">{formatCompactCurrency(s.margin)}</TableCell>
                <TableCell className="text-right">{formatPercent(s.marginPct, 1)}</TableCell>
              </TableRow>
            ))}
            {finance.byStore.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Sin datos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {demo && (
        <p className="text-xs text-muted-foreground">
          El margen mostrado aquí es una estimación calculada por tienda (datos de ejemplo) — se
          reemplazará por el cálculo real en cuanto el modelo de tarifas esté conectado a la
          sincronización operativa.
        </p>
      )}
    </div>
  );
}
