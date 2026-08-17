import { notFound } from "next/navigation";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { canManageManagers } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { ManagersClient } from "./managers-client";
import type { Auditor, District, ManagerAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const user = await getCurrentUser();
  if (!user || !canManageManagers(user)) notFound();

  let managers: ManagerAccount[] = [];
  let districts: District[] = [];
  let auditors: Auditor[] = [];

  if (isAdminConfigured()) {
    const db = adminDb();
    const [userSnap, districtSnap, auditorSnap] = await Promise.all([
      db.collection("users").orderBy("name").get(),
      db.collection("districts").orderBy("name").get(),
      db.collection("auditors").orderBy("name").get(),
    ]);

    managers = userSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ManagerAccount,
    );
    districts = districtSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as District,
    );
    auditors = auditorSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Sub-administrators"
        description="Invite people to help manage districts, and control exactly what each of them can see."
      />
      <ManagersClient
        managers={managers}
        districts={districts}
        auditors={auditors}
      />
    </div>
  );
}
