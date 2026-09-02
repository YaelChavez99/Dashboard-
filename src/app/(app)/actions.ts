"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";
import { isDemoMode } from "@/lib/data/demo-mode";

export async function signOutAction() {
  if (!isDemoMode()) {
    await signOut({ redirect: false });
  }
  redirect("/login");
}
