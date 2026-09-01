import {
  LayoutDashboard,
  Wallet,
  History,
  GitCompareArrows,
  Clock,
  Users,
  Store,
  MapPin,
  Gift,
  LineChart,
  ShieldCheck,
  FileText,
  Settings,
  TrendingUp,
  Library,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavSection {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  {
    label: "Finanzas",
    icon: Wallet,
    children: [
      { label: "Revenue y Margen", href: "/finance", icon: TrendingUp },
      { label: "Pagos", href: "/payments", icon: History },
      { label: "Conciliación", href: "/reconciliation", icon: GitCompareArrows },
      { label: "Pendientes", href: "/payments?status=PENDIENTE", icon: Clock },
    ],
  },
  {
    label: "Operación",
    icon: Users,
    children: [
      { label: "Usuarios", href: "/users", icon: Users },
      { label: "Tiendas", href: "/stores", icon: Store },
      { label: "Zonas", href: "/zones", icon: MapPin },
      { label: "Bonos", href: "/bonuses", icon: Gift },
    ],
  },
  { label: "Analytics", icon: LineChart, href: "/analytics" },
  { label: "Biblioteca", icon: Library, href: "/library" },
  { label: "Calidad de Datos", icon: ShieldCheck, href: "/data-quality" },
  { label: "Reportes", icon: FileText, href: "/reports" },
  { label: "Administración", icon: Settings, href: "/admin" },
];
