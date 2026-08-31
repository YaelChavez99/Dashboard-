import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            F
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              Finance & Operations
            </p>
            <p className="text-xs text-slate-400 leading-tight">Control</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-xl">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
