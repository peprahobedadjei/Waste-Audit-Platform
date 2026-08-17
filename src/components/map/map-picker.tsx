"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { BASEMAPS, DEFAULT_CENTER, DEFAULT_ZOOM, type BasemapKey } from "./tiles";
import { pinIcon } from "./marker-icon";
import { cn } from "@/lib/utils";

export type LatLng = { lat: number; lng: number };

/** Recentres when the value changes from outside - a geocode result, say. */
function Recenter({ position, zoom }: { position: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], zoom ?? map.getZoom());
  }, [position, zoom, map]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (value: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Single-point picker. Click anywhere or drag the pin.
 *
 * The map exists so a person can confirm where a coordinate actually landed -
 * a typed lat/lng is unverifiable, a pin on a rooftop is not.
 */
export function MapPicker({
  value,
  onChange,
  height = 260,
  zoom = 14,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  height?: number;
  zoom?: number;
}) {
  const [basemap, setBasemap] = useState<BasemapKey>("street");
  const tiles = BASEMAPS[basemap];

  const center = useMemo<[number, number]>(
    () => (value ? [value.lat, value.lng] : DEFAULT_CENTER),
    [value],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <span className="text-xs text-ink-muted">
          {value
            ? "Click the map or drag the pin to adjust"
            : "Click the map to place a pin"}
        </span>
        <div className="flex gap-1">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                basemap === key
                  ? "bg-brand text-white"
                  : "bg-white text-ink-muted hover:bg-surface",
              )}
            >
              {BASEMAPS[key].label}
            </button>
          ))}
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={value ? zoom : DEFAULT_ZOOM}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          key={basemap}
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
        />
        <ClickToPlace onPick={onChange} />
        <Recenter position={value} zoom={zoom} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon("brand")}
            draggable
            eventHandlers={{
              dragend(event) {
                const { lat, lng } = event.target.getLatLng();
                onChange({ lat, lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
