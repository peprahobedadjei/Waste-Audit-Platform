import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

/** Updates the signed-in user's own display name and profile photo. */
export async function PATCH(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { name?: string; avatarUrl?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return badRequest("Name cannot be empty.");
    if (name.length > 80) return badRequest("Name is too long.");
    update.name = name;
  }

  if (body.avatarUrl !== undefined) {
    update.avatarUrl = body.avatarUrl || null;
  }

  try {
    const db = adminDb();
    await db.collection("users").doc(user.uid).update(update);

    if (update.name) {
      await adminAuth().updateUser(user.uid, {
        displayName: update.name as string,
      });
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "profile.update",
      targetType: "user",
      targetId: user.uid,
      detail: update,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not save your profile.");
  }
}
