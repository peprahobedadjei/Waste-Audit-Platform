import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, serverError } from "@/lib/api-auth";
import { createInvite } from "@/lib/invites";
import { sendAuditorInvite } from "@/lib/email";
import { getBranding } from "@/lib/branding";

type Params = { params: Promise<{ id: string }> };

/** Regenerates an auditor's invite and emails it. Any earlier link stops working. */
export async function POST(_request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  try {
    const db = adminDb();
    const snap = await db.collection("auditors").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Auditor not found." }, { status: 404 });
    }

    const auditor = snap.data() as {
      name: string;
      email: string;
      districtId: string;
    };
    const district = await db
      .collection("districts")
      .doc(auditor.districtId)
      .get();

    const inviteUrl = await createInvite(id);
    const branding = await getBranding();

    await sendAuditorInvite({
      to: auditor.email,
      auditorName: auditor.name,
      districtName: district.data()?.name ?? "your",
      inviteUrl,
      appName: branding.appName,
    });

    const now = new Date().toISOString();
    await db.collection("auditors").doc(id).update({ invitedAt: now });
    await db.collection("auditLog").add({
      userId: user.uid,
      action: "auditor.invite.resend",
      targetType: "auditor",
      targetId: id,
      detail: { email: auditor.email },
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError(
      "Could not send the invite. Check the email settings and try again.",
    );
  }
}
