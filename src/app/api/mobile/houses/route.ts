import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";
import { isValidCoordinate } from "@/lib/geo";
import { currentCycleId } from "@/lib/cycles";
import { loadSettings } from "@/lib/visits";
import type { House } from "@/lib/types";

/**
 * The auditor's round: every house in their district, flagged with whether they
 * have already visited it in the current cycle. After the first door-to-door
 * pass this list is the route.
 */
export async function GET(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  const db = adminDb();
  const settings = await loadSettings();
  const cycleId = currentCycleId(settings.collectionDays);

  const houseSnap = await db
    .collection("houses")
    .where("districtId", "==", auditor.districtId)
    .get();

  const visitedThisCycle = new Set<string>();
  if (cycleId) {
    const visitSnap = await db
      .collection("visits")
      .where("auditorId", "==", auditor.uid)
      .where("cycleId", "==", cycleId)
      .get();
    for (const doc of visitSnap.docs) {
      visitedThisCycle.add(doc.data().houseId as string);
    }
  }

  const houses = houseSnap.docs
    .map((doc) => {
      const data = doc.data() as Omit<House, "id">;
      return {
        id: doc.id,
        serialNumber: data.serialNumber,
        description: data.description ?? "",
        refLat: data.refLat ?? null,
        refLng: data.refLng ?? null,
        registeredByMe: data.registeredBy === auditor.uid,
        visitedThisCycle: visitedThisCycle.has(doc.id),
      };
    })
    .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber, undefined, {
      numeric: true,
    }));

  return NextResponse.json({
    cycleId,
    total: houses.length,
    visited: houses.filter((h) => h.visitedThisCycle).length,
    houses,
  });
}

/**
 * Registers a house discovered door-to-door. The auditor supplies the serial
 * number; the coordinates captured here become that house's permanent
 * reference location, so the very first visit defines the yardstick.
 */
export async function POST(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  let body: {
    serialNumber?: string;
    lat?: number;
    lng?: number;
    gpsAccuracy?: number | null;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const serialNumber = body.serialNumber?.trim();
  if (!serialNumber) {
    return NextResponse.json(
      { error: "A serial number is required." },
      { status: 400 },
    );
  }
  if (!isValidCoordinate(body.lat, body.lng)) {
    return NextResponse.json(
      { error: "A valid location is required to register a house." },
      { status: 400 },
    );
  }

  const db = adminDb();

  // Serial numbers are unique per district. Auditors invent them in the field,
  // so this check is what stops two people claiming the same number.
  const clash = await db
    .collection("houses")
    .where("districtId", "==", auditor.districtId)
    .where("serialNumber", "==", serialNumber)
    .limit(1)
    .get();

  if (!clash.empty) {
    return NextResponse.json(
      {
        error: `House ${serialNumber} is already registered in this district.`,
        existingHouseId: clash.docs[0].id,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const doc = await db.collection("houses").add({
    serialNumber,
    districtId: auditor.districtId,
    refLat: body.lat,
    refLng: body.lng,
    refAccuracy: body.gpsAccuracy ?? null,
    refSetBy: auditor.uid,
    refSetAt: now,
    registeredBy: auditor.uid,
    description: body.description?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { id: doc.id, serialNumber, refLat: body.lat, refLng: body.lng },
    { status: 201 },
  );
}
