import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AlertsPanel({
  alerts,
}: {
  alerts: { label: string; count: number; href: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" />
            Sin alertas activas.
          </div>
        ) : (
          alerts.map((alert) => (
            <Link
              key={alert.label}
              href={alert.href}
              className="flex items-center gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-sm hover:bg-warning/10"
            >
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span>
                <strong className="font-semibold">{alert.count}</strong> {alert.label}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
