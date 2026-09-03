import Link from "next/link";
import { Package, CheckCircle2, Clock, XCircle, Users, Store } from "lucide-react";

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
  getZoneOptions,
  getStateOptions,
  getStoreOptions,
  isOperationalDataLive,
  type Granularity,
} from "@/lib/data/analytics";
import { isDemoMode } from "@/lib/data/demo-mode";
import { formatPercent } from "@/lib/utils";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    granularity?: string;
    days?: string;
    zone?: string;
    state?: string;
    storeId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const granularity = (params.granularity as Granularity) ?? "day";
  const days = params.days ? Number(params.days) : 30;
  const zone = params.zone;
  const state = params.state;
  const storeId = params.storeId;
  const status = params.status;

  const filters = { days, granularity, zone, state, storeId, status };

  const [overview, storePerf, userPerf, zones, states, stores, liveData] = await Promise.all([
    getAnalyticsOverview(filters),
    getStorePerformance(filters),
    getUserPerformance(filters),
    getZoneOptions(),
    getStateOptions(),
    getStoreOptions(),
    isOperationalDataLive(),
  ]);

  function withFilter(key: string, value: string) {
    const search = new URLSearchParams();
    if (granularity !== "day") search.set("granularity", granularity);
    if (days !== 30) search.set("days", String(days));
    if (zone) search.set("zone", zone);
    if (state) search.set("state", state);
    if (storeId) search.set("storeId", storeId);
    if (status) search.set("status", status);
    search.set(key, value);
    return `/analytics?${search.toString()}`;
  }

  const kpis = [
    { label: "Total Órdenes", value: overview.totalOrders.toLocaleString("es-MX"), icon: Package, tone: "default" as const },
    { label: "Entregadas", value: overview.deliveredOrders.toLocaleString("es-MX"), icon: CheckCircle2, tone: "success" as const },
    { label: "On-Time %", value: formatPercent(overview.onTimePct), icon: Clock, tone: overview.onTimePct >= 0.85 ? "success" as const : "warning" as const },
    { label: "Retrasadas", value: overview.lateCount.toLocaleString("es-MX"), icon: Clock, tone: "warning" as const },
    { label: "Canceladas", value: overview.cancelledOrders.toLocaleString("es-MX"), icon: XCircle, tone: "destructive" as const },
    { label: "Usuarios Activos", value: overview.activeUsers.toLocaleString("es-MX"), icon: Users, tone: "default" as const },
    { label: "Tiendas Activas", value: overview.activeStores.toLocaleString("es-MX"), icon: Store, tone: "default" as const },
  ];

  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="flex flex-col gap-6">
      {isDemoMode() && <DemoModeBanner live={liveData} />}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Vista operativa ejecutiva — volumen de órdenes, performance de usuarios y tiendas.
        </p>
      </div>

      <AnalyticsFilterBar zones={zones} states={states} stores={stores} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownBars
          title="Por Estatus (operación)"
          items={overview.statusBreakdown.map((s) => ({ label: s.status, count: s.count }))}
          hrefFor={(label) => {
            const code = overview.statusBreakdown.find((s) => s.status === label)?.code ?? label;
            return withFilter("status", code);
          }}
        />
        <BreakdownBars
          title="Por Zona"
          items={overview.zoneBreakdown.map((z) => ({ label: z.zone, count: z.count, onTimePct: z.onTimePct }))}
          showOnTimePct
          hrefFor={(label) => withFilter("zone", label)}
        />
        <BreakdownBars
          title="Por Estado (geográfico)"
          items={overview.stateBreakdown.map((s) => ({ label: s.state, count: s.count, onTimePct: s.onTimePct }))}
          showOnTimePct
          hrefFor={(label) => withFilter("state", label)}
        />
      </div>

      {(zone || state || storeId || status) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Filtros activos:</span>
          {zone && <Badge variant="muted">Zona: {zone}</Badge>}
          {state && <Badge variant="muted">Estado: {state}</Badge>}
          {storeId && <Badge variant="muted">Tienda: {stores.find((s) => s.id === storeId)?.name ?? storeId}</Badge>}
          {status && <Badge variant="muted">Estatus: {status}</Badge>}
          <Link href="/analytics" className="text-primary hover:underline">
            Limpiar filtros
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Top Tiendas por Órdenes</h2>
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
              {storePerf.slice(0, 10).map((s) => (
                <TableRow key={s.storeId}>
                  <TableCell className="font-medium">{s.storeName}</TableCell>
                  <TableCell className="text-right">{s.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-success">{formatPercent(s.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-warning">{s.lateCount}</TableCell>
                </TableRow>
              ))}
              {storePerf.length === 0 && (
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
            <h2 className="text-sm font-semibold text-foreground">Top Usuarios por Órdenes</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Dist. Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userPerf.slice(0, 10).map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <Link href={`/users/${u.userId}`} className="font-medium text-primary hover:underline">
                      {u.userName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{u.storeName}</p>
                  </TableCell>
                  <TableCell className="text-right">{u.count.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right text-success">{formatPercent(u.onTimePct, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{u.avgDistance.toFixed(1)} km</TableCell>
                </TableRow>
              ))}
              {userPerf.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin datos.
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
