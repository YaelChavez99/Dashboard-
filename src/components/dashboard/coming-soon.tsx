import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
        <Construction className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Próximamente</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Fase 2 del roadmap — Overview, Pagos, Usuarios y Conciliación se
          construyeron primero para validar el modelo financiero.
        </p>
      </div>
    </div>
  );
}
