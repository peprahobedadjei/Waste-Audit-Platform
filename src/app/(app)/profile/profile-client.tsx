"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { roleLabel } from "@/lib/session-shared";
import type { SessionUser } from "@/lib/session";

type Pending = { newEmail: string; expiresAt: string } | null;

function Alert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const isError = tone === "error";
  return (
    <div
      role="alert"
      className={
        isError
          ? "flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          : "flex items-start gap-2 rounded-lg border border-success/30 bg-brand-tint px-3 py-2.5 text-sm text-brand-dark"
      }
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

export function ProfileClient({
  user,
  pendingEmail,
  alertPrefs,
}: {
  user: SessionUser;
  pendingEmail: Pending;
  alertPrefs: AlertPrefs;
}) {
  return (
    <div className="space-y-6">
      <DetailsCard user={user} />
      <AlertsCard initial={alertPrefs} />
      <EmailCard user={user} pendingEmail={pendingEmail} />
      <PasswordCard />
    </div>
  );
}

type AlertPrefs = {
  flaggedVisits: boolean;
  missedClusters: boolean;
  email: boolean;
};

function AlertsCard({ initial }: { initial: AlertPrefs }) {
  const [prefs, setPrefs] = useState<AlertPrefs>(initial);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(next: AlertPrefs) {
    setPrefs(next);
    setSaved(false);
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertPrefs: next }),
    });
    setSaving(false);
    setSaved(true);
  }

  const options = [
    {
      key: "flaggedVisits" as const,
      label: "Flagged visits",
      hint: "When a visit is submitted too far from the house's reference location.",
    },
    {
      key: "missedClusters" as const,
      label: "Clusters of missed collections",
      hint: "When several households in one district report no collection in the same cycle.",
    },
    {
      key: "email" as const,
      label: "Also send these by email",
      hint: "Off by default — alerts always appear in the bell regardless.",
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Alerts"
        description="What the system should tell you about. Auditors never receive these."
      />
      <div className="space-y-3 p-5">
        {options.map(({ key, label, hint }) => (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3 hover:bg-surface"
          >
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => save({ ...prefs, [key]: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{label}</span>
              <span className="block text-sm text-ink-muted">{hint}</span>
            </span>
          </label>
        ))}
        {saved && !saving && (
          <p className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Saved
          </p>
        )}
      </div>
    </Card>
  );
}

function DetailsCard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatarUrl }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(body.error ?? "Could not save your profile.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Your details"
        description="Your name appears on every message you send and on each action in the audit log."
      />
      <form onSubmit={handleSave} className="space-y-5 p-5">
        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">Profile saved.</Alert>}

        <ImageUpload
          kind="avatar"
          value={avatarUrl}
          onChange={(url) => {
            setAvatarUrl(url);
            setSaved(false);
          }}
          label="Profile photo"
          hint="Shown in the sidebar so it is clear who is signed in. Square images work best."
          rounded
        />

        <Input
          id="profile-name"
          label="Full name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />

        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-sm text-ink-muted">Displayed as</span>
          <span className="text-sm font-medium text-ink">
            {name || "Your name"}{" "}
            <Badge tone="success">{roleLabel(user.role)}</Badge>
          </span>
        </div>

        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function EmailCard({
  user,
  pendingEmail,
}: {
  user: SessionUser;
  pendingEmail: Pending;
}) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const response = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword: password }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not start the email change.");
      return;
    }
    setSent(body.newEmail);
    setNewEmail("");
    setPassword("");
    router.refresh();
  }

  async function cancelPending() {
    setBusy(true);
    await fetch("/api/profile/email", { method: "DELETE" });
    setBusy(false);
    setSent(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Email address"
        description="Changing this changes how you sign in."
      />
      <div className="p-5">
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3">
          <Mail className="h-4 w-4 text-ink-muted" />
          <span className="text-sm text-ink">{user.email}</span>
          <Badge tone="neutral">Current</Badge>
        </div>

        {pendingEmail ? (
          <div className="space-y-3">
            <Alert tone="success">
              A confirmation link was sent to <strong>{pendingEmail.newEmail}</strong>.
              The change only takes effect once that link is opened.
            </Alert>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={cancelPending}
            >
              <X className="h-4 w-4" />
              Cancel this change
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            {sent && (
              <Alert tone="success">
                Confirmation sent to <strong>{sent}</strong>.
              </Alert>
            )}

            <Input
              id="new-email"
              type="email"
              label="New email address"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Input
              id="email-password"
              type="password"
              label="Confirm with your current password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" loading={busy}>
              Send confirmation link
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not change your password.");
      return;
    }

    setDone(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing this signs you out everywhere else."
      />
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {error && <Alert tone="error">{error}</Alert>}
        {done && <Alert tone="success">Password changed.</Alert>}

        <Input
          id="current-password"
          type="password"
          label="Current password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          id="next-password"
          type="password"
          label="New password"
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Input
          id="confirm-password"
          type="password"
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
