"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface UploadResult {
  fileName: string;
  rowsRead: number;
  usersUpserted: number;
  storesUpserted: number;
  ordersUpserted: number;
  errors: number;
}

export function CsvUploadForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | { error: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/sync/upload-csv", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || loading}
      />
      <Button
        variant="outline"
        className="w-fit"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Upload />}
        Cargar CSV (export de ext_bodega_aurrera)
      </Button>

      {result && "error" in result && (
        <p className="max-w-lg rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      )}
      {result && "rowsRead" in result && (
        <div className="rounded-md border border-border p-3 text-xs">
          <p className="font-medium text-foreground">{result.fileName}</p>
          <p className="mt-1 text-muted-foreground">
            {result.rowsRead} filas leídas · {result.ordersUpserted} órdenes · {result.storesUpserted} tiendas ·{" "}
            {result.usersUpserted} usuarios
            {result.errors > 0 && <span className="text-destructive"> · {result.errors} errores</span>}
          </p>
        </div>
      )}
    </div>
  );
}
