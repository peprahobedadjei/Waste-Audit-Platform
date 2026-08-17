import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { PageHeader } from "@/components/ui/card";
import { AuditorsClient } from "./auditors-client";
import type { Auditor, District } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadData(): Promise<{
  auditors: Auditor[];
  districts: District[];
}> {
  if (!isAdminConfigured()) return { auditors: [], districts: [] };

  const db = adminDb();
  const [auditorSnap, districtSnap] = await Promise.all([
    db.collection("auditors").orderBy("name").get(),
    db.collection("districts").orderBy("name").get(),
  ]);

  return {
    auditors: auditorSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
    ),
    districts: districtSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as District,
    ),
  };
}

export default async function AuditorsPage() {
  const { auditors, districts } = await loadData();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Auditors"
        description="Accounts are created here and activated by the auditor from an emailed link. There is no sign-up."
      />
      <AuditorsClient auditors={auditors} districts={districts} />
    </div>
  );
}
