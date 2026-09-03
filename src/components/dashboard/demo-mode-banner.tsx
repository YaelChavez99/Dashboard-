import { FlaskConical, Radio } from "lucide-react";

export function DemoModeBanner({ live = false }: { live?: boolean }) {
  if (live) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm text-primary">
        <Radio className="size-4 shrink-0" />
        <p>
          <strong className="font-semibold">Datos en vivo (Google Sheets):</strong> esto es
          operación real, leída directo del Sheet auditado — todavía no hay una base de datos
          (Cloud SQL) conectada, así que nada se guarda entre lecturas. En cuanto TechOps
          provisione <code className="rounded bg-primary/10 px-1 py-0.5 text-xs">DATABASE_URL</code>{" "}
          la app usa esa base en su lugar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm text-primary">
      <FlaskConical className="size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Modo demo:</strong> no hay una base de datos (Cloud
        SQL) conectada todavía, así que estás viendo datos de ejemplo con la misma estructura
        del Google Sheets auditado. Conecta{" "}
        <code className="rounded bg-primary/10 px-1 py-0.5 text-xs">DATABASE_URL</code> en{" "}
        <code className="rounded bg-primary/10 px-1 py-0.5 text-xs">.env.local</code> para usar
        datos reales.
      </p>
    </div>
  );
}
