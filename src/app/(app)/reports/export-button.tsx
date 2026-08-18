"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DistrictStats } from "@/lib/queries";

export function ExportButton({
  rows,
  period,
  summary,
  weights,
}: {
  rows: DistrictStats[];
  period: string;
  summary: {
    total: number;
    collectedRate: number;
    satisfiedRate: number;
    overallScore: number;
    cycles: number;
  };
  weights: { collection: number; cleanliness: number; satisfaction: number };
}) {
  function downloadCsv() {
    const lines = [
      `${period} report,generated ${new Date().toLocaleString()}`,
      `Collection cycles covered,${summary.cycles}`,
      `Visits counted,${summary.total}`,
      `Collection rate,${summary.collectedRate}%`,
      `Satisfaction rate,${summary.satisfiedRate}%`,
      `Cleanliness score,${summary.overallScore}%`,
      `Score weighting,${weights.collection}% collection + ${weights.cleanliness}% cleanliness + ${weights.satisfaction}% satisfaction`,
      "",
      "District,Visits,Collection rate %,Satisfaction rate %,Cleanliness /5,Flagged",
      ...rows.map((r) =>
        [
          `"${r.name.replace(/"/g, '""')}"`,
          r.visits,
          r.collectedRate,
          r.satisfiedRate,
          r.cleanliness,
          r.flagged,
        ].join(","),
      ),
      "",
      "Rejected visits are excluded from all rates.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waste-audit-${period.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={downloadCsv}
        disabled={rows.length === 0}
      >
        <Download className="h-4 w-4" />
        CSV
      </Button>
      {/*
        Print-to-PDF rather than a PDF library. The browser's own engine
        renders the charts and tables exactly as shown, handles pagination, and
        adds nothing to the bundle - a client-side PDF generator would have to
        re-draw all of it and would still look different from the screen.
      */}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => window.print()}
        disabled={rows.length === 0}
      >
        <Printer className="h-4 w-4" />
        PDF / Print
      </Button>
    </div>
  );
}
