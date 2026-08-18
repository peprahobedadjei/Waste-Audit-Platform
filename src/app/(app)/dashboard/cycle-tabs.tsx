"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { CycleOption } from "@/lib/cycles";

export function CycleTabs({
  cycles,
  current,
  basePath = "/dashboard",
}: {
  cycles: CycleOption[];
  current: string | null;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (cycles.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="text-sm text-ink-muted">Collection cycle</span>
      <div className="w-64">
        <Select
          id="cycle"
          value={current ?? ""}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            if (event.target.value) next.set("cycle", event.target.value);
            else next.delete("cycle");
            router.push(`${basePath}?${next.toString()}`);
          }}
        >
          {cycles.map((cycle, index) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.label}
              {index === 0 ? " (current)" : ""}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
