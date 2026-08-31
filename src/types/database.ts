export type UserRole = "ADMIN" | "FINANCE" | "OPERATIONS" | "VIEWER";

export type PaymentFlowStatus =
  | "GENERADO"
  | "ENVIADO_A_FINANZAS"
  | "PAGADO"
  | "PENDIENTE"
  | "RECHAZADO"
  | "EN_PROCESO";

export type ReconciliationStatus =
  | "CONCILIADO"
  | "PENDIENTE"
  | "DIFERENCIA"
  | "DUPLICADO"
  | "SIN_MATCH";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  store_id: string | null;
  zone_id: string | null;
}

export interface Zone {
  id: string;
  name: string;
}

export interface Store {
  id: string;
  store_number: string;
  store_ext_id: string;
  name: string;
  zone_id: string | null;
  tariff_model: string;
  charges_parking: boolean;
  parking_amount: number | null;
}

export interface AppUser {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  status: string;
}

export interface Order {
  id: string;
  order_id: string;
  status: string;
  store_id: string | null;
  delivery_date: string | null;
  on_time: boolean | null;
  distance_km: number | null;
  user_id: string | null;
  lines_requested: number | null;
  is_late: boolean;
  zone_id: string | null;
  clean_date: string | null;
  generated_amount: number | null;
}

export interface FinanceSubmission {
  id: string;
  submitted_date: string;
  store_id: string | null;
  user_id: string | null;
  description: string | null;
  amount: number;
  tariff_model: string | null;
  master_pagos_approved: boolean;
  order_id: string | null;
}

export interface PaymentClaim {
  id: string;
  submitted_at: string;
  claim_date: string | null;
  folio: string | null;
  user_phone: string | null;
  status: string | null;
  store_id: string | null;
  description: string | null;
  amount: number | null;
  send_status: string | null;
  paid_in_master: boolean;
  comments: string | null;
  user_id: string | null;
}

export interface Payment {
  id: string;
  user_id: string;
  store_id: string | null;
  period_label: string | null;
  payment_round: number;
  task_ref: string | null;
  amount: number;
  adjustment: number;
  matched: boolean | null;
  paid_at: string | null;
}

export interface ReconciliationRow {
  id: string;
  period_label: string | null;
  user_id: string | null;
  store_id: string | null;
  order_id: string | null;
  generated_amount: number;
  submitted_amount: number;
  paid_amount: number;
  difference: number;
  status: ReconciliationStatus;
}

export interface Bonus {
  id: string;
  bonus_date: string;
  week_service: string | null;
  brand: string;
  area: string | null;
  owner: string | null;
  typo: string;
  store_id: string | null;
  user_id: string | null;
  description: string | null;
  amount: number;
  payment_checked: boolean;
}

export interface SyncLog {
  id: string;
  source_sheet: string;
  started_at: string;
  finished_at: string | null;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  records_read: number;
  records_inserted: number;
  records_updated: number;
  errors_count: number;
}
