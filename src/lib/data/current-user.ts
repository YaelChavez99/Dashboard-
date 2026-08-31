import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { Profile } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile;
}

const DEMO_USER: CurrentUser = {
  id: "demo-admin",
  email: "demo@finance-ops.local",
  profile: {
    id: "demo-admin",
    full_name: "Usuario Demo",
    role: "ADMIN",
    store_id: null,
    zone_id: null,
  },
};

/**
 * Resolves the signed-in user's profile (role, store, zone).
 * Falls back to a VIEWER profile if the `profiles` row hasn't been
 * provisioned yet — the row is normally created by a DB trigger on
 * auth.users insert (see supabase/migrations).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode()) return DEMO_USER;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, store_id, zone_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    profile:
      profile ??
      ({
        id: user.id,
        full_name: user.email ?? null,
        role: "VIEWER",
        store_id: null,
        zone_id: null,
      } satisfies Profile),
  };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
