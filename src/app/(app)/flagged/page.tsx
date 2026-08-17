import Link from "next/link";
import { Flag, ShieldCheck } from "lucide-react";
import { loadLookups, loadVisits } from "@/lib/queries";
import { loadSettings } from "@/lib/visits";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { isAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export default async function FlaggedPage() {
  const configured = isAdminConfigured();
  const [{ districtNames, auditorNames }, flagged, settings] = await Promise.all([
    loadLookups(),
    loadVisits({ flagged: true, limit: 500 }),
    configured ? loadSettings() : Promise.resolve(null),
  ]);

  // Worst distance first - the most suspicious submissions lead the queue
  const pending = flagged
    .filter((v) => !v.reviewStatus)
    .sort((a, b) => (b.distanceFromRef ?? 0) - (a.distanceFromRef ?? 0));

  const resolved = flagged.filter((v) => v.reviewStatus);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Flagged queue"
        description={
          settings
            ? `Visits submitted more than ${settings.toleranceMeters}m from the house's reference location.`
            : "Visits submitted too far from the house's reference location."
        }
      />

      <Card className="mb-6">
        <CardHeader
          title={`${pending.length} awaiting review`}
          description="Worst distance first."
        />

        {pending.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Nothing awaiting review"
            description="Flagged visits appear here when a submission lands too far from where the house was first recorded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">Distance</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">House</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Auditor</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">District</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Accuracy</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">When</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {pending.map((visit) => (
                  <tr key={visit.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-danger">
                        {visit.distanceFromRef}m
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {visit.serialNumber}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {auditorNames[visit.auditorId] ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {districtNames[visit.districtId] ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {visit.gpsAccuracy != null ? (
                        settings && visit.gpsAccuracy > settings.minGpsAccuracy ? (
                          <Badge tone="pending">±{visit.gpsAccuracy}m poor</Badge>
                        ) : (
                          `±${visit.gpsAccuracy}m`
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {new Date(visit.capturedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/visits/${visit.id}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {resolved.length > 0 && (
        <Card>
          <CardHeader
            title={`${resolved.length} already reviewed`}
            description="Kept on the record — nothing is ever deleted."
          />
          <ul className="divide-y divide-line">
            {resolved.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <Badge
                  tone={visit.reviewStatus === "rejected" ? "danger" : "success"}
                >
                  {visit.reviewStatus}
                </Badge>
                <span className="text-sm font-medium text-ink">
                  {visit.serialNumber}
                </span>
                <span className="text-sm text-ink-muted">
                  {visit.distanceFromRef}m ·{" "}
                  {auditorNames[visit.auditorId] ?? "—"}
                </span>
                {visit.reviewReason && (
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {visit.reviewReason}
                  </span>
                )}
                <Link
                  href={`/visits/${visit.id}`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {flagged.length === 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          <Flag className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No visit can be flagged on the very first cycle — there are no
            reference locations to compare against yet. Flagging begins from the
            second cycle.
          </span>
        </p>
      )}
    </div>
  );
}
