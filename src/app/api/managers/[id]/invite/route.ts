import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, serverError } from "@/lib/api-auth";
import { createInvite } from "@/lib/invites";
import { sendAuditorInvite } from "@/lib/email";
import { getBranding } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Regenerates a sub-admin's invite. Any earlier link stops working. */
export async function POST(_request: Request, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const db = adminDb();
    const snap = await db.collection("users").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Sub-admin not found." }, { status: 404 });
    }

    const account = snap.data() as { name: string; email: string };
    const inviteUrl = await createInvite(id, "manager");
    const branding = await getBranding();

    await sendAuditorInvite({
      to: account.email,
      auditorName: account.name,
      districtName: "",
      inviteUrl,
      appName: branding.appName,
      role: "manager",
    });

    const now = new Date().toISOString();
    await db.collection("users").doc(id).update({ invitedAt: now });
    await db.collection("auditLog").add({
      userId: user.uid,
      action: "manager.invite.resend",
      targetType: "user",
      targetId: id,
      detail: { email: account.email },
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError(
      "Could not send the invite. Check the email settings and try again.",
    );
  }
}
