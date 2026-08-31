import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";

export function BreakdownBars({
  title,
  items,
  showOnTimePct = false,
}: {
  title: string;
  items: { label: string; count: number; onTimePct?: number }[];
  showOnTimePct?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-xs font-medium text-muted-foreground" title={item.label}>
                {item.label}
              </div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-primary transition-all"
                  style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
                />
              </div>
              <div className="w-14 shrink-0 text-right text-xs font-semibold">
                {item.count.toLocaleString("es-MX")}
              </div>
              {showOnTimePct && (
                <div className="w-14 shrink-0 text-right text-xs text-success">
                  {formatPercent(item.onTimePct ?? 0, 0)}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
