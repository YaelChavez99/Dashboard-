import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { BrandMark } from "@/components/layout/brand-mark";
import { requireCurrentUser } from "@/lib/data/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();
  const userName = user.profile.full_name || user.email || "Usuario";

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <BrandMark className="size-7 rounded-md text-xs" />
          <span className="text-sm font-semibold text-sidebar-foreground">
            Finance & Ops Control
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/60">
          v0.1 · Datos vía Google Sheets
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={userName} userEmail={user.email} role={user.profile.role} />
        <main className="flex-1 bg-background p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
