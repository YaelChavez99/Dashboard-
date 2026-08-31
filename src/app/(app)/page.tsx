import { Wallet, Send, CheckCircle2, Clock, Users, Store, Receipt, AlertOctagon } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { FinancialFunnel } from "@/components/dashboard/financial-funnel";
import { FinancialTrendChart } from "@/components/dashboard/financial-trend-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DemoModeBanner } from "@/components/dashboard/demo-mode-banner";
import { getOverviewData } from "@/lib/data/overview";
import { isDemoMode } from "@/lib/data/demo-mode";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const periodDays = params.period ? Number(params.period) : 30;
  const data = await getOverviewData(periodDays);
  const { totals, previousTotals, trend, alerts } = data;

  return (
    <div className="flex flex-col gap-6">
      {isDemoMode() && <DemoModeBanner />}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Estado financiero y operativo de los últimos {periodDays} días.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Generado"
          value={totals.generated}
          previousValue={previousTotals.generated}
          icon={Wallet}
        />
        <KpiCard
          label="Enviado a Finanzas"
          value={totals.submitted}
          previousValue={previousTotals.submitted}
          icon={Send}
        />
        <KpiCard
          label="Total Pagado"
          value={totals.paid}
          previousValue={previousTotals.paid}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pendiente de Envío"
          value={totals.pendingSubmission}
          icon={AlertOctagon}
          tone="warning"
          href="/payments?status=GENERADO"
        />
        <KpiCard
          label="Pendiente de Pago"
          value={totals.pendingPayment}
          icon={Clock}
          tone="warning"
          href="/payments?status=PENDIENTE"
        />
        <KpiCard
          label="Usuarios"
          value={totals.userCount}
          icon={Users}
          format="number"
          href="/users"
        />
        <KpiCard
          label="Tiendas"
          value={totals.storeCount}
          icon={Store}
          format="number"
          href="/stores"
        />
        <KpiCard
          label="Transacciones"
          value={totals.transactionCount}
          icon={Receipt}
          format="number"
          href="/payments"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinancialTrendChart data={trend} />
        </div>
        <AlertsPanel alerts={alerts} />
      </div>

      <FinancialFunnel generated={totals.generated} submitted={totals.submitted} paid={totals.paid} />
    </div>
  );
}
