import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { currentScope } from "@/lib/queries";
import { PageHeader } from "@/components/ui/card";
import { DistrictsClient } from "./districts-client";
import type { District } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadDistricts(): Promise<{
  districts: District[];
  auditorCounts: Record<string, number>;
}> {
  if (!isAdminConfigured()) return { districts: [], auditorCounts: {} };

  const scope = await currentScope();
  const db = adminDb();
  const [districtSnap, auditorSnap] = await Promise.all([
    db.collection("districts").orderBy("name").get(),
    db.collection("auditors").get(),
  ]);

  let districts = districtSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as District,
  );
  if (scope.kind === "scoped") {
    districts = districts.filter((d) => scope.districtIds.includes(d.id));
  }

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
  const [user, { districts, auditorCounts }] = await Promise.all([
    getCurrentUser(),
    loadDistricts(),
  ]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Districts"
        description={
          isAdmin
            ? "Auditors and houses are scoped by district. Add all ten before inviting auditors."
            : "The districts assigned to you."
        }
      />
      <DistrictsClient
        districts={districts}
        auditorCounts={auditorCounts}
        canEdit={isAdmin}
      />
    </div>
  );
}
