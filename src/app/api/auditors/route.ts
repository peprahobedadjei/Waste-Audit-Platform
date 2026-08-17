import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";
import { createInvite, provisionAuthUser } from "@/lib/invites";
import { sendAuditorInvite } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import type { Auditor } from "@/lib/types";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const snap = await adminDb().collection("auditors").orderBy("name").get();
    const auditors = snap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
    );
    return NextResponse.json({ auditors });
  } catch {
    return serverError("Could not load auditors.");
  }
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { name?: string; phone?: string; email?: string; districtId?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const name = body.name?.trim();
  const phone = body.phone?.trim() ?? "";
  const email = body.email?.trim().toLowerCase();
  const districtId = body.districtId?.trim();

  if (!name) return badRequest("Name is required.");
  if (!email) return badRequest("Email is required.");
  if (!districtId) return badRequest("District is required.");

  try {
    const db = adminDb();

    const district = await db.collection("districts").doc(districtId).get();
    if (!district.exists) return badRequest("That district does not exist.");

    const clash = await db
      .collection("auditors")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!clash.empty) {
      return badRequest(`An auditor with the email ${email} already exists.`);
    }

    const uid = await provisionAuthUser({ email, name });
    const now = new Date().toISOString();

    await db
      .collection("auditors")
      .doc(uid)
      .set({
        name,
        phone,
        email,
        districtId,
        status: "invited",
        invitedAt: now,
        activatedAt: null,
        createdAt: now,
        updatedAt: now,
      });

    const inviteUrl = await createInvite(uid);

    let emailSent = true;
    try {
      const branding = await getBranding();
      await sendAuditorInvite({
        to: email,
        auditorName: name,
        districtName: district.data()?.name ?? "your",
        inviteUrl,
        appName: branding.appName,
      });
    } catch {
      // The auditor still exists - the manager can resend from the list
      emailSent = false;
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "auditor.create",
      targetType: "auditor",
      targetId: uid,
      detail: { name, email, districtId, emailSent },
      createdAt: now,
    });

    return NextResponse.json({ id: uid, emailSent }, { status: 201 });
  } catch {
    return serverError("Could not create the auditor.");
  }
}
