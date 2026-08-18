import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { currentScope } from "@/lib/queries";
import { hasAnyScope } from "@/lib/permissions";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { DuplicatesClient, type DuplicateGroup } from "./duplicates-client";

export const dynamic = "force-dynamic";

async function findDuplicates(): Promise<DuplicateGroup[]> {
  if (!isAdminConfigured()) return [];

  const scope = await currentScope();
  if (!hasAnyScope(scope)) return [];

  const db = adminDb();
  const [houseSnap, districtSnap, auditorSnap, visitSnap] = await Promise.all([
    db.collection("houses").get(),
    db.collection("districts").get(),
    db.collection("auditors").get(),
    db.collection("visits").select("houseId").get(),
  ]);

  const districtNames = Object.fromEntries(
    districtSnap.docs.map((d) => [d.id, d.data().name as string]),
  );
  const auditorNames = Object.fromEntries(
    auditorSnap.docs.map((d) => [d.id, d.data().name as string]),
  );

  const visitCounts: Record<string, number> = {};
  for (const doc of visitSnap.docs) {
    const houseId = doc.data().houseId as string;
    visitCounts[houseId] = (visitCounts[houseId] ?? 0) + 1;
  }

  // Group live houses by district + serial. Already-merged records are skipped.
  const groups = new Map<string, DuplicateGroup>();

  for (const doc of houseSnap.docs) {
    const data = doc.data();
    if (data.mergedInto) continue;

    const districtId = data.districtId as string;
    if (scope.kind === "scoped" && !scope.districtIds.includes(districtId)) {
      continue;
    }

    const key = `${districtId}::${data.serialNumber}`;
    const group = groups.get(key) ?? {
      serialNumber: data.serialNumber as string,
      districtName: districtNames[districtId] ?? "Unknown district",
      entries: [],
    };

    group.entries.push({
      id: doc.id,
      registeredByName:
        auditorNames[data.registeredBy as string] ?? "Unknown auditor",
      createdAt: (data.createdAt as string) ?? "",
      refLat: (data.refLat as number) ?? null,
      refLng: (data.refLng as number) ?? null,
      visitCount: visitCounts[doc.id] ?? 0,
    });

    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.entries.length > 1)
    .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
}

export default async function DuplicatesPage() {
  const groups = await findDuplicates();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/houses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All houses
      </Link>

      <PageHeader
        title="Duplicate serial numbers"
        description="Two auditors registering the same house while offline cannot see each other's entry. Those collisions surface here."
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No duplicates"
            description="Every registered serial number is unique within its district."
          />
        </Card>
      ) : (
        <DuplicatesClient groups={groups} />
      )}
    </div>
  );
}
