"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const PERIODS = [
  ["cycle", "This cycle"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
] as const;

export function PeriodTabs({ current }: { current: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
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
