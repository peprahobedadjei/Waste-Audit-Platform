import { BarChart3 } from "lucide-react";
import { loadLookups, loadVisits, summariseByDistrict } from "@/lib/queries";
import { loadSettings } from "@/lib/visits";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { PeriodTabs } from "./period-tabs";
import { ExportButton } from "./export-button";

export const dynamic = "force-dynamic";

const PERIODS = {
  daily: { label: "Daily", days: 1 },
  weekly: { label: "Weekly", days: 7 },
  monthly: { label: "Monthly", days: 30 },
  annual: { label: "Annual", days: 365 },
} as const;

type PeriodKey = keyof typeof PERIODS;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: raw } = await searchParams;
  const period = (raw && raw in PERIODS ? raw : "weekly") as PeriodKey;
  const { days, label } = PERIODS[period];

  const settings = isAdminConfigured() ? await loadSettings() : DEFAULT_SETTINGS;
  const { districtNames } = await loadLookups();
  const allVisits = await loadVisits({ limit: 2000 });

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const visits = allVisits.filter((v) => v.capturedAt >= cutoff);

  const counted = visits.filter((v) => v.reviewStatus !== "rejected");
  const stats = summariseByDistrict(visits, districtNames);

  const total = counted.length;
  const collectedRate = total
    ? Math.round((counted.filter((v) => v.collected).length / total) * 100)
    : 0;
  const satisfiedRate = total
    ? Math.round((counted.filter((v) => v.satisfied).length / total) * 100)
    : 0;
  const avgCleanliness = total
    ? counted.reduce((s, v) => s + (v.cleanlinessRating ?? 0), 0) / total
    : 0;

  const weights = settings.cleanlinessWeights;
  const overallScore = total
    ? Math.round(
        (collectedRate * weights.collection +
          (avgCleanliness / 5) * 100 * weights.cleanliness +
          satisfiedRate * weights.satisfaction) /
          100,
      )
    : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        description="Resident-reported collection and satisfaction, rolled up by district."
        action={
          <ExportButton
            rows={stats}
            period={label}
            summary={{ total, collectedRate, satisfiedRate, overallScore }}
          />
        }
      />

      <PeriodTabs current={period} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visits counted" value={String(total)} />
        <Tile label="Collection rate" value={`${collectedRate}%`} tone="brand" />
        <Tile label="Satisfaction rate" value={`${satisfiedRate}%`} />
        <Tile label="Cleanliness score" value={total ? `${overallScore}%` : "—"} />
      </div>

      <Card>
        <CardHeader
          title={`${label} performance by district`}
          description={`Score = ${weights.collection}% collection + ${weights.cleanliness}% cleanliness rating + ${weights.satisfaction}% satisfaction.`}
        />

        {stats.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No visits in this period"
            description="Reports fill in as auditors submit visits from the field."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">District</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Visits</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Collected</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Satisfied</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Cleanliness
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr
                    key={row.districtId}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">{row.name}</td>
                    <td className="px-5 py-3.5 text-ink-muted">{row.visits}</td>
                    <td className="px-5 py-3.5">
                      <Bar value={row.collectedRate} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Bar value={row.satisfiedRate} />
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {row.cleanliness} / 5
                    </td>
                    <td className="px-5 py-3.5">
                      {row.flagged > 0 ? (
                        <span className="font-medium text-danger">
                          {row.flagged}
                        </span>
                      ) : (
                        <span className="text-ink-muted">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-sm text-ink-muted">
        Visits a manager has rejected as not credible are excluded from every rate
        above.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className={
          tone === "brand"
            ? "mt-1 text-2xl font-semibold text-brand"
            : "mt-1 text-2xl font-semibold text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="text-ink">{value}%</span>
    </span>
  );
}
