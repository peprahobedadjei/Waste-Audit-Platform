import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  let body: {
    name?: string;
    centerLat?: number | null;
    centerLng?: number | null;
    active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  try {
    const db = adminDb();
    const ref = db.collection("districts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "District not found." }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return badRequest("District name cannot be empty.");

      const clash = await db
        .collection("districts")
        .where("name", "==", name)
        .limit(1)
        .get();
      if (!clash.empty && clash.docs[0].id !== id) {
        return badRequest(`A district named "${name}" already exists.`);
      }
      update.name = name;
    }

    if (body.centerLat !== undefined) update.centerLat = body.centerLat;
    if (body.centerLng !== undefined) update.centerLng = body.centerLng;
    if (body.active !== undefined) update.active = body.active;

    await ref.update(update);

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "district.update",
      targetType: "district",
      targetId: id,
      detail: update,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not update the district.");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  try {
    const db = adminDb();

    // A district with auditors attached is archived, never removed - deleting it
    // would orphan their assignments and every house recorded under it.
    const auditors = await db
      .collection("auditors")
      .where("districtId", "==", id)
      .limit(1)
      .get();

    const now = new Date().toISOString();

    if (!auditors.empty) {
      await db.collection("districts").doc(id).update({
        active: false,
        updatedAt: now,
      });
      await db.collection("auditLog").add({
        userId: user.uid,
        action: "district.archive",
        targetType: "district",
        targetId: id,
        detail: { reason: "auditors assigned" },
        createdAt: now,
      });
      return NextResponse.json({ ok: true, archived: true });
    }

    await db.collection("districts").doc(id).delete();
    await db.collection("auditLog").add({
      userId: user.uid,
      action: "district.delete",
      targetType: "district",
      targetId: id,
      detail: {},
      createdAt: now,
    });

    return NextResponse.json({ ok: true, archived: false });
  } catch {
    return serverError("Could not remove the district.");
  }
}
