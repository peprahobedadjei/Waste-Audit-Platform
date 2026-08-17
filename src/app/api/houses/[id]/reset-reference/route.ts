import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Re-points a house's reference location at a chosen visit.
 *
 * The escape hatch for a bad first visit. If the original reference was set
 * from the wrong place, every honest visit afterwards is flagged forever - a
 * manager has to be able to correct it, and the correction has to be logged.
 */
export async function POST(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  let body: { visitId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const visitId = body.visitId;
  const reason = body.reason?.trim();

  if (!visitId) return badRequest("Choose the visit to use as the new reference.");
  if (!reason) return badRequest("A reason is required.");

  try {
    const db = adminDb();
    const houseRef = db.collection("houses").doc(id);
    const [houseSnap, visitSnap] = await Promise.all([
      houseRef.get(),
      db.collection("visits").doc(visitId).get(),
    ]);

    if (!houseSnap.exists) {
      return NextResponse.json({ error: "House not found." }, { status: 404 });
    }
    if (!visitSnap.exists || visitSnap.data()?.houseId !== id) {
      return badRequest("That visit does not belong to this house.");
    }

    const visit = visitSnap.data() as {
      lat: number;
      lng: number;
      gpsAccuracy: number | null;
    };
    const previous = houseSnap.data() as { refLat: number; refLng: number };
    const now = new Date().toISOString();

    await houseRef.update({
      refLat: visit.lat,
      refLng: visit.lng,
      refAccuracy: visit.gpsAccuracy ?? null,
      refSetBy: user.uid,
      refSetAt: now,
      updatedAt: now,
    });

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "house.reset_reference",
      targetType: "house",
      targetId: id,
      detail: {
        reason,
        fromVisit: visitId,
        previous: { lat: previous.refLat, lng: previous.refLng },
        next: { lat: visit.lat, lng: visit.lng },
      },
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not reset the reference location.");
  }
}
