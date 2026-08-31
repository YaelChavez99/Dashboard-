"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
];

export function AnalyticsFilterBar({ zones }: { zones: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const granularity = searchParams.get("granularity") ?? "day";
  const days = searchParams.get("days") ?? "30";
  const zone = searchParams.get("zone") ?? "ALL";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={granularity} onValueChange={(v) => updateParams({ granularity: v })}>
        <TabsList>
          <TabsTrigger value="day">Día</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mes</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Select value={zone} onValueChange={(v) => updateParams({ zone: v === "ALL" ? null : v })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las zonas</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={days} onValueChange={(v) => updateParams({ days: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
