import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { canSeeActivityLog } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type LogEntry = {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

/** Plain-English descriptions, so the log reads as a story rather than codes. */
const ACTION_LABELS: Record<string, string> = {
  "district.create": "Created a district",
  "district.update": "Updated a district",
  "district.archive": "Archived a district",
  "district.delete": "Deleted a district",
  "auditor.create": "Added an auditor",
  "auditor.update": "Updated an auditor",
  "auditor.deactivate": "Deactivated an auditor",
  "auditor.delete": "Removed an auditor",
  "auditor.bulk_import": "Bulk imported auditors",
  "auditor.invite.resend": "Re-sent an auditor invite",
  "manager.invite": "Invited a sub-admin",
  "manager.update": "Updated a sub-admin",
  "manager.deactivate": "Deactivated a sub-admin",
  "manager.invite.resend": "Re-sent a sub-admin invite",
  "settings.update": "Changed audit settings",
  "branding.update": "Changed branding",
  "message.send": "Sent a message",
  "profile.update": "Updated their profile",
  "profile.password_change": "Changed their password",
  "profile.email_change": "Changed their email address",
  "visit.review.accepted": "Accepted a flagged visit",
  "visit.review.rejected": "Rejected a visit as not credible",
  "house.reset_reference": "Reset a house reference location",
  "house.duplicate_resolved": "Resolved a duplicate serial number",
};

const DESTRUCTIVE = new Set([
  "district.delete",
  "auditor.delete",
  "auditor.deactivate",
  "manager.deactivate",
  "visit.review.rejected",
  "house.reset_reference",
]);

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !canSeeActivityLog(user)) notFound();

  const { action } = await searchParams;

  let entries: LogEntry[] = [];
  let actorNames: Record<string, string> = {};

  if (isAdminConfigured()) {
    const db = adminDb();
    const [logSnap, userSnap] = await Promise.all([
      db.collection("auditLog").orderBy("createdAt", "desc").limit(400).get(),
      db.collection("users").get(),
    ]);

    entries = logSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as LogEntry,
    );
    if (action) entries = entries.filter((e) => e.action.startsWith(action));

    actorNames = Object.fromEntries(
      userSnap.docs.map((doc) => [doc.id, doc.data().name as string]),
    );
  }

  const categories = [
    ["", "Everything"],
    ["visit", "Reviews"],
    ["auditor", "Auditors"],
    ["manager", "Sub-admins"],
    ["district", "Districts"],
    ["house", "Houses"],
    ["settings", "Settings"],
    ["message", "Messages"],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Audit log"
        description="Every change anyone made, in order. Nothing here can be edited or removed."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map(([value, label]) => (
          <a
            key={value || "all"}
            href={value ? `/audit-log?action=${value}` : "/audit-log"}
            className={
              (action ?? "") === value
                ? "rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface"
            }
          >
            {label}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${entries.length} entries`}
          description="Most recent first, capped at the latest 400."
        />

        {entries.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-5 w-5" />}
            title="Nothing recorded yet"
            description="Every configuration change and review decision is written here as it happens."
          />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">
                      {actorNames[entry.userId] ?? "Unknown user"}
                    </span>{" "}
                    <span className="text-ink-muted">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </p>
                  {renderDetail(entry)}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {DESTRUCTIVE.has(entry.action) && (
                    <Badge tone="danger">Sensitive</Badge>
                  )}
                  <span className="text-xs text-ink-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function renderDetail(entry: LogEntry) {
  const detail = entry.detail ?? {};

  // Reasons are the point of the log for review decisions - surface them
  const reason = detail.reason as string | undefined;
  if (reason) {
    return <p className="mt-0.5 text-sm text-ink-muted">&ldquo;{reason}&rdquo;</p>;
  }

  const name = (detail.name ?? detail.title ?? detail.email) as string | undefined;
  if (name) {
    return <p className="mt-0.5 text-sm text-ink-muted">{name}</p>;
  }

  if (entry.action === "auditor.bulk_import") {
    return (
      <p className="mt-0.5 text-sm text-ink-muted">
        {String(detail.invited ?? 0)} invited, {String(detail.skipped ?? 0)} skipped
      </p>
    );
  }

  return null;
}
