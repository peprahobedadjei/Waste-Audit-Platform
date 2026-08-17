"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/components/map/map-picker";

// Leaflet touches `window` on import, so it can never render on the server
const MapPicker = dynamic(
  () => import("@/components/map/map-picker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-line bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
      </div>
    ),
  },
);

type Candidate = {
  displayName: string;
  lat: number;
  lng: number;
  isDistrict: boolean;
};

/**
 * Three ways to set a district centre, best first:
 *   1. centre of its registered houses  - needs no input, self-correcting
 *   2. place-name lookup                - one click, from OpenStreetMap
 *   3. click or drag on the map         - always available as the fallback
 *
 * Whichever is used, the pin is shown so a person can see where the number
 * actually landed rather than trusting it blind.
 */
export function LocationField({
  districtId,
  districtName,
  value,
  onChange,
}: {
  districtId?: string;
  districtName: string;
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"search" | "centroid" | null>(null);

  async function search() {
    const query = districtName.trim();
    if (!query) {
      setError("Enter the district name first.");
      return;
    }

    setError(null);
    setStatus(null);
    setCandidates(null);
    setBusy("search");

    // Send the bare name. Adding "Mogadishu, Somalia" pushes Nominatim toward
    // landmarks inside the district instead of the district boundary itself.
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const body = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setError(body.error ?? "Could not look up that name.");
      return;
    }
    if (!body.results?.length) {
      setError(
        `No place called "${query}" was found. Place the pin on the map instead.`,
      );
      return;
    }

    setCandidates(body.results);
  }

  async function useHouseCentre() {
    if (!districtId) return;

    setError(null);
    setStatus(null);
    setBusy("centroid");

    const response = await fetch(`/api/districts/${districtId}/centroid`);
    const body = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setError(body.error ?? "Could not work out the centre.");
      return;
    }
    if (!body.centroid) {
      setError(body.message ?? "No houses registered here yet.");
      return;
    }

    onChange(body.centroid);
    setCandidates(null);
    setStatus(
      `Centred on ${body.count} registered house${body.count === 1 ? "" : "s"}.`,
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Map centre</p>
        <span className="text-xs text-ink-muted">Optional</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={search}
          loading={busy === "search"}
        >
          <Search className="h-4 w-4" />
          Find by name
        </Button>
        {districtId && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={useHouseCentre}
            loading={busy === "centroid"}
          >
            <Crosshair className="h-4 w-4" />
            Centre on registered houses
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {status && (
        <p className="mb-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-muted">
          {status}
        </p>
      )}

      {candidates && candidates.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-lg border border-line">
          <p className="border-b border-line bg-surface px-3 py-2 text-xs text-ink-muted">
            Pick the right place, then check the pin below. Entries marked
            District are the actual boundary; the rest are nearby landmarks.
          </p>
          {candidates.map((candidate, index) => (
            <button
              key={`${candidate.lat}-${candidate.lng}-${index}`}
              type="button"
              onClick={() => {
                onChange({ lat: candidate.lat, lng: candidate.lng });
                setCandidates(null);
                setStatus(
                  candidate.isDistrict
                    ? "Centred on the district boundary from OpenStreetMap."
                    : "Set from a nearby landmark — check the pin and adjust.",
                );
              }}
              className="flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 text-sm text-ink">
                {candidate.displayName}
              </span>
              {candidate.isDistrict && (
                <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand-dark">
                  District
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <MapPicker
        value={value}
        onChange={(next) => {
          onChange(next);
          setStatus(null);
          setError(null);
        }}
        height={300}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink-muted">
          {value
            ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
            : "No centre set — the map will open on Mogadishu"}
        </p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-medium text-ink-muted hover:text-danger"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
