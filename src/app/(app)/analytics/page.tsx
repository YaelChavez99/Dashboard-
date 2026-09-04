import Link from "next/link";
import { Package, CheckCircle2, Clock, Route, ListOrdered } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsFilterBar } from "@/components/dashboard/analytics-filter-bar";
import { OrderVolumeChart } from "@/components/dashboard/order-volume-chart";
import { BreakdownBars } from "@/components/dashboard/breakdown-bars";
import { DemoModeBanner } from "@/components/dashboard/demo-mode-banner";
import {
  getAnalyticsOverview,
  getStorePerformance,
  getUserPerformance,
  getStateOptions,
  getStoreOptions,
  isOperationalDataLive,
} from "@/lib/data/analytics";
import { isDemoMode } from "@/lib/data/demo-mode";
import { formatPercent } from "@/lib/utils";

// Minimum sample size before a store/shopper's on-time% counts toward the
// "mayor oportunidad" (worst performers) view — a store with 2 orders and
// 0% on-time is noise, not a signal.
const MIN_STORE_SAMPLE = 10;
const MIN_SHOPPER_SAMPLE = 5;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; state?: string; storeId?: string }>;
}) {
  const params = await searchParams;
  const days = params.days ? Number(params.days) : 30;
  const state = params.state;
  const storeId = params.storeId;

  const filters = { days, state, storeId };

  const [overview, storePerf, userPerf, states, stores, liveData] = await Promise.all([
    getAnalyticsOverview(filters),
    getStorePerformance(filters),
    getUserPerformance(filters),
    getStateOptions(),
    getStoreOptions(),
    isOperationalDataLive(),
  ]);

  function withFilter(key: string, value: string) {
    const search = new URLSearchParams();
    if (days !== 30) search.set("days", String(days));
    if (state) search.set("state", state);
    if (storeId) search.set("storeId", storeId);
    search.set(key, value);
    return `/analytics?${search.toString()}`;
  }

  const kpis = [
    { label: "Total Órdenes", value: overview.totalOrders.toLocaleString("es-MX"), icon: Package, tone: "default" as const },
    { label: "Entregadas", value: overview.deliveredOrders.toLocaleString("es-MX"), icon: CheckCircle2, tone: "success" as const },
    { label: "On-Time %", value: formatPercent(overview.onTimePct), icon: Clock, tone: overview.onTimePct >= 0.85 ? "success" as const : "warning" as const },
    { label: "Distancia Prom.", value: `${overview.avgDistanceKm.toFixed(1)} km`, icon: Route, tone: "default" as const },
    { label: "Líneas Prom.", value: overview.avgLines.toFixed(1), icon: ListOrdered, tone: "default" as const },
  ];

  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  const topStores = [...storePerf].sort((a, b) => b.count - a.count).slice(0, 10);
  const worstStores = storePerf
    .filter((s) => s.count >= MIN_STORE_SAMPLE)
    .sort((a, b) => a.onTimePct - b.onTimePct)
    .slice(0, 10);

  const topShoppers = [...userPerf].sort((a, b) => b.count - a.count).slice(0, 10);
  const worstShoppers = userPerf
    .filter((u) => u.count >= MIN_SHOPPER_SAMPLE)
    .sort((a, b) => a.onTimePct - b.onTimePct)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {isDemoMode() && <DemoModeBanner live={liveData} />}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Radiografía operativa — de {overview.onTimePct >= 0 ? formatPercent(overview.onTimePct) : "—"} de on-time
          general hasta dónde exactamente está el problema: estado, tienda, slot, distancia y shopper.
        </p>
      </div>

      <AnalyticsFilterBar states={states} stores={stores} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <div className={`flex size-6 items-center justify-center rounded-md ${toneClasses[kpi.tone]}`}>
                    <Icon className="size-3" />
                  </div>
                </div>
                <p className="text-lg font-semibold tracking-tight">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OrderVolumeChart data={overview.trend} />

      {(state || storeId) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Filtros activos:</span>
          {state && <Badge variant="muted">Estado: {state}</Badge>}
          {storeId && <Badge variant="muted">Tienda: {stores.find((s) => s.id === storeId)?.name ?? storeId}</Badge>}
          <Link href="/analytics" className="text-primary hover:underline">
            Limpiar filtros
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Dónde se queman más pedidos</h2>
        <p className="text-xs text-muted-foreground">
          Cada desglose ordena de peor a mejor on-time% — usa los filtros de arriba para seguir bajando de nivel
          (ej. un estado, y dentro de ese estado qué slot falla más).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownBars
          title="Por Estado"
          items={overview.stateBreakdown}
          showOnTimePct
          hrefFor={(label) => withFilter("state", label)}
        />
        <BreakdownBars title="Por Slot de Entrega" items={overview.slotBreakdown} showOnTimePct />
        <BreakdownBars title="Por Distancia" items={overview.distanceBreakdown} showOnTimePct />
        <BreakdownBars title="Por Tamaño de Orden (líneas)" items={overview.linesBreakdown} showOnTimePct />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Top Tiendas por Volumen</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Dist. Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topStores.map((s) => (
                <TableRow key={s.storeId}>
                  <TableCell className="font-medium">{s.storeName}</TableCell>
                  <TableCell className="text-right">{s.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-success">{formatPercent(s.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{s.avgDistance.toFixed(1)} km</TableCell>
                </TableRow>
              ))}
              {topStores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Tiendas con Mayor Oportunidad</h2>
            <p className="text-xs text-muted-foreground">Peor on-time%, mínimo {MIN_STORE_SAMPLE} órdenes en el periodo.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Retrasadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worstStores.map((s) => (
                <TableRow key={s.storeId}>
                  <TableCell className="font-medium">{s.storeName}</TableCell>
                  <TableCell className="text-right">{s.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-warning">{formatPercent(s.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{s.lateCount}</TableCell>
                </TableRow>
              ))}
              {worstStores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin tiendas con suficiente muestra todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Top Shoppers por Volumen</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shopper</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Dist. Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topShoppers.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <p className="font-medium">{u.userName}</p>
                    <p className="text-xs text-muted-foreground">{u.storeName}</p>
                  </TableCell>
                  <TableCell className="text-right">{u.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-success">{formatPercent(u.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{u.avgDistance.toFixed(1)} km</TableCell>
                </TableRow>
              ))}
              {topShoppers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Shoppers con Mayor Oportunidad</h2>
            <p className="text-xs text-muted-foreground">Peor on-time%, mínimo {MIN_SHOPPER_SAMPLE} órdenes en el periodo.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shopper</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Retrasadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worstShoppers.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <p className="font-medium">{u.userName}</p>
                    <p className="text-xs text-muted-foreground">{u.storeName}</p>
                  </TableCell>
                  <TableCell className="text-right">{u.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-warning">{formatPercent(u.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{u.lateCount}</TableCell>
                </TableRow>
              ))}
              {worstShoppers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin shoppers con suficiente muestra todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
