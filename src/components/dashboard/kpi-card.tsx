import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCompactCurrency } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  previousValue,
  href,
  icon: Icon,
  format = "currency",
  tone = "default",
}: {
  label: string;
  value: number;
  previousValue?: number;
  href?: string;
  icon?: LucideIcon;
  format?: "currency" | "number";
  tone?: "default" | "warning" | "success";
}) {
  const formatted = format === "currency" ? formatCompactCurrency(value) : value.toLocaleString("es-MX");
  const hasComparison = typeof previousValue === "number" && previousValue !== 0;
  const delta = hasComparison ? (value - previousValue!) / Math.abs(previousValue!) : null;

  const content = (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        href && "cursor-pointer"
      )}
    >
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                tone === "warning" && "bg-warning/10 text-warning",
                tone === "success" && "bg-success/10 text-success",
                tone === "default" && "bg-primary/10 text-primary"
              )}
            >
              <Icon className="size-3.5" />
            </div>
          )}
        </div>
        <p className="text-2xl font-semibold tracking-tight">{formatted}</p>
        {delta !== null && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              delta >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta * 100).toFixed(1)}% vs periodo anterior
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
