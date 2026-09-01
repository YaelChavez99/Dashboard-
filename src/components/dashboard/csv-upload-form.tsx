"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const BATCH_SIZE = 2000;

interface UploadResult {
  fileName: string;
  rowsRead: number;
  usersUpserted: number;
  storesUpserted: number;
  ordersUpserted: number;
  errors: number;
}

interface BatchResponse {
  rowsRead: number;
  usersUpserted: number;
  storesUpserted: number;
  ordersUpserted: number;
  errors: number;
  error?: string;
}

async function postBatch(fileName: string, rows: Record<string, unknown>[]): Promise<BatchResponse> {
  const res = await fetch("/api/sync/upload-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, rows }),
  });

  const raw = await res.text();
  let data: BatchResponse;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`El servidor respondió algo inesperado (código ${res.status}): ${raw.slice(0, 160)}`);
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || `Error del servidor (código ${res.status})`);
  }
  return data;
}

export function CsvUploadForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | { error: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setProgress("Leyendo archivo…");

    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (parsed.errors.length > 0) {
        setResult({ error: `Error leyendo el CSV: ${parsed.errors[0].message} (fila ${parsed.errors[0].row})` });
        return;
      }

      const rows = parsed.data;
      if (rows.length === 0) {
        setResult({ error: "El archivo no tiene filas de datos." });
        return;
      }
      if (rows[0].ORDER_ID === undefined) {
        setResult({
          error:
            "El CSV no tiene la columna ORDER_ID — debe ser un export directo de ext_bodega_aurrera " +
            "(mismas columnas: ORDER_ID, STATUS, STORE_NUMBER, STORE_NAME, STATE, DELIVERY_DATE, SLOT, " +
            "ON_TIME, DISTANCE_MAN_HAV, SHOPPER_FULL_NAME, SHOPPER_EMAIL, NO_LINES_REQUESTED, STORE_ID, " +
            "PEDIDOS_LATE, ZONA_CLASIFICACION, FECHA_LIMPIA).",
        });
        return;
      }

      const totals: UploadResult = {
        fileName: file.name,
        rowsRead: rows.length,
        usersUpserted: 0,
        storesUpserted: 0,
        ordersUpserted: 0,
        errors: 0,
      };

      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      for (let i = 0; i < totalBatches; i++) {
        setProgress(`Subiendo lote ${i + 1} de ${totalBatches} (${rows.length} filas en total)…`);
        const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const batchResult = await postBatch(file.name, batch);
        totals.usersUpserted += batchResult.usersUpserted;
        totals.storesUpserted += batchResult.storesUpserted;
        totals.ordersUpserted += batchResult.ordersUpserted;
        totals.errors += batchResult.errors;
      }

      setResult(totals);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
      setProgress(null);
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

      {loading && progress && <p className="text-xs text-muted-foreground">{progress}</p>}

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
