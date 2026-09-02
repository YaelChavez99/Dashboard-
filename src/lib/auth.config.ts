import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe half of the NextAuth config — no Prisma import anywhere in
// this file's graph. Next.js middleware runs on the Edge runtime, which
// can't bundle Prisma Client (it needs Node APIs) — so middleware.ts
// builds its own `auth()` from just this config, while src/lib/auth.ts
// (used everywhere else, which does run on Node) extends it with the
// Prisma-touching signIn callback.
export const authConfig = {
  trustHost: true,
  providers: [Google],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
