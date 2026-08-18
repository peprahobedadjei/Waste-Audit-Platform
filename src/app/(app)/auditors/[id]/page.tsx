import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Mail, Phone } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { currentScope } from "@/lib/queries";
import { canSeeAuditor } from "@/lib/permissions";
import { isOnline } from "@/lib/presence";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import type { Auditor, SessionRecord, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isAdminConfigured()) notFound();

  const scope = await currentScope();
  if (!canSeeAuditor(scope, id)) notFound();

  const db = adminDb();
  const snap = await db.collection("auditors").doc(id).get();
  if (!snap.exists) notFound();

  const auditor = { id: snap.id, ...snap.data() } as Auditor;

  const [districtSnap, houseSnap, allDistrictVisits] = await Promise.all([
    db.collection("districts").doc(auditor.districtId).get(),
    db.collection("houses").where("registeredBy", "==", id).count().get(),
    db
      .collection("visits")
      .where("districtId", "==", auditor.districtId)
      .limit(2000)
      .get(),
  ]);

  /*
    Both of these need composite indexes, so they are fetched separately and
    allowed to fail. The auditor's identity and district still render if an
    index is missing - a blank error page would tell a manager nothing.
  */
  let visits: Visit[] = [];
  let dataError: string | null = null;

  try {
    const visitSnap = await db
      .collection("visits")
      .where("auditorId", "==", id)
      .orderBy("capturedAt", "desc")
      .limit(300)
      .get();
    visits = visitSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Visit,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auditors/[id]] visits failed:", message);
    dataError = /FAILED_PRECONDITION|requires an index/i.test(message)
      ? "This auditor's submissions need a database index that has not been created yet. See FIRESTORE.md."
      : "Could not load this auditor's submissions.";
  }

  let sessionSnap: FirebaseFirestore.QuerySnapshot | null = null;
  try {
    sessionSnap = await db
      .collection("sessions")
      .where("subjectId", "==", id)
      .orderBy("loginAt", "desc")
      .limit(1)
      .get();
  } catch {
    // Presence is diagnostic - its absence should not colour the page
  }

  const total = visits.length;
  const flagged = visits.filter((v) => v.flagged).length;
  const flagRate = total ? Math.round((flagged / total) * 100) : 0;

  /*
    The district average is the comparison that matters.

    A single flag is noise - bad GPS, a mistyped serial, a house behind a wall.
    An auditor sitting far above their district's average is the finding this
    whole system exists to produce, and that only shows up against a baseline.
  */
  const districtVisits = allDistrictVisits.docs.map((doc) => doc.data());
  const districtTotal = districtVisits.length;
  const districtFlagged = districtVisits.filter((v) => v.flagged).length;
  const districtFlagRate = districtTotal
    ? Math.round((districtFlagged / districtTotal) * 100)
    : 0;

  const counted = visits.filter((v) => v.reviewStatus !== "rejected");
  const collectedRate = counted.length
    ? Math.round((counted.filter((v) => v.collected).length / counted.length) * 100)
    : 0;
  const rejected = visits.filter((v) => v.reviewStatus === "rejected").length;

  const lastSession = sessionSnap?.docs[0]?.data() as SessionRecord | undefined;
  const online = lastSession
    ? isOnline(lastSession.lastSeenAt, lastSession.logoutAt)
    : false;

  const elevated = flagRate > districtFlagRate * 3 && flagged >= 3;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/auditors"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All auditors
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{auditor.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span>{districtSnap.data()?.name ?? "Unknown district"}</span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {auditor.email}
            </span>
            {auditor.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {auditor.phone}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              auditor.status === "active"
                ? "success"
                : auditor.status === "invited"
                  ? "pending"
                  : "neutral"
            }
          >
            {auditor.status}
          </Badge>
          {online && <Badge tone="success">Active now</Badge>}
        </div>
      </header>

      {dataError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-pending/30 bg-pending/5 px-4 py-3 text-sm text-pending">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{dataError}</span>
        </div>
      )}

      {elevated && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <strong>Flag rate well above the district average.</strong> {flagRate}%
          against a district average of {districtFlagRate}%. Worth reviewing this
          auditor&apos;s recent submissions and photos together rather than one at
          a time.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visits submitted" value={total} />
        <Tile label="Houses registered" value={houseSnap.data().count} />
        <Tile
          label="Flag rate"
          value={`${flagRate}%`}
          tone={elevated ? "danger" : undefined}
          note={`District average ${districtFlagRate}%`}
        />
        <Tile label="Collection rate reported" value={`${collectedRate}%`} />
      </div>

      {rejected > 0 && (
        <p className="mb-6 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {rejected} of this auditor&apos;s visits {rejected === 1 ? "has" : "have"}{" "}
          been rejected as not credible and {rejected === 1 ? "is" : "are"}{" "}
          excluded from the rates above.
        </p>
      )}

      <Card>
        <CardHeader
          title="Recent submissions"
          description={`${visits.length} most recent, newest first.`}
        />
        {visits.length === 0 ? (
          <EmptyState title="No visits submitted yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">When</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">House</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Collected</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Distance</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 100).map((visit) => (
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
                    <td className="px-5 py-3.5">
                      <Badge tone={visit.collected ? "success" : "danger"}>
                        {visit.collected ? "Yes" : "No"}
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

function Tile({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number | string;
  tone?: "danger";
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className={
          tone === "danger"
            ? "mt-1 text-2xl font-semibold text-danger"
            : "mt-1 text-2xl font-semibold text-ink"
        }
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
