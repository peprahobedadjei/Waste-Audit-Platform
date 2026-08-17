import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { loadSettings } from "@/lib/visits";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { ReviewActions } from "./review-actions";
import type { Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isAdminConfigured()) notFound();

  const db = adminDb();
  const snap = await db.collection("visits").doc(id).get();
  if (!snap.exists) notFound();

  const visit = { id: snap.id, ...snap.data() } as Visit;

  const [auditorSnap, districtSnap, houseSnap, reviewerSnap, settings] =
    await Promise.all([
      db.collection("auditors").doc(visit.auditorId).get(),
      db.collection("districts").doc(visit.districtId).get(),
      db.collection("houses").doc(visit.houseId).get(),
      visit.reviewedBy
        ? db.collection("users").doc(visit.reviewedBy).get()
        : Promise.resolve(null),
      loadSettings(),
    ]);

  const house = houseSnap.data() as
    | { refLat: number; refLng: number }
    | undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/visits"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All visits
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            House {visit.serialNumber}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {new Date(visit.capturedAt).toLocaleString()} ·{" "}
            {auditorSnap.data()?.name ?? "Unknown auditor"} ·{" "}
            {districtSnap.data()?.name ?? "Unknown district"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visit.reviewStatus === "rejected" ? (
            <Badge tone="danger">Rejected</Badge>
          ) : visit.reviewStatus === "accepted" ? (
            <Badge tone="neutral">Reviewed</Badge>
          ) : visit.flagged ? (
            <Badge tone="danger">Flagged</Badge>
          ) : (
            <Badge tone="success">Passed</Badge>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Evidence" />
          <div className="p-5">
            {visit.photoUrl ? (
              <Image
                src={visit.photoUrl}
                alt={`Photo of house ${visit.serialNumber}`}
                width={800}
                height={600}
                className="w-full rounded-lg border border-line object-contain"
                unoptimized
              />
            ) : (
              <p className="rounded-lg border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
                No photo was attached to this visit.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Resident answers" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field
              label="Waste collected"
              value={
                <Badge tone={visit.collected ? "success" : "danger"}>
                  {visit.collected ? "Yes" : "No"}
                </Badge>
              }
            />
            <Field
              label="Resident satisfied"
              value={
                <Badge tone={visit.satisfied ? "success" : "danger"}>
                  {visit.satisfied ? "Yes" : "No"}
                </Badge>
              }
            />
            <Field
              label="Visible cleanliness"
              value={
                <span className="inline-flex items-center gap-1 text-sm text-ink">
                  <Star className="h-4 w-4 text-pending" />
                  {visit.cleanlinessRating} / 5
                </span>
              }
            />
            {visit.note && (
              <div className="sm:col-span-3">
                <p className="text-sm text-ink-muted">Note</p>
                <p className="mt-0.5 text-sm text-ink">{visit.note}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Location check"
            description={`Tolerance is ${settings.toleranceMeters}m. Beyond that a visit is flagged for review.`}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field
              label="Submitted from"
              value={
                <span className="font-mono text-sm">
                  {visit.lat.toFixed(6)}, {visit.lng.toFixed(6)}
                </span>
              }
            />
            <Field
              label="House reference"
              value={
                house?.refLat != null ? (
                  <span className="font-mono text-sm">
                    {house.refLat.toFixed(6)}, {house.refLng.toFixed(6)}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Distance from reference"
              value={
                visit.isFirstVisit ? (
                  <Badge tone="neutral">This visit set the reference</Badge>
                ) : visit.distanceFromRef != null ? (
                  <span
                    className={
                      visit.flagged
                        ? "text-sm font-semibold text-danger"
                        : "text-sm font-semibold text-success"
                    }
                  >
                    {visit.distanceFromRef}m
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="GPS accuracy reported"
              value={
                visit.gpsAccuracy != null ? (
                  <span
                    className={
                      visit.gpsAccuracy > settings.minGpsAccuracy
                        ? "text-sm text-pending"
                        : "text-sm text-ink"
                    }
                  >
                    ±{visit.gpsAccuracy}m
                    {visit.gpsAccuracy > settings.minGpsAccuracy &&
                      " — poor signal, treat the distance with caution"}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Captured on device"
              value={new Date(visit.capturedAt).toLocaleString()}
            />
            <Field
              label="Received by server"
              value={
                visit.receivedAt
                  ? new Date(visit.receivedAt).toLocaleString()
                  : "—"
              }
            />
          </div>
        </Card>

        {(visit.flagged || visit.reviewStatus) && (
          <Card>
            <CardHeader
              title="Review"
              description={
                visit.reviewStatus
                  ? "This visit has already been reviewed."
                  : "Decide whether this visit is credible."
              }
            />
            <div className="p-5">
              {visit.reviewStatus ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        visit.reviewStatus === "rejected" ? "danger" : "success"
                      }
                    >
                      {visit.reviewStatus}
                    </Badge>
                    <span className="text-sm text-ink-muted">
                      by {reviewerSnap?.data()?.name ?? "a manager"} on{" "}
                      {visit.reviewedAt
                        ? new Date(visit.reviewedAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  {visit.reviewReason && (
                    <p className="text-sm text-ink">{visit.reviewReason}</p>
                  )}
                </div>
              ) : (
                <ReviewActions visitId={visit.id} />
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
