"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "12 meses" },
];

export function AnalyticsFilterBar({
  states,
  stores,
}: {
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

  const days = searchParams.get("days") ?? "30";
  const state = searchParams.get("state") ?? "ALL";
  const storeId = searchParams.get("storeId") ?? "ALL";

  return (
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
  );
}
