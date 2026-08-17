"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Check, Recycle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { DEFAULT_BRANDING, type Branding } from "@/lib/branding-types";

const SWATCHES = [
  { key: "primaryColor", label: "Primary", hint: "Buttons and active states" },
  { key: "hoverColor", label: "Hover", hint: "Button hover" },
  { key: "darkColor", label: "Dark", hint: "Headings and emphasis" },
  { key: "tintColor", label: "Tint", hint: "Badges and selected rows" },
] as const;

export function BrandingClient({
  initial,
  canEdit,
}: {
  initial: Branding;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [branding, setBranding] = useState<Branding>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Branding>(key: K, value: Branding[K]) {
    setBranding((b) => ({ ...b, [key]: value }));
    setSaved(false);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const response = await fetch("/api/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(body.error ?? "Could not save the branding.");
      return;
    }

    setSaved(true);
    // Colours are injected by the root layout, so a refresh applies them live
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border border-pending/30 bg-pending/5 px-4 py-3 text-sm text-pending">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Only an administrator can change branding.</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Identity"
          description="Applies to the dashboard, the auditors' app, and every email sent from the system."
        />
        <div className="space-y-5 p-5">
          <Input
            id="app-name"
            label="App name"
            required
            disabled={!canEdit}
            value={branding.appName}
            onChange={(e) => update("appName", e.target.value)}
          />
          <ImageUpload
            kind="logo"
            value={branding.logoUrl}
            onChange={(url) => update("logoUrl", url)}
            label="Logo"
            hint="Square works best. Falls back to the default mark when empty."
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Colours"
          description="Stored as CSS variables, so a change here retints both the dashboard and the mobile app without a release."
        />
        <div className="space-y-4 p-5">
          {SWATCHES.map(({ key, label, hint }) => (
            <div key={key} className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label={`${label} colour`}
                disabled={!canEdit}
                value={branding[key]}
                onChange={(e) => update(key, e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1 disabled:cursor-not-allowed"
              />
              <div className="w-32 shrink-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-muted">{hint}</p>
              </div>
              <input
                aria-label={`${label} hex value`}
                disabled={!canEdit}
                value={branding[key]}
                onChange={(e) => update(key, e.target.value)}
                className="h-11 w-32 rounded-lg border border-line bg-white px-3 font-mono text-sm text-ink focus:outline-2 focus:outline-brand"
              />
            </div>
          ))}

          <button
            type="button"
            disabled={!canEdit}
            onClick={() =>
              setBranding((b) => ({
                ...b,
                primaryColor: DEFAULT_BRANDING.primaryColor,
                hoverColor: DEFAULT_BRANDING.hoverColor,
                darkColor: DEFAULT_BRANDING.darkColor,
                tintColor: DEFAULT_BRANDING.tintColor,
              }))
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to default green
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preview" description="How it will look once saved." />
        <div className="p-5">
          <div
            className="rounded-xl border border-line p-5"
            style={{ background: "#ffffff" }}
          >
            <div className="mb-4 flex items-center gap-2.5">
              {branding.logoUrl ? (
                <Image
                  src={branding.logoUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-lg object-contain"
                  unoptimized
                />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                  style={{ background: branding.primaryColor }}
                >
                  <Recycle className="h-5 w-5" />
                </span>
              )}
              <span
                className="text-sm font-semibold"
                style={{ color: branding.darkColor }}
              >
                {branding.appName || "App name"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
                style={{ background: branding.primaryColor }}
              >
                Primary button
              </span>
              <span
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
                style={{ background: branding.hoverColor }}
              >
                Hover
              </span>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: branding.tintColor,
                  color: branding.darkColor,
                }}
              >
                Badge
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving} disabled={!canEdit}>
          Save branding
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
