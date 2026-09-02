import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { isDemoMode } from "@/lib/data/demo-mode";

// Edge-safe auth() built straight from the shared config — deliberately
// NOT imported from @/lib/auth, which pulls in Prisma (Node-only) via
// its signIn callback. See src/lib/auth.config.ts.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  // No Cloud SQL connection yet — every page runs against the seeded
  // demo dataset instead of gating on real auth.
  if (isDemoMode()) {
    return NextResponse.next({ request });
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  const session = await auth();

  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
