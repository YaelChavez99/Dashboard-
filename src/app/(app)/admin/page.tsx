import { Database, CheckCircle2, XCircle, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/dashboard/sync-button";
import { DemoModeBanner } from "@/components/dashboard/demo-mode-banner";
import { getRecentSyncLogs } from "@/lib/data/sync-logs";
import { isDemoMode } from "@/lib/data/demo-mode";
import { formatDate } from "@/lib/utils";

export default async function AdminPage() {
  const logs = await getRecentSyncLogs();
  const lastLog = logs[0];

  return (
    <div className="flex flex-col gap-6">
      {isDemoMode() && <DemoModeBanner />}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Sincronización con Google Sheets, estado del sistema y logs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="size-4" />
            Sincronización de datos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Última sincronización</p>
              <p className="mt-1 text-sm font-medium">
                {lastLog ? formatDate(lastLog.started_at) : "Nunca"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Estado</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {lastLog?.status === "SUCCESS" && (
                  <>
                    <CheckCircle2 className="size-4 text-success" /> Sincronizado
                  </>
                )}
                {lastLog?.status === "FAILED" && (
                  <>
                    <XCircle className="size-4 text-destructive" /> Con errores
                  </>
                )}
                {!lastLog && (
                  <>
                    <Clock className="size-4 text-muted-foreground" /> Sin sincronizar
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Registros (última hoja)</p>
              <p className="mt-1 text-sm font-medium">
                {lastLog ? `${lastLog.records_inserted} / ${lastLog.records_read}` : "—"}
              </p>
            </div>
          </div>

          <SyncButton disabled={isDemoMode()} />
          {isDemoMode() && (
            <p className="text-xs text-muted-foreground">
              Deshabilitado en modo demo — conecta Supabase y Google Sheets (ver .env.example) para activarlo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground">Historial de sincronización</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {logs.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Sin sincronizaciones registradas todavía.</p>
          ) : (
            <div className="flex flex-col">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 text-sm"
                >
                  <span className="font-medium">{log.source_sheet}</span>
                  <span className="text-muted-foreground">{formatDate(log.started_at)}</span>
                  <span className="text-muted-foreground">
                    {log.records_inserted} escritos / {log.records_read} leídos
                  </span>
                  <Badge variant={log.status === "SUCCESS" ? "success" : log.status === "FAILED" ? "destructive" : "muted"}>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
