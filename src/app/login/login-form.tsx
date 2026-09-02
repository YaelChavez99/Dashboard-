"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const error = searchParams.get("error");

  function handleGoogleSignIn() {
    setLoading(true);
    signIn("google", { callbackUrl: searchParams.get("redirectTo") || "/" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">
          Accede al centro de control financiero y operativo con tu cuenta de Google
          Workspace de Zubale.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error === "AccessDenied"
            ? "Solo cuentas @zubale.com pueden entrar."
            : "No se pudo iniciar sesión. Intenta de nuevo."}
        </p>
      )}

      <Button type="button" disabled={loading} onClick={handleGoogleSignIn} className="mt-1">
        Iniciar sesión con Google
      </Button>
    </div>
  );
}
