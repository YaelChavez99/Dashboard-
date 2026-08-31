import { Badge } from "@/components/ui/badge";
import type { PaymentFlowStatus, ReconciliationStatus } from "@/types/database";

const PAYMENT_STATUS_CONFIG: Record<
  PaymentFlowStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "muted" }
> = {
  GENERADO: { label: "Generado", variant: "outline" },
  ENVIADO_A_FINANZAS: { label: "Enviado a Finanzas", variant: "default" },
  PAGADO: { label: "Pagado", variant: "success" },
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  RECHAZADO: { label: "Rechazado", variant: "destructive" },
  EN_PROCESO: { label: "En Proceso", variant: "secondary" },
};

export function PaymentStatusBadge({ status }: { status: PaymentFlowStatus }) {
  const config = PAYMENT_STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const RECONCILIATION_STATUS_CONFIG: Record<
  ReconciliationStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "muted" }
> = {
  CONCILIADO: { label: "Conciliado", variant: "success" },
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  DIFERENCIA: { label: "Diferencia", variant: "destructive" },
  DUPLICADO: { label: "Duplicado", variant: "secondary" },
  SIN_MATCH: { label: "Sin Match", variant: "muted" },
};

export function ReconciliationStatusBadge({ status }: { status: ReconciliationStatus }) {
  const config = RECONCILIATION_STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
