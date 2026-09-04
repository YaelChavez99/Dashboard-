import {
  Users,
  Store,
  MapPin,
  LineChart,
  Settings,
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
  { label: "Analytics", icon: LineChart, href: "/analytics" },
  {
    label: "Operación",
    icon: Users,
    children: [
      { label: "Usuarios", href: "/users", icon: Users },
      { label: "Tiendas", href: "/stores", icon: Store },
      { label: "Zonas", href: "/zones", icon: MapPin },
    ],
  },
  { label: "Biblioteca", icon: Library, href: "/library" },
  { label: "Administración", icon: Settings, href: "/admin" },
];
