import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { loadLookups, loadVisits } from "@/lib/queries";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { VisitFilters } from "./visit-filters";
import { ExportVisits } from "./export-visits";

export const dynamic = "force-dynamic";

type Search = {
  district?: string;
  auditor?: string;
  flagged?: string;
  collected?: string;
  satisfied?: string;
};

function toBool(value?: string): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const { districts, auditors, districtNames, auditorNames } = await loadLookups();

  const visits = await loadVisits({
    districtId: params.district,
    auditorId: params.auditor,
    flagged: params.flagged === "yes" ? true : undefined,
    collected: toBool(params.collected),
    satisfied: toBool(params.satisfied),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Visits"
        description="Every submission from the field, with the location check applied on arrival."
      />

      <Card>
        <CardHeader
          title={`${visits.length} visit${visits.length === 1 ? "" : "s"}`}
          description="Newest first."
          action={
            <ExportVisits
              visits={visits}
              districtNames={districtNames}
              auditorNames={auditorNames}
            />
          }
        />

        <VisitFilters districts={districts} auditors={auditors} />

        {visits.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No visits match"
            description="Visits appear here as auditors submit them from the field."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">When</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">House</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">District</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Auditor</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Collected</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Satisfied</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Distance</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5 text-ink-muted">
                      {new Date(visit.capturedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/visits/${visit.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {visit.serialNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {districtNames[visit.districtId] ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {auditorNames[visit.auditorId] ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={visit.collected ? "success" : "danger"}>
                        {visit.collected ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={visit.satisfied ? "success" : "danger"}>
                        {visit.satisfied ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {visit.isFirstVisit
                        ? "Set reference"
                        : visit.distanceFromRef != null
                          ? `${visit.distanceFromRef}m`
                          : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {visit.reviewStatus === "rejected" ? (
                        <Badge tone="danger">Rejected</Badge>
                      ) : visit.reviewStatus === "accepted" ? (
                        <Badge tone="neutral">Reviewed</Badge>
                      ) : visit.flagged ? (
                        <Badge tone="danger">Flagged</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
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
