"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SyncSummary } from "@/lib/sync/run-sync";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncSummary | { error: string } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleSync} disabled={disabled || loading} className="w-fit">
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Sincronizar datos
      </Button>
      {result && "error" in result && (
        <p className="max-w-lg rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      )}
      {result && "steps" in result && (
        <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-xs">
          {result.steps.map((s) => (
            <div key={s.sheet} className="flex items-center justify-between gap-4">
              <span className="font-medium">{s.sheet}</span>
              <span
                className={
                  s.status === "SUCCESS"
                    ? "text-success"
                    : s.status === "SKIPPED"
                      ? "text-muted-foreground"
                      : "text-destructive"
                }
              >
                {s.status} · {s.read} leídos, {s.inserted} escritos
                {s.errors > 0 ? `, ${s.errors} errores` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
