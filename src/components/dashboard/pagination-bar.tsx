import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PaginationBar({
  page,
  pageSize,
  total,
  makeHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Mostrando <strong className="font-medium text-foreground">{from}-{to}</strong> de{" "}
        <strong className="font-medium text-foreground">{total}</strong> registros
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? (
            <Link href={makeHref(page - 1)}>
              <ChevronLeft />
              Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft />
              Anterior
            </span>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
          {page < totalPages ? (
            <Link href={makeHref(page + 1)}>
              Siguiente
              <ChevronRight />
            </Link>
          ) : (
            <span>
              Siguiente
              <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
