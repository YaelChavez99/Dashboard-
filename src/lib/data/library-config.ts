// Centralized hub of tools, data sources, and dashboards. Edit this file to
// add or update entries — every link here is real (confirmed with Luis/Yael
// during setup), not a placeholder. Add a new category or item as more
// tools come online (n8n workflow, Notion, etc.).

import {
  Code2,
  Database,
  FileSpreadsheet,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export interface LibraryItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

export interface LibraryCategory {
  title: string;
  items: LibraryItem[];
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    title: "Dashboards",
    items: [
      {
        label: "Analytics operativo",
        description: "Volumen de órdenes, entregas, on-time% y distancia por tienda y estado.",
        href: "/analytics",
        icon: LineChart,
      },
    ],
  },
  {
    title: "Fuentes de datos",
    items: [
      {
        label: "Google Sheet — Data BA",
        description: "Hoja operativa original usada para auditar el esquema del dashboard.",
        href: "https://docs.google.com/spreadsheets/d/1dOfBB8gcZsBR-GTPkYQcOdTbpbXH0MQk0FHuri6uRqY/edit",
        icon: FileSpreadsheet,
        external: true,
      },
      {
        label: "BigQuery — ext_bodega_aurrera",
        description: "Tabla fuente operativa en el proyecto zb-data-bu-mexico-dev.",
        href: "https://console.cloud.google.com/bigquery?project=zb-data-bu-mexico-dev",
        icon: Database,
        external: true,
      },
    ],
  },
  {
    title: "Código",
    items: [
      {
        label: "Repositorio (GitHub)",
        description: "Código fuente completo del dashboard.",
        href: "https://github.com/YaelChavez99/dashboard-",
        icon: Code2,
        external: true,
      },
    ],
  },
];
