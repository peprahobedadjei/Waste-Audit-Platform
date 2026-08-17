import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";
import { isValidCoordinate } from "@/lib/geo";
import { loadSettings, recordVisit, validateVisit } from "@/lib/visits";

/** The auditor's own recent submissions. Read-only history for their app. */
export async function GET(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const snap = await adminDb()
    .collection("visits")
    .where("auditorId", "==", auditor.uid)
    .orderBy("capturedAt", "desc")
    .limit(limit)
    .get();

  // Deliberately omits `flagged`, `distanceFromRef` and review state. If
  // auditors could see the outcome they would learn the tolerance radius by
  // trial and error and work out how far from a house they can stand.
  const visits = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      houseId: data.houseId,
      serialNumber: data.serialNumber,
      cycleId: data.cycleId,
      collected: data.collected,
      satisfied: data.satisfied,
      cleanlinessRating: data.cleanlinessRating,
      photoUrl: data.photoUrl,
      capturedAt: data.capturedAt,
    };
  });

  return NextResponse.json({ visits });
}

/** Submits one visit. The distance check and flag are applied server-side. */
export async function POST(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!isValidCoordinate(body.lat, body.lng)) {
    return NextResponse.json(
      { error: "A valid location is required." },
      { status: 400 },
    );
  }

  const input = {
    houseId: String(body.houseId ?? ""),
    lat: body.lat as number,
    lng: body.lng as number,
    gpsAccuracy: (body.gpsAccuracy as number | null) ?? null,
    photoUrl: (body.photoUrl as string | null) ?? null,
    photoPublicId: (body.photoPublicId as string | null) ?? null,
    collected: body.collected as boolean,
    satisfied: body.satisfied as boolean,
    note: (body.note as string) ?? "",
    cleanlinessRating: Number(body.cleanlinessRating),
    capturedAt: (body.capturedAt as string) ?? undefined,
    clientId: (body.clientId as string | null) ?? null,
  };

  const invalid = validateVisit(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const settings = await loadSettings();
  const outcome = await recordVisit(auditor, input, settings);

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  // The response never reveals flag status - the app only ever says "Visit submitted."
  return NextResponse.json(
    { id: outcome.id, duplicate: outcome.duplicate },
    { status: outcome.duplicate ? 200 : 201 },
  );
}
