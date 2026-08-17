"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteClient({
  token,
  name,
  districtName,
}: {
  token: string;
  name: string;
  districtName: string | null;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (pin !== confirm) {
      setError("The two PINs do not match.");
      return;
    }
    if (pin.length < 6) {
      setError("Your PIN must be at least 6 characters.");
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/invites/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(body.error ?? "Could not set your PIN.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-ink">Your account is ready</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Open the mobile app and sign in with your email address and the PIN you
          just set.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-sm text-ink">
          Hello <strong>{name}</strong>
        </p>
        {districtName && (
          <p className="mt-0.5 text-sm text-ink-muted">
            You are auditing {districtName} district.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Input
        id="pin"
        type="password"
        label="Choose a PIN"
        placeholder="At least 6 characters"
        required
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        icon={<KeyRound className="h-4 w-4" />}
      />
      <Input
        id="confirm"
        type="password"
        label="Confirm your PIN"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        icon={<KeyRound className="h-4 w-4" />}
      />

      <Button type="submit" size="lg" loading={saving} className="w-full">
        Set my PIN
      </Button>
    </form>
  );
}
