import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { currentScope } from "@/lib/queries";
import { PageHeader } from "@/components/ui/card";
import { AuditorsClient } from "./auditors-client";
import type { Auditor, District } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadData(): Promise<{
  auditors: Auditor[];
  districts: District[];
}> {
  if (!isAdminConfigured()) return { auditors: [], districts: [] };

  const scope = await currentScope();
  const db = adminDb();
  const [auditorSnap, districtSnap] = await Promise.all([
    db.collection("auditors").orderBy("name").get(),
    db.collection("districts").orderBy("name").get(),
  ]);

  let auditors = auditorSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
  );
  let districts = districtSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as District,
  );

  if (scope.kind === "scoped") {
    auditors = auditors.filter((a) => scope.auditorIds.includes(a.id));
    districts = districts.filter((d) => scope.districtIds.includes(d.id));
  }

  return { auditors, districts };
}

export default async function AuditorsPage() {
  const [user, { auditors, districts }] = await Promise.all([
    getCurrentUser(),
    loadData(),
  ]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Auditors"
        description={
          isAdmin
            ? "Accounts are created here and activated by the auditor from an emailed link. There is no sign-up."
            : "The auditors assigned to you."
        }
      />
      <AuditorsClient
        auditors={auditors}
        districts={districts}
        canEdit={isAdmin}
      />
    </div>
  );
}
