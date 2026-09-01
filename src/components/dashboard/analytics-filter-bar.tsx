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

export function AnalyticsFilterBar({
  zones,
  states,
  stores,
}: {
  zones: string[];
  states: string[];
  stores: { id: string; name: string }[];
}) {
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
  const state = searchParams.get("state") ?? "ALL";
  const storeId = searchParams.get("storeId") ?? "ALL";
  const status = searchParams.get("status") ?? "ALL";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs value={granularity} onValueChange={(v) => updateParams({ granularity: v })}>
        <TabsList>
          <TabsTrigger value="day">Día</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mes</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={storeId} onValueChange={(v) => updateParams({ storeId: v === "ALL" ? null : v })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tienda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las tiendas</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state} onValueChange={(v) => updateParams({ state: v === "ALL" ? null : v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {states.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={zone} onValueChange={(v) => updateParams({ zone: v === "ALL" ? null : v })}>
          <SelectTrigger className="w-40">
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

        <Select value={status} onValueChange={(v) => updateParams({ status: v === "ALL" ? null : v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estatus</SelectItem>
            <SelectItem value="DELIVERED">Entregado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="LATE">Retrasado</SelectItem>
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
