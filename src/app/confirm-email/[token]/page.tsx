import { AlertCircle, CheckCircle2, Recycle } from "lucide-react";
import Link from "next/link";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

/**
 * Applies a pending email change. The link lands in the NEW inbox, so clicking
 * it is the proof that the address is real and reachable.
 */
async function applyChange(token: string) {
  if (!isAdminConfigured()) {
    return { error: "This service is not available right now." } as const;
  }

  const db = adminDb();
  const matches = await db
    .collection("users")
    .where("emailChangePending.token", "==", token)
    .limit(1)
    .get();

  if (matches.empty) {
    return { error: "This confirmation link is not valid." } as const;
  }

  const doc = matches.docs[0];
  const pending = doc.data().emailChangePending as {
    newEmail: string;
    expiresAt: string;
  };

  if (new Date(pending.expiresAt) < new Date()) {
    return {
      error: "This confirmation link has expired. Start the change again.",
    } as const;
  }

  const previousEmail = doc.data().email as string;

  await adminAuth().updateUser(doc.id, {
    email: pending.newEmail,
    emailVerified: true,
  });

  await doc.ref.update({
    email: pending.newEmail,
    emailChangePending: null,
    updatedAt: new Date().toISOString(),
  });

  // Signing in again with the new address is required
  await adminAuth().revokeRefreshTokens(doc.id);

  await db.collection("auditLog").add({
    userId: doc.id,
    action: "profile.email_change",
    targetType: "user",
    targetId: doc.id,
    detail: { from: previousEmail, to: pending.newEmail },
    createdAt: new Date().toISOString(),
  });

  return { newEmail: pending.newEmail } as const;
}

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [branding, result] = await Promise.all([
    getBranding(),
    applyChange(token).catch(() => ({
      error: "Could not confirm the change.",
    })),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-white">
            <Recycle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-ink">{branding.appName}</h1>
        </div>

        <div className="rounded-xl border border-line bg-white p-6 text-center shadow-sm">
          {"error" in result ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm text-ink">{result.error}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-ink">Email address updated</p>
              <p className="mt-2 text-sm text-ink-muted">
                Sign in from now on with <strong>{result.newEmail}</strong>.
              </p>
            </>
          )}

          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
