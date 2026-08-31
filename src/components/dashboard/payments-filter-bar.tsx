"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Download } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentFlowStatus } from "@/types/database";

const STATUS_OPTIONS: { value: PaymentFlowStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todos los estados" },
  { value: "GENERADO", label: "Generado" },
  { value: "ENVIADO_A_FINANZAS", label: "Enviado a Finanzas" },
  { value: "PAGADO", label: "Pagado" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "EN_PROCESO", label: "En Proceso" },
];

export function PaymentsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: q || null });
        }}
        className="relative flex-1"
      >
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuario, teléfono, tienda o referencia..."
          className="pl-8"
        />
      </form>

      <Select
        value={searchParams.get("status") ?? "ALL"}
        onValueChange={(value) => updateParams({ status: value === "ALL" ? null : value })}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-36"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => updateParams({ from: e.target.value || null })}
        />
        <span className="text-xs text-muted-foreground">a</span>
        <Input
          type="date"
          className="w-36"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => updateParams({ to: e.target.value || null })}
        />
      </div>

      <Button variant="outline" size="sm" asChild>
        <a href={`/api/payments/export?${searchParams.toString()}`}>
          <Download />
          Exportar CSV
        </a>
      </Button>
    </div>
  );
}
