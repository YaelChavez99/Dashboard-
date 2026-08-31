import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/data/current-user";
import { isDemoMode } from "@/lib/data/demo-mode";
import { runSync } from "@/lib/sync/run-sync";

export async function POST() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "No hay un proyecto Supabase conectado — configura .env.local antes de sincronizar." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user || user.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede iniciar la sincronización." }, { status: 403 });
  }

  try {
    const summary = await runSync();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
