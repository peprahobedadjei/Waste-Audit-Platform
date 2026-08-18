"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardHeader } from "@/components/ui/card";

export type DuplicateGroup = {
  serialNumber: string;
  districtName: string;
  entries: {
    id: string;
    registeredByName: string;
    createdAt: string;
    refLat: number | null;
    refLng: number | null;
    visitCount: number;
  }[];
};

export function DuplicatesClient({ groups }: { groups: DuplicateGroup[] }) {
  const router = useRouter();
  const [active, setActive] = useState<DuplicateGroup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{notice}</span>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={`${group.serialNumber}-${group.districtName}`}>
            <CardHeader
              title={`Serial ${group.serialNumber}`}
              description={`${group.entries.length} records in ${group.districtName}`}
              action={
                <Button size="sm" onClick={() => setActive(group)}>
                  <Merge className="h-4 w-4" />
                  Resolve
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {group.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span className="text-sm text-ink">
                    Registered by{" "}
                    <span className="font-medium">{entry.registeredByName}</span>
                  </span>
                  <span className="text-sm text-ink-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  {entry.refLat != null && entry.refLng != null && (
                    <span className="font-mono text-xs text-ink-muted">
                      {entry.refLat.toFixed(5)}, {entry.refLng.toFixed(5)}
                    </span>
                  )}
                  <Badge tone="neutral">
                    {entry.visitCount} visit{entry.visitCount === 1 ? "" : "s"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {active && (
        <ResolveModal
          group={active}
          onClose={() => setActive(null)}
          onDone={(message) => {
            setNotice(message);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ResolveModal({
  group,
  onClose,
  onDone,
}: {
  group: DuplicateGroup;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Default to keeping the record with the most visits - the one most of the
  // history already points at
  const [keepId, setKeepId] = useState(
    [...group.entries].sort((a, b) => b.visitCount - a.visitCount)[0]?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toMerge = group.entries.filter((e) => e.id !== keepId);

  async function resolve() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setError(null);
    setBusy(true);

    let moved = 0;
    for (const entry of toMerge) {
      const response = await fetch("/api/houses/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, mergeId: entry.id, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Could not merge those records.");
        setBusy(false);
        return;
      }
      moved += body.visitsMoved ?? 0;
    }

    setBusy(false);
    onDone(
      `Serial ${group.serialNumber} resolved. ${moved} visit${moved === 1 ? "" : "s"} moved onto the kept record.`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Resolve serial ${group.serialNumber}`}
      description="Pick the record to keep. The others are archived and their visits move across — nothing is deleted."
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {group.entries.map((entry) => (
            <label
              key={entry.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface"
            >
              <input
                type="radio"
                name="keep"
                checked={keepId === entry.id}
                onChange={() => setKeepId(entry.id)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {entry.registeredByName} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <span className="block text-xs text-ink-muted">
                  {entry.visitCount} visit{entry.visitCount === 1 ? "" : "s"}
                  {entry.refLat != null &&
                    ` · ${entry.refLat.toFixed(5)}, ${entry.refLng?.toFixed(5)}`}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div>
          <label
            htmlFor="merge-reason"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Reason
          </label>
          <textarea
            id="merge-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this record is the correct one."
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-brand"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={resolve}>
            Merge {toMerge.length} record{toMerge.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
