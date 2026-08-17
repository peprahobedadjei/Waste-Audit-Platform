import { NextResponse } from "next/server";
import { distanceMeters, isValidCoordinate } from "@/lib/geo";
import { daysAfterCollection, resolveCycleId } from "@/lib/cycles";

/*
  Regression harness for the pure audit logic - distance and cycle maths.

  These two functions decide whether a visit gets flagged and which cycle it
  counts towards, so a silent change to either would corrupt the reports
  without anything visibly breaking. Development only; never served in production.
*/
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const checks: { name: string; expected: unknown; actual: unknown; pass: boolean }[] = [];

  function expect(name: string, actual: unknown, expected: unknown) {
    checks.push({ name, expected, actual, pass: actual === expected });
  }

  function expectNear(name: string, actual: number, expected: number, tol: number) {
    checks.push({
      name,
      expected: `${expected} +/- ${tol}`,
      actual,
      pass: Math.abs(actual - expected) <= tol,
    });
  }

  // --- distance ---
  expect("same point is 0m", distanceMeters(2.0371, 45.3438, 2.0371, 45.3438), 0);
  expectNear("1 degree latitude ~111.2km", distanceMeters(0, 0, 1, 0), 111195, 200);
  // ~0.00045 deg latitude is about 50m - the default tolerance boundary
  expectNear(
    "50m north of a Mogadishu point",
    distanceMeters(2.0371, 45.3438, 2.03755, 45.3438),
    50,
    3,
  );
  expectNear(
    "340m fabricated-visit case",
    distanceMeters(2.0371, 45.3438, 2.0371, 45.34686),
    340,
    10,
  );

  expect("rejects out-of-range latitude", isValidCoordinate(91, 45), false);
  expect("rejects NaN", isValidCoordinate(Number.NaN, 45), false);
  expect("accepts Mogadishu", isValidCoordinate(2.0371, 45.3438), true);

  // --- cycles: collection Sat(6) + Thu(4) ---
  const collectionDays = [6, 4];

  // 2026-08-16 is a Sunday -> belongs to Saturday 2026-08-15
  expect(
    "Sunday audit maps to Saturday collection",
    resolveCycleId(new Date("2026-08-16T09:00:00Z"), collectionDays),
    "2026-08-15",
  );
  // 2026-08-21 is a Friday -> belongs to Thursday 2026-08-20
  expect(
    "Friday audit maps to Thursday collection",
    resolveCycleId(new Date("2026-08-21T09:00:00Z"), collectionDays),
    "2026-08-20",
  );
  // A late Monday submission still belongs to the previous Saturday
  expect(
    "late Monday audit still maps to Saturday",
    resolveCycleId(new Date("2026-08-17T09:00:00Z"), collectionDays),
    "2026-08-15",
  );
  // Collection day itself maps to itself
  expect(
    "Saturday maps to itself",
    resolveCycleId(new Date("2026-08-15T09:00:00Z"), collectionDays),
    "2026-08-15",
  );
  expect("no collection days configured", resolveCycleId(new Date(), []), null);

  // East Africa Time boundary: 22:30 UTC on Sat 15th is 01:30 Sun 16th local,
  // so it must still resolve to the Saturday cycle rather than sliding a day.
  expect(
    "UTC+3 boundary stays on the right cycle",
    resolveCycleId(new Date("2026-08-15T22:30:00Z"), collectionDays),
    "2026-08-15",
  );

  expect(
    "Sunday is 1 day after collection",
    daysAfterCollection(new Date("2026-08-16T09:00:00Z"), "2026-08-15"),
    1,
  );
  expect(
    "late Monday is 2 days after collection",
    daysAfterCollection(new Date("2026-08-17T09:00:00Z"), "2026-08-15"),
    2,
  );

  const failed = checks.filter((c) => !c.pass);
  return NextResponse.json(
    { total: checks.length, passed: checks.length - failed.length, failed, checks },
    { status: failed.length === 0 ? 200 : 500 },
  );
}
