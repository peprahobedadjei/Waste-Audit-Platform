import { Suspense } from "react";
import Image from "next/image";
import { Recycle } from "lucide-react";
import { getBranding } from "@/lib/branding";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const branding = await getBranding();

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={branding.appName}
              width={56}
              height={56}
              className="mb-4 h-14 w-14 rounded-xl object-contain"
            />
          ) : (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-white">
              <Recycle className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-ink">{branding.appName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in to the manager dashboard
          </p>
        </div>

        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-lg bg-surface" />}
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Accounts are created by an administrator. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
