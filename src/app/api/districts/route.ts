import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";
import type { District } from "@/lib/types";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const snap = await adminDb().collection("districts").orderBy("name").get();
    const districts = snap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as District,
    );
    return NextResponse.json({ districts });
  } catch {
    return serverError("Could not load districts.");
  }
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { name?: string; centerLat?: number; centerLng?: number };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("District name is required.");

  try {
    const db = adminDb();

    // District names must be unique - auditors and houses are scoped by them
    const existing = await db
      .collection("districts")
      .where("name", "==", name)
      .limit(1)
      .get();
    if (!existing.empty) {
      return badRequest(`A district named "${name}" already exists.`);
    }

    const now = new Date().toISOString();
    const doc = await db.collection("districts").add({
      name,
      centerLat: body.centerLat ?? null,
      centerLng: body.centerLng ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "district.create",
      targetType: "district",
      targetId: doc.id,
      detail: { name },
      createdAt: now,
    });

    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch {
    return serverError("Could not create the district.");
  }
}
