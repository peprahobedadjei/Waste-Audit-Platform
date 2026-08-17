import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireAdmin, serverError } from "@/lib/api-auth";
import { createInvite, provisionAuthUser } from "@/lib/invites";
import { sendAuditorInvite } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import { EMPTY_SCOPE, type ManagerAccount } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const snap = await adminDb().collection("users").orderBy("name").get();
    const managers = snap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ManagerAccount,
    );
    return NextResponse.json({ managers });
  } catch {
    return serverError("Could not load sub-admins.");
  }
}

/** Invites a sub-admin. They set their own password from the emailed link. */
export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  let body: { name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name) return badRequest("Name is required.");
  if (!email) return badRequest("Email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("That email address is not valid.");
  }

  try {
    const db = adminDb();

    const clash = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!clash.empty) {
      return badRequest(`An account with the email ${email} already exists.`);
    }

    const auditorClash = await db
      .collection("auditors")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!auditorClash.empty) {
      return badRequest(
        "That email already belongs to an auditor. Use a different address.",
      );
    }

    const uid = await provisionAuthUser({ email, name, role: "manager" });
    const now = new Date().toISOString();

    await db
      .collection("users")
      .doc(uid)
      .set({
        name,
        email,
        role: "manager",
        avatarUrl: null,
        status: "invited",
        // Starts with nothing assigned. A new sub-admin must see nothing until
        // the system administrator grants scope deliberately.
        scope: EMPTY_SCOPE,
        invitedAt: now,
        activatedAt: null,
        createdAt: now,
        updatedAt: now,
      });

    const inviteUrl = await createInvite(uid, "manager");

    let emailSent = true;
    try {
      const branding = await getBranding();
      await sendAuditorInvite({
        to: email,
        auditorName: name,
        districtName: "",
        inviteUrl,
        appName: branding.appName,
        role: "manager",
      });
    } catch {
      emailSent = false;
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "manager.invite",
      targetType: "user",
      targetId: uid,
      detail: { name, email, emailSent },
      createdAt: now,
    });

    return NextResponse.json({ id: uid, emailSent }, { status: 201 });
  } catch {
    return serverError("Could not invite the sub-admin.");
  }
}
