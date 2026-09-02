import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

// Google Workspace domain allowed to sign in. Zubale-only — matches
// "no nos vamos a conectar a nada externo" for auth too.
const ALLOWED_DOMAIN = "zubale.com";

// Full config — Node.js runtime only (route handlers, server components,
// server actions). Never import this from middleware.ts; see
// src/lib/auth.config.ts for why.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ account, profile }) {
      const email = profile?.email;
      // `hd` is Google's hosted-domain claim — only present for Workspace
      // accounts, and more reliable than trusting the email suffix alone.
      const hostedDomain = (profile as { hd?: string } | undefined)?.hd;

      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`) || hostedDomain !== ALLOWED_DOMAIN) {
        return false;
      }
      if (!account?.providerAccountId) return false;

      // Provision the login profile on first sign-in — this is the
      // replacement for the old Supabase `on_auth_user_created` DB
      // trigger, which depended on a Supabase-managed auth.users table
      // that doesn't exist here.
      await db.profile.upsert({
        where: { google_id: account.providerAccountId },
        update: { email },
        create: {
          google_id: account.providerAccountId,
          email,
          full_name: profile?.name ?? null,
          role: "VIEWER",
        },
      });

      return true;
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.googleId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.googleId === "string") {
        (session as typeof session & { googleId: string }).googleId = token.googleId;
      }
      return session;
    },
  },
});
