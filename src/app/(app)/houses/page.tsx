import Link from "next/link";
import { Home, MapPin } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { currentScope } from "@/lib/queries";
import { hasAnyScope } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import type { District, House } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = House & { visitCount: number; districtName: string };

async function loadHouses(districtId?: string): Promise<{
  rows: Row[];
  districts: District[];
}> {
  if (!isAdminConfigured()) return { rows: [], districts: [] };

  const scope = await currentScope();
  if (!hasAnyScope(scope)) return { rows: [], districts: [] };

  const db = adminDb();
  const [districtSnap, houseSnap, visitSnap] = await Promise.all([
    db.collection("districts").orderBy("name").get(),
    districtId
      ? db.collection("houses").where("districtId", "==", districtId).get()
      : db.collection("houses").get(),
    db.collection("visits").select("houseId").get(),
  ]);

  let districts = districtSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as District,
  );
  if (scope.kind === "scoped") {
    districts = districts.filter((d) => scope.districtIds.includes(d.id));
  }

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;

  const visitCounts: Record<string, number> = {};
  for (const doc of visitSnap.docs) {
    const id = doc.data().houseId as string;
    visitCounts[id] = (visitCounts[id] ?? 0) + 1;
  }

  const allowedDistricts = new Set(districts.map((d) => d.id));

  const rows = houseSnap.docs
    .filter((doc) => allowedDistricts.has(doc.data().districtId as string))
    .map((doc) => {
      const data = doc.data() as Omit<House, "id">;
      return {
        ...data,
        id: doc.id,
        visitCount: visitCounts[doc.id] ?? 0,
        districtName: districtNames[data.districtId] ?? "—",
      } as Row;
    })
    .sort((a, b) =>
      a.serialNumber.localeCompare(b.serialNumber, undefined, { numeric: true }),
    );

  return { rows, districts };
}

export default async function HousesPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const { district } = await searchParams;
  const { rows, districts } = await loadHouses(district);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Houses"
        description="Every household registered by an auditor, with the reference location its visits are checked against."
      />

      <Card>
        <CardHeader
          title={district ? `${rows.length} houses` : `${rows.length} houses`}
          description="Registered door-to-door as auditors work their district."
          action={
            districts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <FilterChip href="/houses" label="All" active={!district} />
                {districts.map((d) => (
                  <FilterChip
                    key={d.id}
                    href={`/houses?district=${d.id}`}
                    label={d.name}
                    active={district === d.id}
                  />
                ))}
              </div>
            ) : null
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Home className="h-5 w-5" />}
            title="No houses registered yet"
            description="Houses appear here as auditors discover and register them on their first door-to-door pass."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">Serial</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">District</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Reference location
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Visits</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((house) => (
                  <tr key={house.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/houses/${house.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {house.serialNumber}
                      </Link>
                      {house.description && (
                        <span className="block text-xs text-ink-muted">
                          {house.description}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {house.districtName}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {house.refLat != null && house.refLng != null ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <MapPin className="h-3.5 w-3.5" />
                          {house.refLat.toFixed(5)}, {house.refLng.toFixed(5)}
                        </span>
                      ) : (
                        <Badge tone="pending">Not set</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {house.visitCount}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {house.createdAt
                        ? new Date(house.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white"
          : "rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface"
      }
    >
      {label}
    </Link>
  );
}
