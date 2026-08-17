"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { Auditor, District } from "@/lib/types";

export function VisitFilters({
  districts,
  auditors,
}: {
  districts: District[];
  auditors: Auditor[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/visits?${next.toString()}`);
  }

  return (
    <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Select
        id="f-district"
        value={params.get("district") ?? ""}
        onChange={(e) => setParam("district", e.target.value)}
      >
        <option value="">All districts</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>

      <Select
        id="f-auditor"
        value={params.get("auditor") ?? ""}
        onChange={(e) => setParam("auditor", e.target.value)}
      >
        <option value="">All auditors</option>
        {auditors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>

      <Select
        id="f-collected"
        value={params.get("collected") ?? ""}
        onChange={(e) => setParam("collected", e.target.value)}
      >
        <option value="">Collected: any</option>
        <option value="yes">Collected: yes</option>
        <option value="no">Collected: no</option>
      </Select>

      <Select
        id="f-satisfied"
        value={params.get("satisfied") ?? ""}
        onChange={(e) => setParam("satisfied", e.target.value)}
      >
        <option value="">Satisfied: any</option>
        <option value="yes">Satisfied: yes</option>
        <option value="no">Satisfied: no</option>
      </Select>

      <Select
        id="f-flagged"
        value={params.get("flagged") ?? ""}
        onChange={(e) => setParam("flagged", e.target.value)}
      >
        <option value="">All visits</option>
        <option value="yes">Flagged only</option>
      </Select>
    </div>
  );
}
