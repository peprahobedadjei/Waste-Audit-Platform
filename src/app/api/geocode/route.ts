import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  Place-name lookup via Nominatim, OpenStreetMap's geocoder.

  Deliberately not an LLM. Coordinates are a lookup against an authoritative
  source, and a model would return a confident, plausible, wrong number that
  nobody would think to check - worse than an empty field, which at least looks
  unfinished. Nominatim returns what OSM actually holds, or nothing.

  Free and keyless, but volunteer-funded: the usage policy asks for at most one
  request a second and a User-Agent that identifies the caller. Both are
  honoured below, and results are cached so repeat lookups cost nothing.
*/

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 1100;

type Result = {
  displayName: string;
  lat: number;
  lng: number;
  /** True when OSM holds this as an administrative boundary, not a landmark. */
  isDistrict: boolean;
};

/*
  Restrict to the country being audited. Without it, "Wadajir" matches a dozen
  suburbs across Somalia and beyond; with it plus the ranking below, the actual
  "Wadajir District, Banaadir" boundary comes first.
*/
const COUNTRY_CODES = process.env.GEOCODE_COUNTRY_CODES ?? "so";

const cache = new Map<string, { at: number; results: Result[] }>();
let lastRequestAt = 0;

export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ results: hit.results, cached: true });
  }

  // Honour the one-request-per-second courtesy limit
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "0");
  if (COUNTRY_CODES) url.searchParams.set("countrycodes", COUNTRY_CODES);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `WasteAuditSystem/1.0 (${
          process.env.SMTP_USER ?? "waste-audit-platform"
        })`,
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The place lookup service is unavailable right now." },
        { status: 502 },
      );
    }

    const raw = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      class?: string;
      type?: string;
    }[];

    /*
      Rank administrative boundaries above everything else.

      Searching a district name plainly tends to surface whatever landmark
      inside it happens to match - "Hodan" returns a military academy, "Wadajir"
      an immigration office. Those sit roughly in the right area, which makes
      them more dangerous than a miss: they look correct. The boundary record is
      the district itself, so it goes first and is labelled as such.
    */
    const results: Result[] = raw
      .map((row) => ({
        displayName: row.display_name,
        lat: Number(row.lat),
        lng: Number(row.lon),
        isDistrict:
          row.class === "boundary" && row.type === "administrative",
      }))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
      .sort((a, b) => Number(b.isDistrict) - Number(a.isDistrict))
      .slice(0, 6);

    cache.set(key, { at: Date.now(), results });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the place lookup service." },
      { status: 502 },
    );
  }
}
