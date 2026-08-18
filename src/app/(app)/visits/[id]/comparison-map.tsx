"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Pin } from "@/components/map/pin-map";

const PinMap = dynamic(
  () => import("@/components/map/pin-map").then((m) => m.PinMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-line bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
      </div>
    ),
  },
);

/**
 * Reference pin versus submitted pin, with the gap drawn between them.
 *
 * "340m from reference" is a number. Two pins with a road between them is an
 * argument a client can see, which is what a manager needs when a contractor
 * disputes a finding. Satellite opens by default here - rooftops answer
 * "was this plausibly at a house" in a way a street map cannot.
 */
export function ComparisonMap({
  reference,
  submitted,
  distance,
}: {
  reference: { lat: number; lng: number } | null;
  submitted: { lat: number; lng: number };
  distance: number | null;
}) {
  const pins: Pin[] = [];

  if (reference) {
    pins.push({
      id: "reference",
      lat: reference.lat,
      lng: reference.lng,
      tone: "brand",
      label: "R",
      popup: <span className="text-xs">House reference location</span>,
    });
  }

  pins.push({
    id: "submitted",
    lat: submitted.lat,
    lng: submitted.lng,
    tone: distance != null && reference ? "danger" : "success",
    label: "V",
    popup: <span className="text-xs">Where this visit was submitted</span>,
  });

  return (
    <>
      <PinMap
        pins={pins}
        height={320}
        connect={Boolean(reference)}
        initialBasemap="satellite"
      />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
        {reference && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--brand-primary)" }}
            />
            R — house reference
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--danger)" }}
          />
          V — this visit
        </span>
        {distance != null && (
          <span className="font-medium text-ink">{distance}m apart</span>
        )}
      </div>
    </>
  );
}
