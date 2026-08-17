import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/mobile-auth";
import { isValidCoordinate } from "@/lib/geo";
import { loadSettings, recordVisit, validateVisit } from "@/lib/visits";

const MAX_BATCH = 50;

/**
 * Drains the device's queue after a stretch with no signal.
 *
 * Every entry carries a clientId generated on the phone, so a batch that is
 * resent after a half-failed upload cannot create duplicates. Each visit is
 * reported on individually - one bad row never rejects the rest, because an
 * auditor losing a day of completed work is the worst outcome here.
 */
export async function POST(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  let body: { visits?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const entries = body.visits;
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No visits supplied." }, { status: 400 });
  }
  if (entries.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Send at most ${MAX_BATCH} visits per batch.` },
      { status: 400 },
    );
  }

  const settings = await loadSettings();

  const results: {
    clientId: string | null;
    status: "created" | "duplicate" | "error";
    id?: string;
    error?: string;
  }[] = [];

  for (const entry of entries) {
    const clientId = (entry.clientId as string | null) ?? null;

    if (!isValidCoordinate(entry.lat, entry.lng)) {
      results.push({
        clientId,
        status: "error",
        error: "A valid location is required.",
      });
      continue;
    }

    const input = {
      houseId: String(entry.houseId ?? ""),
      lat: entry.lat as number,
      lng: entry.lng as number,
      gpsAccuracy: (entry.gpsAccuracy as number | null) ?? null,
      photoUrl: (entry.photoUrl as string | null) ?? null,
      photoPublicId: (entry.photoPublicId as string | null) ?? null,
      collected: entry.collected as boolean,
      satisfied: entry.satisfied as boolean,
      note: (entry.note as string) ?? "",
      cleanlinessRating: Number(entry.cleanlinessRating),
      capturedAt: (entry.capturedAt as string) ?? undefined,
      clientId,
    };

    const invalid = validateVisit(input);
    if (invalid) {
      results.push({ clientId, status: "error", error: invalid });
      continue;
    }

    try {
      const outcome = await recordVisit(auditor, input, settings);
      if (outcome.ok) {
        results.push({
          clientId,
          status: outcome.duplicate ? "duplicate" : "created",
          id: outcome.id,
        });
      } else {
        results.push({ clientId, status: "error", error: outcome.error });
      }
    } catch {
      results.push({
        clientId,
        status: "error",
        error: "Could not save this visit.",
      });
    }
  }

  return NextResponse.json({
    summary: {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      failed: results.filter((r) => r.status === "error").length,
    },
    results,
  });
}
