"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewActions({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accepted" | "rejected" | null>(null);

  async function submit(decision: "accepted" | "rejected") {
    if (!reason.trim()) {
      setError("A reason is required so the decision is auditable.");
      return;
    }

    setError(null);
    setBusy(decision);

    const response = await fetch(`/api/visits/${visitId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setError(body.error ?? "Could not save the review.");
      return;
    }

    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="review-reason"
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          Reason
        </label>
        <textarea
          id="review-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this visit is or is not credible."
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          loading={busy === "accepted"}
          onClick={() => submit("accepted")}
        >
          <Check className="h-4 w-4" />
          Accept visit
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={busy === "rejected"}
          onClick={() => submit("rejected")}
        >
          <X className="h-4 w-4" />
          Reject as not credible
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        A rejected visit stays on the record and is excluded from the collection
        and satisfaction rates. Nothing is deleted.
      </p>
    </div>
  );
}
