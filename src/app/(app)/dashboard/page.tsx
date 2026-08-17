import Link from "next/link";
import { Building2, Check, Settings, Users } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";

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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const setup = await getSetupState();

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

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {setupComplete
            ? "Audit data appears here after the first audit day."
            : "Finish setting up before the first audit day."}
        </p>
      </header>

      {!setupComplete && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-ink">Setup</h2>
            <span className="text-sm text-ink-muted">
              {completed} of {steps.length} complete
            </span>
          </div>

          <ul className="space-y-2">
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
        </section>
      )}

      {setupComplete && (
        <section className="rounded-xl border border-line bg-white p-10 text-center">
          <p className="text-sm text-ink-muted">
            No visits recorded yet. The dashboard populates after the first audit
            day.
          </p>
        </section>
      )}
    </div>
  );
}
