import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
 * Resolves the signed-in user's profile (role, store, zone). Falls back
 * to a VIEWER profile if the `profiles` row somehow hasn't been
 * provisioned yet — it's normally created by the NextAuth signIn
 * callback on first login (see src/lib/auth.ts).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode()) return DEMO_USER;

  const session = await auth();
  const googleId = (session as { googleId?: string } | null)?.googleId;
  if (!session?.user || !googleId) return null;

  const profile = await db.profile.findUnique({ where: { google_id: googleId } });

  return {
    id: profile?.id ?? googleId,
    email: session.user.email ?? null,
    profile: profile
      ? {
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role as Profile["role"],
          store_id: profile.store_id,
          zone_id: profile.zone_id,
        }
      : {
          id: googleId,
          full_name: session.user.email ?? null,
          role: "VIEWER",
          store_id: null,
          zone_id: null,
        },
  };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
