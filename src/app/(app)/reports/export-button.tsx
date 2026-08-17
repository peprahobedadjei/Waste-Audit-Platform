"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DistrictStats } from "@/lib/queries";

export function ExportButton({
  rows,
  period,
  summary,
}: {
  rows: DistrictStats[];
  period: string;
  summary: {
    total: number;
    collectedRate: number;
    satisfiedRate: number;
    overallScore: number;
  };
}) {
  function download() {
    const lines = [
      `${period} report,generated ${new Date().toLocaleString()}`,
      `Visits counted,${summary.total}`,
      `Collection rate,${summary.collectedRate}%`,
      `Satisfaction rate,${summary.satisfiedRate}%`,
      `Cleanliness score,${summary.overallScore}%`,
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
    link.download = `waste-audit-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={rows.length === 0}>
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
