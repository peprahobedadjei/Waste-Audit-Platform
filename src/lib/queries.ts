import "server-only";

import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import type { Auditor, District, Visit } from "@/lib/types";

export type VisitFilters = {
  districtId?: string;
  auditorId?: string;
  cycleId?: string;
  flagged?: boolean;
  collected?: boolean;
  satisfied?: boolean;
  limit?: number;
};

export type Lookups = {
  districts: District[];
  auditors: Auditor[];
  districtNames: Record<string, string>;
  auditorNames: Record<string, string>;
};

export async function loadLookups(): Promise<Lookups> {
  if (!isAdminConfigured()) {
    return { districts: [], auditors: [], districtNames: {}, auditorNames: {} };
  }

  const db = adminDb();
  const [districtSnap, auditorSnap] = await Promise.all([
    db.collection("districts").orderBy("name").get(),
    db.collection("auditors").orderBy("name").get(),
  ]);

  const districts = districtSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as District,
  );
  const auditors = auditorSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
  );

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;
  const auditorNames: Record<string, string> = {};
  for (const a of auditors) auditorNames[a.id] = a.name;

  return { districts, auditors, districtNames, auditorNames };
}

/**
 * Loads visits with filters applied.
 *
 * Equality filters go to Firestore; the rest are applied in memory afterwards.
 * Firestore needs a composite index for every combination of where + orderBy,
 * and pushing all six filters down would mean maintaining dozens of them for a
 * dataset this size. Revisit if a single district ever exceeds a few thousand
 * visits per cycle.
 */
export async function loadVisits(filters: VisitFilters = {}): Promise<Visit[]> {
  if (!isAdminConfigured()) return [];

  const db = adminDb();
  let query = db.collection("visits") as FirebaseFirestore.Query;

  if (filters.districtId) {
    query = query.where("districtId", "==", filters.districtId);
  }
  if (filters.auditorId) {
    query = query.where("auditorId", "==", filters.auditorId);
  }
  if (filters.cycleId) {
    query = query.where("cycleId", "==", filters.cycleId);
  }
  if (filters.flagged !== undefined) {
    query = query.where("flagged", "==", filters.flagged);
  }

  const snap = await query.limit(filters.limit ?? 500).get();

  let visits = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);

  if (filters.collected !== undefined) {
    visits = visits.filter((v) => v.collected === filters.collected);
  }
  if (filters.satisfied !== undefined) {
    visits = visits.filter((v) => v.satisfied === filters.satisfied);
  }

  return visits.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export type DistrictStats = {
  districtId: string;
  name: string;
  visits: number;
  collectedRate: number;
  satisfiedRate: number;
  cleanliness: number;
  flagged: number;
};

/**
 * Rolls visits up per district.
 *
 * Rejected visits are excluded from every rate. A visit a manager has judged
 * not credible must not move the numbers the client is paying for.
 */
export function summariseByDistrict(
  visits: Visit[],
  districtNames: Record<string, string>,
): DistrictStats[] {
  const buckets = new Map<string, Visit[]>();

  for (const visit of visits) {
    if (visit.reviewStatus === "rejected") continue;
    const list = buckets.get(visit.districtId) ?? [];
    list.push(visit);
    buckets.set(visit.districtId, list);
  }

  const stats: DistrictStats[] = [];

  for (const [districtId, list] of buckets) {
    const total = list.length;
    stats.push({
      districtId,
      name: districtNames[districtId] ?? "Unknown",
      visits: total,
      collectedRate: total
        ? Math.round((list.filter((v) => v.collected).length / total) * 100)
        : 0,
      satisfiedRate: total
        ? Math.round((list.filter((v) => v.satisfied).length / total) * 100)
        : 0,
      cleanliness: total
        ? Number(
            (
              list.reduce((sum, v) => sum + (v.cleanlinessRating ?? 0), 0) / total
            ).toFixed(1),
          )
        : 0,
      flagged: list.filter((v) => v.flagged).length,
    });
  }

  return stats.sort((a, b) => a.name.localeCompare(b.name));
}
