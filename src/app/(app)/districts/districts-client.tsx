"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { LocationField } from "./location-field";
import type { LatLng } from "@/components/map/map-picker";
import type { District } from "@/lib/types";

type Editing = District | null;

export function DistrictsClient({
  districts,
  auditorCounts,
  canEdit = true,
}: {
  districts: District[];
  auditorCounts: Record<string, number>;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [center, setCenter] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setCenter(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(district: District) {
    setEditing(district);
    setName(district.name);
    setCenter(
      district.centerLat != null && district.centerLng != null
        ? { lat: district.centerLat, lng: district.centerLng }
        : null,
    );
    setError(null);
    setOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      centerLat: center?.lat ?? null,
      centerLng: center?.lng ?? null,
    };

    const response = await fetch(
      editing ? `/api/districts/${editing.id}` : "/api/districts",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the district.");
      setSaving(false);
      return;
    }

    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(district: District) {
    const count = auditorCounts[district.id] ?? 0;
    const message =
      count > 0
        ? `${district.name} has ${count} auditor${count === 1 ? "" : "s"} assigned, so it will be archived rather than deleted. Continue?`
        : `Delete ${district.name}? This cannot be undone.`;

    if (!window.confirm(message)) return;

    const response = await fetch(`/api/districts/${district.id}`, {
      method: "DELETE",
    });
    if (response.ok) router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Districts"
          description={`${districts.length} configured`}
          action={
            canEdit ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add district
              </Button>
            ) : null
          }
        />

        {districts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No districts yet"
            description="Districts come first — every auditor is assigned to one, so nothing else can be set up until these exist."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add the first district
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">Name</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Auditors
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">
                    Map centre
                  </th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {districts.map((district) => (
                  <tr
                    key={district.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {district.name}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {auditorCounts[district.id] ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {district.centerLat != null && district.centerLng != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {district.centerLat.toFixed(4)},{" "}
                          {district.centerLng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-ink-muted/60">Not set</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={district.active ? "success" : "neutral"}>
                        {district.active ? "Active" : "Archived"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(district)}
                          aria-label={`Edit ${district.name}`}
                          className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(district)}
                          aria-label={`Remove ${district.name}`}
                          className="rounded-lg p-2 text-ink-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit district" : "Add district"}
        description="The map centre is optional — it only decides where the live map opens."
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
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
            id="district-name"
            label="District name"
            placeholder="e.g. Wadajir"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <LocationField
            districtId={editing?.id}
            districtName={name}
            value={center}
            onChange={setCenter}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add district"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
