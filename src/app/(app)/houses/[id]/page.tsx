import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import type { House, Visit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isAdminConfigured()) notFound();

  const db = adminDb();
  const snap = await db.collection("houses").doc(id).get();
  if (!snap.exists) notFound();

  const house = { id: snap.id, ...snap.data() } as House;

  const [districtSnap, visitSnap, setterSnap] = await Promise.all([
    db.collection("districts").doc(house.districtId).get(),
    db
      .collection("visits")
      .where("houseId", "==", id)
      .orderBy("capturedAt", "desc")
      .get(),
    house.refSetBy
      ? db.collection("auditors").doc(house.refSetBy).get()
      : Promise.resolve(null),
  ]);

  const visits = visitSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Visit,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/houses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All houses
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          House {house.serialNumber}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {districtSnap.data()?.name ?? "Unknown district"}
          {house.description ? ` · ${house.description}` : ""}
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Reference location"
            description="Set by the first auditor to visit. Every later visit is measured against this."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field
              label="Coordinates"
              value={
                house.refLat != null && house.refLng != null ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                    <MapPin className="h-4 w-4 text-ink-muted" />
                    {house.refLat.toFixed(6)}, {house.refLng.toFixed(6)}
                  </span>
                ) : (
                  <Badge tone="pending">Not set</Badge>
                )
              }
            />
            <Field
              label="GPS accuracy when set"
              value={house.refAccuracy != null ? `±${house.refAccuracy}m` : "—"}
            />
            <Field
              label="Set by"
              value={setterSnap?.data()?.name ?? "—"}
            />
            <Field
              label="Set on"
              value={
                house.refSetAt
                  ? new Date(house.refSetAt).toLocaleString()
                  : "—"
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Visit history"
            description={`${visits.length} visit${visits.length === 1 ? "" : "s"} recorded.`}
          />
          {visits.length === 0 ? (
            <EmptyState title="No visits recorded for this house yet" />
          ) : (
            <ul className="divide-y divide-line">
              {visits.map((visit) => (
                <li key={visit.id} className="flex items-start gap-4 px-5 py-4">
                  {visit.photoUrl ? (
                    <Image
                      src={visit.photoUrl}
                      alt=""
                      width={72}
                      height={72}
                      className="h-18 w-18 shrink-0 rounded-lg object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted">
                      No photo
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={visit.collected ? "success" : "danger"}>
                        {visit.collected ? "Collected" : "Not collected"}
                      </Badge>
                      <Badge tone={visit.satisfied ? "success" : "danger"}>
                        {visit.satisfied ? "Satisfied" : "Not satisfied"}
                      </Badge>
                      {visit.flagged && <Badge tone="danger">Flagged</Badge>}
                      {visit.isFirstVisit && (
                        <Badge tone="neutral">Set reference</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-ink-muted">
                      {new Date(visit.capturedAt).toLocaleString()}
                      {visit.distanceFromRef != null &&
                        ` · ${visit.distanceFromRef}m from reference`}
                      {visit.gpsAccuracy != null && ` · ±${visit.gpsAccuracy}m`}
                    </p>
                    {visit.note && (
                      <p className="mt-1 text-sm text-ink">{visit.note}</p>
                    )}
                  </div>
                  <Link
                    href={`/visits/${visit.id}`}
                    className="shrink-0 text-sm font-medium text-brand hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{value}</div>
    </div>
  );
}
