/*
  Basemap sources.

  Street is the default because it is unambiguous about roads and names.
  Satellite matters more than it looks for this system: judging whether a pin
  is plausibly at a house means seeing rooftops, and OSM's building coverage in
  Mogadishu is patchy. Imagery answers that directly.

  Both are free and keyless. If tile volume ever grows past casual dashboard
  use, swap these URLs for a MapTiler key or self-hosted tiles - nothing else
  in the app knows or cares.
*/

export type BasemapKey = "street" | "satellite";

export const BASEMAPS: Record<
  BasemapKey,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  street: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
};

/** Mogadishu, used when a district has no centre and no houses yet. */
export const DEFAULT_CENTER: [number, number] = [2.0469, 45.3182];
export const DEFAULT_ZOOM = 12;
