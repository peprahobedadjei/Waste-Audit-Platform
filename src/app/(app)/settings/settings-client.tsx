"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DAY_NAMES, type AuditSettings } from "@/lib/types";

export function SettingsClient({ initial }: { initial: AuditSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<AuditSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof AuditSettings>(key: K, value: AuditSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function toggleDay(field: "collectionDays" | "auditDays", day: number) {
    const current = settings[field];
    update(
      field,
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort(),
    );
  }

  const weights = settings.cleanlinessWeights;
  const weightTotal =
    weights.collection + weights.cleanliness + weights.satisfaction;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save settings.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
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
          title="Location verification"
          description="These two numbers decide when a visit gets flagged."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <Input
              id="tolerance"
              type="number"
              label="Distance tolerance (metres)"
              min={5}
              max={1000}
              value={settings.toleranceMeters}
              onChange={(e) => update("toleranceMeters", Number(e.target.value))}
            />
            <p className="mt-1.5 text-sm text-ink-muted">
              A visit further than this from the house&apos;s reference location is
              flagged for review. Roughly house-to-house, not street-to-street.
            </p>
          </div>
          <div>
            <Input
              id="accuracy"
              type="number"
              label="Minimum GPS accuracy (metres)"
              min={5}
              max={200}
              value={settings.minGpsAccuracy}
              onChange={(e) => update("minGpsAccuracy", Number(e.target.value))}
            />
            <p className="mt-1.5 text-sm text-ink-muted">
              Submission stays locked until the phone reports at least this
              accuracy, so weak signal cannot manufacture flags.
            </p>
          </div>
          <div>
            <Input
              id="override"
              type="number"
              label="Accuracy override after (seconds)"
              min={10}
              max={300}
              value={settings.accuracyOverrideSeconds}
              onChange={(e) =>
                update("accuracyOverrideSeconds", Number(e.target.value))
              }
            />
            <p className="mt-1.5 text-sm text-ink-muted">
              If accuracy will not improve, submission unlocks anyway and the poor
              reading is recorded on the visit.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cycle days"
          description="A cycle is one collection day plus the audit day that follows it."
        />
        <div className="space-y-5 p-5">
          <DayPicker
            label="Collection days"
            hint="When the waste company is contracted to collect."
            selected={settings.collectionDays}
            onToggle={(d) => toggleDay("collectionDays", d)}
          />
          <DayPicker
            label="Audit days"
            hint="When auditors verify with residents."
            selected={settings.auditDays}
            onToggle={(d) => toggleDay("auditDays", d)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cleanliness score weights"
          description="Printed on every report, so the client can see how the number was produced."
        />
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="w-collection"
              type="number"
              label="Collection rate %"
              min={0}
              max={100}
              value={weights.collection}
              onChange={(e) =>
                update("cleanlinessWeights", {
                  ...weights,
                  collection: Number(e.target.value),
                })
              }
            />
            <Input
              id="w-cleanliness"
              type="number"
              label="Cleanliness rating %"
              min={0}
              max={100}
              value={weights.cleanliness}
              onChange={(e) =>
                update("cleanlinessWeights", {
                  ...weights,
                  cleanliness: Number(e.target.value),
                })
              }
            />
            <Input
              id="w-satisfaction"
              type="number"
              label="Satisfaction %"
              min={0}
              max={100}
              value={weights.satisfaction}
              onChange={(e) =>
                update("cleanlinessWeights", {
                  ...weights,
                  satisfaction: Number(e.target.value),
                })
              }
            />
          </div>
          <p
            className={cn(
              "mt-3 text-sm",
              weightTotal === 100 ? "text-ink-muted" : "text-danger",
            )}
          >
            Total: {weightTotal}%{weightTotal !== 100 && " — must equal 100%"}
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Save settings
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

function DayPicker({
  label,
  hint,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  selected: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {DAY_NAMES.map((day, index) => {
          const active = selected.includes(index);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onToggle(index)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-transparent bg-brand text-white"
                  : "border-line bg-white text-ink-muted hover:bg-surface",
              )}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
    </div>
  );
}
