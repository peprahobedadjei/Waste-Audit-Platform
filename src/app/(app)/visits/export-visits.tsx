"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Visit } from "@/lib/types";

/** Exports exactly the filtered view on screen - what you see is what you get. */
export function ExportVisits({
  visits,
  districtNames,
  auditorNames,
}: {
  visits: Visit[];
  districtNames: Record<string, string>;
  auditorNames: Record<string, string>;
}) {
  function download() {
    const escape = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const header = [
      "Captured at",
      "Received at",
      "Cycle",
      "House serial",
      "District",
      "Auditor",
      "Collected",
      "Satisfied",
      "Note",
      "Cleanliness /5",
      "Latitude",
      "Longitude",
      "GPS accuracy (m)",
      "Distance from reference (m)",
      "Flagged",
      "Review status",
      "Review reason",
    ].join(",");

    const rows = visits.map((v) =>
      [
        escape(v.capturedAt),
        escape(v.receivedAt),
        escape(v.cycleId),
        escape(v.serialNumber),
        escape(districtNames[v.districtId] ?? ""),
        escape(auditorNames[v.auditorId] ?? ""),
        v.collected ? "Yes" : "No",
        v.satisfied ? "Yes" : "No",
        escape(v.note),
        v.cleanlinessRating ?? "",
        v.lat,
        v.lng,
        v.gpsAccuracy ?? "",
        v.isFirstVisit ? "set reference" : (v.distanceFromRef ?? ""),
        v.flagged ? "Yes" : "No",
        escape(v.reviewStatus ?? ""),
        escape(v.reviewReason ?? ""),
      ].join(","),
    );

    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waste-audit-visits-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={download}
      disabled={visits.length === 0}
    >
      <Download className="h-4 w-4" />
      Export {visits.length} visit{visits.length === 1 ? "" : "s"}
    </Button>
  );
}
