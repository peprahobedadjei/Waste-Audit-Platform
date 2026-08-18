import { BarChart3 } from "lucide-react";
import { currentScope, loadLookups, loadVisits, summariseByDistrict } from "@/lib/queries";
import { loadSettings } from "@/lib/visits";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { cyclesInRange, recentCycles } from "@/lib/cycles";
import { DEFAULT_SETTINGS, type Visit } from "@/lib/types";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { PeriodTabs } from "./period-tabs";
import { ExportButton } from "./export-button";
import { DistrictChart, TrendChart, type TrendPoint } from "./report-charts";

export const dynamic = "force-dynamic";

/*
  Periods are expressed as a number of collection cycles, not calendar days.

  A rolling window like "last 7 days" straddles two collections and produces a
  figure a manager cannot reconcile with any single collection day. Counting
  cycles keeps every number tied to actual contracted collections.
*/
const PERIODS = {
  cycle: { label: "This cycle", cycles: 1, days: 7 },
  week: { label: "This week", cycles: 2, days: 8 },
  month: { label: "This month", cycles: 9, days: 31 },
  year: { label: "This year", cycles: 105, days: 366 },
} as const;

type PeriodKey = keyof typeof PERIODS;

function rates(visits: Visit[]) {
  const counted = visits.filter((v) => v.reviewStatus !== "rejected");
  const total = counted.length;
  return {
    total,
    collected: total
      ? Math.round((counted.filter((v) => v.collected).length / total) * 100)
      : 0,
    satisfied: total
      ? Math.round((counted.filter((v) => v.satisfied).length / total) * 100)
      : 0,
    cleanliness: total
      ? counted.reduce((s, v) => s + (v.cleanlinessRating ?? 0), 0) / total
      : 0,
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: raw } = await searchParams;
  const period = (raw && raw in PERIODS ? raw : "week") as PeriodKey;
  const { label, cycles: cycleCount, days } = PERIODS[period];

  const settings = isAdminConfigured() ? await loadSettings() : DEFAULT_SETTINGS;
  const scope = await currentScope();
  const { districtNames } = await loadLookups(scope);

  // The cycles this period covers, newest first
  const cycleIds = cyclesInRange(settings.collectionDays, days).slice(
    0,
    cycleCount,
  );
  const cycleSet = new Set(cycleIds);

  const allVisits = await loadVisits({ limit: 5000 }, scope);
  const visits = allVisits.filter(
    (v) => v.cycleId != null && cycleSet.has(v.cycleId),
  );

  const summary = rates(visits);
  const stats = summariseByDistrict(visits, districtNames);

  const weights = settings.cleanlinessWeights;
  const overallScore = summary.total
    ? Math.round(
        (summary.collected * weights.collection +
          (summary.cleanliness / 5) * 100 * weights.cleanliness +
          summary.satisfied * weights.satisfaction) /
          100,
      )
    : 0;

  // Trend over the last dozen cycles regardless of the selected period, so the
  // shape of performance stays visible even on a single-cycle view
  const trendCycles = recentCycles(settings.collectionDays, 12).reverse();
  const trend: TrendPoint[] = trendCycles
    .map((cycle) => {
      const forCycle = allVisits.filter((v) => v.cycleId === cycle.id);
      const r = rates(forCycle);
      return {
        cycle: cycle.label.replace(/ \d{4}$/, ""),
        collected: r.collected,
        satisfied: r.satisfied,
        visits: r.total,
      };
    })
    .filter((point) => point.visits > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        description="Resident-reported collection and satisfaction, grouped by collection cycle."
        action={
          <ExportButton
            rows={stats}
            period={label}
            weights={weights}
            summary={{
              total: summary.total,
              collectedRate: summary.collected,
              satisfiedRate: summary.satisfied,
              overallScore,
              cycles: cycleIds.length,
            }}
          />
        }
      />

      <PeriodTabs current={period} />

      <p className="mb-6 text-sm text-ink-muted">
        {cycleIds.length === 0
          ? "No collection cycles fall in this period."
          : `Covering ${cycleIds.length} collection cycle${cycleIds.length === 1 ? "" : "s"}: ${cycleIds.slice(0, 4).join(", ")}${cycleIds.length > 4 ? "…" : ""}`}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visits counted" value={String(summary.total)} />
        <Tile label="Collection rate" value={`${summary.collected}%`} tone="brand" />
        <Tile label="Satisfaction rate" value={`${summary.satisfied}%`} />
        <Tile
          label="Cleanliness score"
          value={summary.total ? `${overallScore}%` : "—"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Trend across recent cycles"
          description="Each point is one collection day and the audit that followed it."
        />
        <TrendChart data={trend} />
      </Card>

      <Card className="mb-6">
        <CardHeader
          title={`${label} — by district`}
          description={`Score = ${weights.collection}% collection + ${weights.cleanliness}% cleanliness rating + ${weights.satisfaction}% satisfaction.`}
        />
        {stats.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No visits in this period"
            description="Reports fill in as auditors submit visits from the field."
          />
        ) : (
          <>
            <DistrictChart
              data={stats.map((s) => ({
                name: s.name,
                collected: s.collectedRate,
                satisfied: s.satisfiedRate,
              }))}
            />
            <div className="overflow-x-auto border-t border-line">
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
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {row.name}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">{row.visits}</td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {row.collectedRate}%
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {row.satisfiedRate}%
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
          </>
        )}
      </Card>

      <p className="text-sm text-ink-muted">
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
