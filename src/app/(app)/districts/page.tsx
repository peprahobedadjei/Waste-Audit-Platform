import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { PageHeader } from "@/components/ui/card";
import { DistrictsClient } from "./districts-client";
import type { District } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadDistricts(): Promise<{
  districts: District[];
  auditorCounts: Record<string, number>;
}> {
  if (!isAdminConfigured()) return { districts: [], auditorCounts: {} };

  const db = adminDb();
  const [districtSnap, auditorSnap] = await Promise.all([
    db.collection("districts").orderBy("name").get(),
    db.collection("auditors").get(),
  ]);

  const districts = districtSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as District,
  );

  const auditorCounts: Record<string, number> = {};
  for (const doc of auditorSnap.docs) {
    const districtId = doc.data().districtId as string | undefined;
    if (districtId) {
      auditorCounts[districtId] = (auditorCounts[districtId] ?? 0) + 1;
    }
  }

  return { districts, auditorCounts };
}

export default async function DistrictsPage() {
  const { districts, auditorCounts } = await loadDistricts();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Districts"
        description="Auditors and houses are scoped by district. Add all ten before inviting auditors."
      />
      <DistrictsClient districts={districts} auditorCounts={auditorCounts} />
    </div>
  );
}
