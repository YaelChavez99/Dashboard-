"use client";

import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceTrendPoint } from "@/lib/data/finance";
import { formatCompactCurrency } from "@/lib/utils";

export function RevenueMarginChart({ data }: { data: FinanceTrendPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    marginPct: d.revenue > 0 ? Math.round((d.margin / d.revenue) * 1000) / 10 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Revenue y Margen</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin datos suficientes para el periodo seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => formatCompactCurrency(v)}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  if (name === "Margen %") return [`${value}%`, name];
                  return [formatCompactCurrency(Number(value)), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="margin" name="Margen" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginPct"
                name="Margen %"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
