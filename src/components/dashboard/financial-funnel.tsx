import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency, formatPercent } from "@/lib/utils";

export function FinancialFunnel({
  generated,
  submitted,
  paid,
}: {
  generated: number;
  submitted: number;
  paid: number;
}) {
  const steps = [
    { label: "Generado", value: generated, color: "bg-primary" },
    { label: "Enviado a Finanzas", value: submitted, color: "bg-[#1e3a8a]" },
    { label: "Pagado", value: paid, color: "bg-success" },
  ];
  const max = Math.max(generated, 1);

  const submittedPct = generated > 0 ? submitted / generated : 0;
  const paidOfSubmittedPct = submitted > 0 ? paid / submitted : 0;
  const paidOfGeneratedPct = generated > 0 ? paid / generated : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Financial Flow</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                {step.label}
              </div>
              <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className={`h-full rounded-md ${step.color} transition-all`}
                  style={{ width: `${Math.max((step.value / max) * 100, 2)}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right text-sm font-semibold">
                {formatCompactCurrency(step.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
          <div>
            <p className="text-lg font-semibold text-foreground">{formatPercent(submittedPct)}</p>
            <p className="text-xs text-muted-foreground">Enviado / Generado</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{formatPercent(paidOfSubmittedPct)}</p>
            <p className="text-xs text-muted-foreground">Pagado / Enviado</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{formatPercent(paidOfGeneratedPct)}</p>
            <p className="text-xs text-muted-foreground">Pagado / Generado</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
