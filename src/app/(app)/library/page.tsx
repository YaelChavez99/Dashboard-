import Link from "next/link";
import { ExternalLink, ArrowRight, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { LIBRARY_CATEGORIES } from "@/lib/data/library-config";

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Biblioteca</h1>
        <p className="text-sm text-muted-foreground">
          Centro de herramientas, fuentes de datos y dashboards para managers y directivos.
        </p>
      </div>

      {LIBRARY_CATEGORIES.map((category) => (
        <div key={category.title} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">{category.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {category.items.map((item) => {
              const Icon = item.icon;
              const content = (
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <CardContent className="flex h-full flex-col gap-3 pt-5">
                    <div className="flex items-start justify-between">
                      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4.5" />
                      </div>
                      {item.external && <ExternalLink className="size-3.5 text-muted-foreground" />}
                      {!item.external && <ArrowRight className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );

              return item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              ) : (
                <Link key={item.label} href={item.href}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Herramientas del equipo</h2>
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
            <Sparkles className="size-4 shrink-0" />
            Aún no hay más herramientas centralizadas aquí — en cuanto tengas el flujo de n8n,
            documentación interna u otros enlaces, se agregan a esta sección.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
