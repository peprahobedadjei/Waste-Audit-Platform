import { notFound } from "next/navigation";
import { Activity, Circle } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { canSeeActivityLog } from "@/lib/permissions";
import { isOnline } from "@/lib/presence";
import { roleLabel } from "@/lib/session-shared";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ONLINE_WINDOW_MINUTES, type SessionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function duration(from: string, to: string | null): string {
  const end = to ? new Date(to).getTime() : Date.now();
  const minutes = Math.round((end - new Date(from).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user || !canSeeActivityLog(user)) notFound();

  let sessions: SessionRecord[] = [];

  if (isAdminConfigured()) {
    const snap = await adminDb()
      .collection("sessions")
      .orderBy("loginAt", "desc")
      .limit(300)
      .get();
    sessions = snap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as SessionRecord,
    );
  }

  const online = sessions.filter((s) => isOnline(s.lastSeenAt, s.logoutAt));
  const onlineManagers = online.filter((s) => s.subjectType === "user");
  const onlineAuditors = online.filter((s) => s.subjectType === "auditor");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Activity"
        description="Who signed in, when, and who is currently active."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile label="Active now" value={online.length} tone="success" />
        <Tile label="Sub-admins online" value={onlineManagers.length} />
        <Tile label="Auditors online" value={onlineAuditors.length} />
      </div>

      <Card>
        <CardHeader
          title="Sign-in history"
          description={`Most recent first. Someone is counted as active if they have been seen in the last ${ONLINE_WINDOW_MINUTES} minutes.`}
        />

        {sessions.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No sign-ins recorded yet"
            description="Sessions appear here as people sign in to the dashboard or the auditors' app."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">Name</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Role</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Signed in
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Last seen
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Signed out
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Duration
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const active = isOnline(session.lastSeenAt, session.logoutAt);
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {session.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          tone={
                            session.role === "admin"
                              ? "success"
                              : session.role === "manager"
                                ? "neutral"
                                : "neutral"
                          }
                        >
                          {roleLabel(session.role)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {new Date(session.loginAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {relative(session.lastSeenAt)}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {session.logoutAt
                          ? new Date(session.logoutAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {duration(session.loginAt, session.logoutAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        {active ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                            <Circle className="h-2 w-2 fill-current" />
                            Active
                          </span>
                        ) : session.logoutAt ? (
                          <span className="text-sm text-ink-muted">
                            Signed out
                          </span>
                        ) : (
                          <span className="text-sm text-ink-muted">Inactive</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        A sign-out time is only recorded when someone deliberately signs out. A
        closed tab, a flat battery or a phone that loses signal leaves no trace,
        so &ldquo;active&rdquo; is inferred from recent activity rather than
        reported by the device.
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
  value: number;
  tone?: "success";
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-1 text-2xl font-semibold text-success"
            : "mt-1 text-2xl font-semibold text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}
