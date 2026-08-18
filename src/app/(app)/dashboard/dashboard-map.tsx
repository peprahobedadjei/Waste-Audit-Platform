"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Pin } from "@/components/map/pin-map";

const PinMap = dynamic(
  () => import("@/components/map/pin-map").then((m) => m.PinMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-line bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
      </div>
    ),
  },
);

export function DashboardMap({ pins }: { pins: Pin[] }) {
  return (
    <>
      <PinMap pins={pins} height={420} />
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
        <Legend tone="var(--success)" label="Collected" />
        <Legend tone="var(--danger)" label="Not collected" />
        <Legend tone="var(--pending)" label="Flagged" />
      </div>
    </>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: tone }}
      />
      {label}
    </span>
  );
}
