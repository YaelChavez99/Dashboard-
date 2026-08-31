"use client";

import { Menu, LogOut, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { BrandMark } from "./brand-mark";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";
import { signOutAction } from "@/app/(app)/actions";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  userName,
  userEmail,
  role,
}: {
  userName: string;
  userEmail: string | null;
  role: UserRole;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <div className="flex h-14 items-center gap-2.5 px-4">
            <BrandMark className="size-7 rounded-md text-xs" />
            <span className="text-sm font-semibold text-sidebar-foreground">
              Finance & Ops
            </span>
          </div>
          <div className="py-2">
            <SidebarNav />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent">
            <Avatar className="size-7">
              <AvatarFallback>{initials(userName)}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight">{userName}</p>
              <p className="text-xs leading-tight text-muted-foreground">
                {ROLE_LABELS[role]}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserIcon />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem variant="destructive" asChild>
              <button type="submit" className="w-full">
                <LogOut />
                Cerrar sesión
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
