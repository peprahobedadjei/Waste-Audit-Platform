import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { distanceMeters } from "@/lib/geo";
import { resolveCycleId } from "@/lib/cycles";
import { DEFAULT_SETTINGS, type AuditSettings } from "@/lib/types";
import { checkMissedCluster, raiseAlert } from "@/lib/alerts";
import type { AuthedAuditor } from "@/lib/mobile-auth";

export type VisitInput = {
  houseId: string;
  lat: number;
  lng: number;
  gpsAccuracy?: number | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  collected: boolean;
  satisfied: boolean;
  note?: string;
  cleanlinessRating: number;
  capturedAt?: string;
  clientId?: string | null;
};

export type VisitOutcome =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; status: number; error: string };

export async function loadSettings(): Promise<AuditSettings> {
  const snap = await adminDb().collection("settings").doc("audit").get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AuditSettings>) };
}

export function validateVisit(input: VisitInput): string | null {
  if (!input.houseId) return "A house must be selected.";
  if (typeof input.collected !== "boolean") {
    return "Answer whether the waste was collected.";
  }
  if (typeof input.satisfied !== "boolean") {
    return "Answer whether the resident is satisfied.";
  }
  if (!input.satisfied && !input.note?.trim()) {
    // An unexplained "not satisfied" tells the client nothing actionable
    return "A note is required when the resident is not satisfied.";
  }
  const rating = input.cleanlinessRating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Cleanliness must be rated between 1 and 5.";
  }
  return null;
}

/**
 * Records one visit and applies the location check.
 *
 * The flag decision happens here and only here. The device sends raw
 * coordinates; it never sends a distance and never sends a flag, so a tampered
 * build has nothing to lie about.
 */
export async function recordVisit(
  auditor: AuthedAuditor,
  input: VisitInput,
  settings: AuditSettings,
): Promise<VisitOutcome> {
  const db = adminDb();

  // Retry-safe: the app may resend a queued visit it never saw acknowledged
  if (input.clientId) {
    const existing = await db
      .collection("visits")
      .where("auditorId", "==", auditor.uid)
      .where("clientId", "==", input.clientId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { ok: true, id: existing.docs[0].id, duplicate: true };
    }
  }

  const houseRef = db.collection("houses").doc(input.houseId);
  const houseSnap = await houseRef.get();
  if (!houseSnap.exists) {
    return { ok: false, status: 404, error: "That house does not exist." };
  }

  const house = houseSnap.data() as {
    serialNumber: string;
    districtId: string;
    refLat: number | null;
    refLng: number | null;
  };

  if (house.districtId !== auditor.districtId) {
    return {
      ok: false,
      status: 403,
      error: "That house is outside your assigned district.",
    };
  }

  const now = new Date();
  const capturedAt = input.capturedAt ? new Date(input.capturedAt) : now;

  let distanceFromRef: number | null = null;
  let flagged = false;
  let isFirstVisit = false;

  if (house.refLat == null || house.refLng == null) {
    // Nothing to compare against, so this visit defines the reference
    isFirstVisit = true;
  } else {
    distanceFromRef = distanceMeters(
      house.refLat,
      house.refLng,
      input.lat,
      input.lng,
    );
    flagged = distanceFromRef > settings.toleranceMeters;
  }

  const visitRef = db.collection("visits").doc();

  await db.runTransaction(async (tx) => {
    if (isFirstVisit) {
      tx.update(houseRef, {
        refLat: input.lat,
        refLng: input.lng,
        refAccuracy: input.gpsAccuracy ?? null,
        refSetBy: auditor.uid,
        refSetAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    tx.set(visitRef, {
      houseId: input.houseId,
      serialNumber: house.serialNumber,
      auditorId: auditor.uid,
      districtId: auditor.districtId,
      cycleId: resolveCycleId(capturedAt, settings.collectionDays),
      lat: input.lat,
      lng: input.lng,
      gpsAccuracy: input.gpsAccuracy ?? null,
      photoUrl: input.photoUrl ?? null,
      photoPublicId: input.photoPublicId ?? null,
      collected: input.collected,
      satisfied: input.satisfied,
      note: input.note?.trim() ?? "",
      cleanlinessRating: input.cleanlinessRating,
      distanceFromRef,
      flagged,
      isFirstVisit,
      reviewStatus: flagged ? "pending" : null,
      reviewedBy: null,
      reviewReason: null,
      reviewedAt: null,
      capturedAt: capturedAt.toISOString(),
      receivedAt: now.toISOString(),
      clientId: input.clientId ?? null,
    });
  });

  // Alerts are raised after the write and never block it - a notification
  // failure must not cost an auditor a completed visit.
  const cycleId = resolveCycleId(capturedAt, settings.collectionDays);

  if (flagged) {
    const district = await db
      .collection("districts")
      .doc(auditor.districtId)
      .get();

    await raiseAlert({
      kind: "flagged_visit",
      title: `Flagged visit in ${district.data()?.name ?? "a district"}`,
      body: `${auditor.name} submitted a visit to house ${house.serialNumber} from ${distanceFromRef}m away from its reference location.`,
      auditorId: auditor.uid,
      districtId: auditor.districtId,
      link: `/visits/${visitRef.id}`,
    });
  }

  if (!input.collected) {
    const district = await db
      .collection("districts")
      .doc(auditor.districtId)
      .get();

    await checkMissedCluster({
      districtId: auditor.districtId,
      districtName: (district.data()?.name as string) ?? "a district",
      cycleId,
      auditorId: auditor.uid,
    });
  }

  return { ok: true, id: visitRef.id, duplicate: false };
}
