import { AlertCircle, Recycle } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getBranding } from "@/lib/branding";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";

type InviteDoc = {
  auditorId: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

async function resolveInvite(token: string) {
  if (!isAdminConfigured()) {
    return { error: "This service is not available right now." } as const;
  }

  const db = adminDb();
  const snap = await db.collection("invites").doc(token).get();
  if (!snap.exists) return { error: "This invite link is not valid." } as const;

  const invite = snap.data() as InviteDoc;
  if (invite.revokedAt) {
    return {
      error: "This link was replaced by a newer invite. Check your most recent email.",
    } as const;
  }
  if (invite.usedAt) {
    return { error: "This invite has already been used." } as const;
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return {
      error: "This invite has expired. Ask your manager to send a new one.",
    } as const;
  }

  const auditor = await db.collection("auditors").doc(invite.auditorId).get();
  if (!auditor.exists) {
    return { error: "This invite is no longer valid." } as const;
  }

  const data = auditor.data() as { name: string; districtId: string };
  const district = await db.collection("districts").doc(data.districtId).get();

  return {
    name: data.name,
    districtName: (district.data()?.name as string) ?? null,
  } as const;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [branding, result] = await Promise.all([
    getBranding(),
    resolveInvite(token),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-white">
            <Recycle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-ink">{branding.appName}</h1>
          <p className="mt-1 text-sm text-ink-muted">Set up your auditor account</p>
        </div>

        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          {"error" in result ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm text-ink">{result.error}</p>
            </div>
          ) : (
            <InviteClient
              token={token}
              name={result.name}
              districtName={result.districtName}
            />
          )}
        </div>
      </div>
    </main>
  );
}
