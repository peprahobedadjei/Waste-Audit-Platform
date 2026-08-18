import Link from "next/link";
import {
  Building2,
  Check,
  ClipboardList,
  Flag,
  Home,
  Settings,
  Users,
} from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { currentScope, loadLookups, loadVisits, summariseByDistrict } from "@/lib/queries";
import { hasAnyScope } from "@/lib/permissions";
import { loadSettings } from "@/lib/visits";
import { recentCycles } from "@/lib/cycles";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { DashboardMap } from "./dashboard-map";
import { CycleTabs } from "./cycle-tabs";
import type { Pin } from "@/components/map/pin-map";

export const dynamic = "force-dynamic";

type SetupState = {
  districts: number;
  auditors: number;
  settingsConfigured: boolean;
};

async function getSetupState(): Promise<SetupState> {
  if (!isAdminConfigured()) {
    return { districts: 0, auditors: 0, settingsConfigured: false };
  }

  const db = adminDb();
  const [districts, auditors, settings] = await Promise.all([
    db.collection("districts").count().get(),
    db.collection("auditors").count().get(),
    db.collection("settings").doc("audit").get(),
  ]);

  return {
    districts: districts.data().count,
    auditors: auditors.data().count,
    settingsConfigured: settings.exists,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle: requestedCycle } = await searchParams;
  const user = await getCurrentUser();
  const scope = await currentScope();
  const isAdmin = user?.role === "admin";

  const setup = await getSetupState();
  const settings = isAdminConfigured() ? await loadSettings() : null;

  const steps = [
    {
      label: "Add districts",
      done: setup.districts > 0,
      href: "/districts",
      icon: Building2,
      hint: "Every auditor is assigned to a district, so these come first.",
    },
    {
      label: "Add auditors",
      done: setup.auditors > 0,
      href: "/auditors",
      icon: Users,
      hint: "Add them one at a time or upload a CSV to invite all 160 at once.",
    },
    {
      label: "Confirm settings",
      done: setup.settingsConfigured,
      href: "/settings",
      icon: Settings,
      hint: "Distance tolerance, GPS accuracy, cycle days and score weights.",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const setupComplete = completed === steps.length;

  // Sub-admins never see the setup checklist - they cannot act on any of it
  if (isAdmin && !setupComplete) {
    return (
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-ink">
            Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Finish setting up before the first audit day.
          </p>
        </header>

        <Card>
          <div className="mb-5 flex items-baseline justify-between px-6 pt-6">
            <h2 className="text-base font-semibold text-ink">Setup</h2>
            <span className="text-sm text-ink-muted">
              {completed} of {steps.length} complete
            </span>
          </div>
          <ul className="space-y-2 px-6 pb-6">
            {steps.map(({ label, done, href, icon: Icon, hint }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-start gap-3 rounded-lg border border-line p-4 transition-colors hover:bg-surface"
                >
                  <span
                    className={
                      done
                        ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white"
                        : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted"
                    }
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {label}
                    </span>
                    <span className="block text-sm text-ink-muted">{hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  if (!hasAnyScope(scope)) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">
            Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
        </header>
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nothing assigned to you yet"
            description="The system administrator has not assigned you any districts or auditors. You will see audit data here once they do."
          />
        </Card>
      </div>
    );
  }

  const cycles = settings ? recentCycles(settings.collectionDays, 12) : [];
  const activeCycle = requestedCycle ?? cycles[0]?.id ?? null;

  const { districts, auditors, districtNames } = await loadLookups(scope);
  const cycleVisits = activeCycle
    ? await loadVisits({ cycleId: activeCycle, limit: 2000 }, scope)
    : [];

  // Totals are lifetime, not cycle-bound - they answer "how big is this system"
  const [allVisits, houseCount] = await Promise.all([
    loadVisits({ limit: 5000 }, scope),
    countHouses(scope.kind === "all" ? null : scope.districtIds),
  ]);

  const counted = cycleVisits.filter((v) => v.reviewStatus !== "rejected");
  const total = counted.length;
  const collectedRate = total
    ? Math.round((counted.filter((v) => v.collected).length / total) * 100)
    : 0;
  const satisfiedRate = total
    ? Math.round((counted.filter((v) => v.satisfied).length / total) * 100)
    : 0;
  const flaggedPending = cycleVisits.filter(
    (v) => v.flagged && !v.reviewStatus,
  ).length;

  const stats = summariseByDistrict(cycleVisits, districtNames);

  const pins: Pin[] = cycleVisits
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .slice(0, 800)
    .map((visit) => ({
      id: visit.id,
      lat: visit.lat,
      lng: visit.lng,
      tone: visit.flagged ? "pending" : visit.collected ? "success" : "danger",
      popup: (
        <span className="text-xs">
          <strong>House {visit.serialNumber}</strong>
          <br />
          {visit.collected ? "Collected" : "Not collected"} ·{" "}
          {visit.satisfied ? "Satisfied" : "Not satisfied"}
          <br />
          {new Date(visit.capturedAt).toLocaleString()}
        </span>
      ),
    }));

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isAdmin
            ? "Across all districts."
            : `Across ${districts.length} district${districts.length === 1 ? "" : "s"} assigned to you.`}
        </p>
      </header>

      {/* Scale of the system - lifetime totals */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Districts"
          value={districts.length}
          icon={<Building2 className="h-4 w-4" />}
          href="/districts"
        />
        <Tile
          label="Auditors"
          value={auditors.length}
          icon={<Users className="h-4 w-4" />}
          href="/auditors"
        />
        <Tile
          label="Houses registered"
          value={houseCount}
          icon={<Home className="h-4 w-4" />}
          href="/houses"
        />
        <Tile
          label="Visits recorded"
          value={allVisits.length}
          icon={<ClipboardList className="h-4 w-4" />}
          href="/visits"
        />
      </div>

      <CycleTabs cycles={cycles} current={activeCycle} />

      {/* This cycle */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visits this cycle" value={total} />
        <Tile label="Collection rate" value={`${collectedRate}%`} tone="brand" />
        <Tile label="Satisfaction rate" value={`${satisfiedRate}%`} />
        <Tile
          label="Flagged awaiting review"
          value={flaggedPending}
          tone={flaggedPending > 0 ? "danger" : undefined}
          href="/flagged"
          icon={<Flag className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader
            title="Submissions this cycle"
            description="Pins clustered at one spot when they should be spread across a neighbourhood are worth a look."
          />
          <div className="p-5">
            {pins.length === 0 ? (
              <EmptyState
                title="No submissions in this cycle"
                description="The map fills in as auditors submit visits from the field."
              />
            ) : (
              <DashboardMap pins={pins} />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Performance by district"
          description="Rejected visits are excluded from every rate."
        />
        {stats.length === 0 ? (
          <EmptyState title="No data for this cycle yet" />
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
                        <Badge tone="danger">{row.flagged}</Badge>
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
    </div>
  );
}

async function countHouses(districtIds: string[] | null): Promise<number> {
  if (!isAdminConfigured()) return 0;
  const db = adminDb();

  if (districtIds === null) {
    const snap = await db.collection("houses").count().get();
    return snap.data().count;
  }
  if (districtIds.length === 0) return 0;

  // Firestore `in` takes at most 30 values; districts never approach that
  const snap = await db
    .collection("houses")
    .where("districtId", "in", districtIds.slice(0, 30))
    .count()
    .get();
  return snap.data().count;
}

function Tile({
  label,
  value,
  tone,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  tone?: "brand" | "danger";
  icon?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-ink-muted/40">
      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
        {icon}
        {label}
      </p>
      <p
        className={
          tone === "brand"
            ? "mt-1 text-2xl font-semibold text-brand"
            : tone === "danger"
              ? "mt-1 text-2xl font-semibold text-danger"
              : "mt-1 text-2xl font-semibold text-ink"
        }
      >
        {value}
      </p>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
