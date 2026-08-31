"use client";

import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency, formatDate } from "@/lib/utils";
import type { TrendPoint } from "@/lib/data/overview";

const SERIES = [
  { key: "generated", label: "Generado", color: "var(--color-chart-1)" },
  { key: "submitted", label: "Enviado a Finanzas", color: "var(--color-chart-4)" },
  { key: "paid", label: "Pagado", color: "var(--color-chart-2)" },
] as const;

export function FinancialTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Financial Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin datos suficientes para el periodo seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v)}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) => formatCompactCurrency(v)}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                formatter={(value) => formatCompactCurrency(Number(value))}
                labelFormatter={(v) => formatDate(v as string)}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${s.key})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
