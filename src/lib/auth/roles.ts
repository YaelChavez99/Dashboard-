import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  FINANCE: "Finanzas",
  OPERATIONS: "Operación",
  VIEWER: "Solo lectura",
};

const SECTION_ACCESS: Record<string, UserRole[]> = {
  overview: ["ADMIN", "FINANCE", "OPERATIONS", "VIEWER"],
  payments: ["ADMIN", "FINANCE", "VIEWER"],
  reconciliation: ["ADMIN", "FINANCE"],
  users: ["ADMIN", "FINANCE", "OPERATIONS", "VIEWER"],
  stores: ["ADMIN", "FINANCE", "OPERATIONS", "VIEWER"],
  zones: ["ADMIN", "FINANCE", "OPERATIONS", "VIEWER"],
  analytics: ["ADMIN", "FINANCE", "OPERATIONS", "VIEWER"],
  "data-quality": ["ADMIN", "FINANCE", "OPERATIONS"],
  reports: ["ADMIN", "FINANCE", "OPERATIONS"],
  admin: ["ADMIN"],
};

export function canAccess(role: UserRole, section: keyof typeof SECTION_ACCESS) {
  return SECTION_ACCESS[section]?.includes(role) ?? false;
}

export function canEditPaymentStatus(role: UserRole) {
  return role === "ADMIN" || role === "FINANCE";
}
