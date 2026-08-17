"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const PERIODS = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["annual", "Annual"],
] as const;

export function PeriodTabs({ current }: { current: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {PERIODS.map(([key, label]) => (
        <Link
          key={key}
          href={`/reports?period=${key}`}
          className={cn(
            "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
            current === key
              ? "border-transparent bg-brand text-white"
              : "border-line bg-white text-ink-muted hover:bg-surface",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
