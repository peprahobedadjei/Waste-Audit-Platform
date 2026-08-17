/*
  Cycle maths.

  A cycle is one collection day plus the audit day that follows it. Managers
  think in "last Thursday's collection", not "the 14th", so every rate and
  report rolls up by cycle rather than by calendar week.

  Somalia is UTC+3 with no daylight saving. Timestamps are stored in UTC but
  cycle boundaries must be worked out in local time, otherwise a Saturday
  collection splits across two UTC days and every total comes out subtly wrong.
*/

const EAT_OFFSET_MINUTES = 3 * 60;

/** Converts an instant to the wall-clock date parts in East Africa Time. */
export function toEatParts(date: Date) {
  const shifted = new Date(date.getTime() + EAT_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

function formatDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Resolves which cycle a visit belongs to.
 *
 * Walks back from the visit date to the most recent collection day, and uses
 * that date as the cycle identifier. An audit submitted late - Monday for
 * Saturday's collection - still lands on the right cycle, which is what stops
 * a straggler being counted against the wrong week.
 *
 * Returns null when no collection day falls in the preceding week, which can
 * only happen if the settings are misconfigured.
 */
export function resolveCycleId(
  visitedAt: Date,
  collectionDays: number[],
): string | null {
  if (collectionDays.length === 0) return null;

  const parts = toEatParts(visitedAt);
  const cursor = new Date(Date.UTC(parts.year, parts.month, parts.day));

  for (let back = 0; back < 8; back++) {
    if (collectionDays.includes(cursor.getUTCDay())) {
      return formatDate(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return null;
}

/** How many days after the collection day the visit landed. */
export function daysAfterCollection(
  visitedAt: Date,
  cycleId: string,
): number {
  const parts = toEatParts(visitedAt);
  const visitDay = Date.UTC(parts.year, parts.month, parts.day);
  const [y, m, d] = cycleId.split("-").map(Number);
  const collectionDay = Date.UTC(y, m - 1, d);
  return Math.round((visitDay - collectionDay) / 86_400_000);
}

/** The current cycle, for "this cycle" counters on the dashboard and app. */
export function currentCycleId(collectionDays: number[]): string | null {
  return resolveCycleId(new Date(), collectionDays);
}
