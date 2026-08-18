"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { BASEMAPS, DEFAULT_CENTER, DEFAULT_ZOOM, type BasemapKey } from "./tiles";
import { pinIcon, type PinTone } from "./marker-icon";
import { cn } from "@/lib/utils";

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  tone?: PinTone;
  label?: string;
  popup?: React.ReactNode;
};

/** Frames the map on whatever pins exist, rather than a fixed centre. */
function FitToPins({ pins }: { pins: Pin[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 17);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }, [pins, map]);

  return null;
}

/**
 * Read-only map for plotting submissions.
 *
 * Used for the day's activity on the dashboard, and for the two-pin comparison
 * on a visit. Pins bunched at one spot when they should be spread along a
 * street say more at a glance than any flag count.
 */
export function PinMap({
  pins,
  height = 380,
  connect = false,
  initialBasemap = "street",
}: {
  pins: Pin[];
  height?: number;
  /** Draws a line between the first two pins - the reference vs submitted case. */
  connect?: boolean;
  initialBasemap?: BasemapKey;
}) {
  const [basemap, setBasemap] = useState<BasemapKey>(initialBasemap);
  const tiles = BASEMAPS[basemap];

  const center = useMemo<[number, number]>(
    () => (pins.length > 0 ? [pins[0].lat, pins[0].lng] : DEFAULT_CENTER),
    [pins],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
        <span className="text-xs text-ink-muted">
          {pins.length === 0
            ? "Nothing to show yet"
            : `${pins.length} point${pins.length === 1 ? "" : "s"}`}
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
        zoom={DEFAULT_ZOOM}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          key={basemap}
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
        />
        <FitToPins pins={pins} />

        {connect && pins.length >= 2 && (
          <Polyline
            positions={[
              [pins[0].lat, pins[0].lng],
              [pins[1].lat, pins[1].lng],
            ]}
            pathOptions={{
              color: "var(--danger)",
              weight: 2,
              dashArray: "6 6",
            }}
          />
        )}

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={pinIcon(pin.tone ?? "brand", pin.label)}
          >
            {pin.popup && <Popup>{pin.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
