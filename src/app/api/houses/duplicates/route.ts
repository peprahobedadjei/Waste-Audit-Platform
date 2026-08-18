import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Merges a duplicate house into the one being kept.
 *
 * Duplicates arise from offline registration: two auditors can register the
 * same serial number with no connection, and neither device can check the
 * other. Rather than deleting the loser - which would orphan its visits - the
 * visits are repointed at the survivor and the duplicate is archived.
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { keepId?: string; mergeId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const { keepId, mergeId } = body;
  const reason = body.reason?.trim();

  if (!keepId || !mergeId) return badRequest("Two houses are required.");
  if (keepId === mergeId) return badRequest("Choose two different records.");
  if (!reason) return badRequest("A reason is required.");

  try {
    const db = adminDb();
    const [keepSnap, mergeSnap] = await Promise.all([
      db.collection("houses").doc(keepId).get(),
      db.collection("houses").doc(mergeId).get(),
    ]);

    if (!keepSnap.exists || !mergeSnap.exists) {
      return NextResponse.json({ error: "House not found." }, { status: 404 });
    }
    if (keepSnap.data()?.serialNumber !== mergeSnap.data()?.serialNumber) {
      return badRequest("Those two houses do not share a serial number.");
    }

    const visits = await db
      .collection("visits")
      .where("houseId", "==", mergeId)
      .get();

    const now = new Date().toISOString();
    const batch = db.batch();

    for (const visit of visits.docs) {
      batch.update(visit.ref, { houseId: keepId });
    }

    // Archived rather than deleted, so the merge stays reconstructable
    batch.update(mergeSnap.ref, {
      mergedInto: keepId,
      archivedAt: now,
      updatedAt: now,
    });

    await batch.commit();

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "house.duplicate_resolved",
      targetType: "house",
      targetId: keepId,
      detail: {
        reason,
        mergedFrom: mergeId,
        serialNumber: keepSnap.data()?.serialNumber,
        visitsMoved: visits.size,
      },
      createdAt: now,
    });

    return NextResponse.json({ ok: true, visitsMoved: visits.size });
  } catch {
    return serverError("Could not merge those houses.");
  }
}
