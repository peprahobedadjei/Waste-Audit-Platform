import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  let body: {
    name?: string;
    phone?: string;
    districtId?: string;
    status?: "invited" | "active" | "inactive";
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  try {
    const db = adminDb();
    const ref = db.collection("auditors").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Auditor not found." }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return badRequest("Name cannot be empty.");
      update.name = name;
      await adminAuth().updateUser(id, { displayName: name });
    }

    if (body.phone !== undefined) update.phone = body.phone.trim();

    if (body.districtId !== undefined) {
      const district = await db.collection("districts").doc(body.districtId).get();
      if (!district.exists) return badRequest("That district does not exist.");
      update.districtId = body.districtId;
    }

    if (body.status !== undefined) {
      update.status = body.status;
      // Deactivating must actually revoke access, not just change a label
      await adminAuth().updateUser(id, { disabled: body.status === "inactive" });
    }

    await ref.update(update);

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "auditor.update",
      targetType: "auditor",
      targetId: id,
      detail: update,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not update the auditor.");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  try {
    const db = adminDb();

    // An auditor who has submitted work is deactivated, never deleted - their
    // visits and the houses they registered must stay attributable.
    const visits = await db
      .collection("visits")
      .where("auditorId", "==", id)
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (!visits.empty) {
      await db.collection("auditors").doc(id).update({
        status: "inactive",
        updatedAt: now,
      });
      await adminAuth().updateUser(id, { disabled: true });
      await db.collection("auditLog").add({
        userId: user.uid,
        action: "auditor.deactivate",
        targetType: "auditor",
        targetId: id,
        detail: { reason: "has submitted visits" },
        createdAt: now,
      });
      return NextResponse.json({ ok: true, deactivated: true });
    }

    await db.collection("auditors").doc(id).delete();
    try {
      await adminAuth().deleteUser(id);
    } catch {
      // Auth record may already be gone; the auditor doc is what matters
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "auditor.delete",
      targetType: "auditor",
      targetId: id,
      detail: {},
      createdAt: now,
    });

    return NextResponse.json({ ok: true, deactivated: false });
  } catch {
    return serverError("Could not remove the auditor.");
  }
}
