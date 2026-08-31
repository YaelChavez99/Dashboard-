"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-config";

function isActive(pathname: string, href: string) {
  const base = href.split("?")[0];
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of NAV_SECTIONS) {
      if (section.children?.some((child) => isActive(pathname, child.href))) {
        initial[section.label] = true;
      }
    }
    return initial;
  });

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_SECTIONS.map((section) => {
        const Icon = section.icon;

        if (!section.children) {
          const active = isActive(pathname, section.href!);
          return (
            <Link
              key={section.label}
              href={section.href!}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {section.label}
            </Link>
          );
        }

        const open = openSections[section.label] ?? false;
        const sectionActive = section.children.some((child) => isActive(pathname, child.href));

        return (
          <div key={section.label}>
            <button
              type="button"
              onClick={() =>
                setOpenSections((prev) => ({ ...prev, [section.label]: !open }))
              }
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                sectionActive
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{section.label}</span>
              <ChevronDown
                className={cn("size-3.5 transition-transform", open && "rotate-180")}
              />
            </button>
            {open && (
              <div className="ml-3.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3.5 py-0.5">
                {section.children.map((child) => {
                  const ChildIcon = child.icon;
                  const active = isActive(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {ChildIcon && <ChildIcon className="size-3.5 shrink-0" />}
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
