import { FlaskConical } from "lucide-react";

export function DemoModeBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm text-primary">
      <FlaskConical className="size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Modo demo:</strong> no hay un proyecto Supabase
        conectado todavía, así que estás viendo datos de ejemplo con la misma
        estructura del Google Sheets auditado. Conecta las credenciales en{" "}
        <code className="rounded bg-primary/10 px-1 py-0.5 text-xs">.env.local</code> para
        usar datos reales.
      </p>
    </div>
  );
}
