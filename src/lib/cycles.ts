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

export type CycleOption = {
  id: string;
  label: string;
  /** Inclusive ISO date of the collection day. */
  collectionDate: string;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function labelFor(cycleId: string): string {
  const [y, m, d] = cycleId.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    date.getUTCDay()
  ];
  return `${weekday} ${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The most recent collection days, newest first.
 *
 * Managers think in "last Thursday's collection", so the selector offers real
 * cycles rather than rolling day windows. A window like "last 7 days" straddles
 * two collections and produces a number that cannot be reconciled with any
 * single collection day.
 */
export function recentCycles(
  collectionDays: number[],
  count = 12,
  from: Date = new Date(),
): CycleOption[] {
  if (collectionDays.length === 0) return [];

  const parts = toEatParts(from);
  const cursor = new Date(Date.UTC(parts.year, parts.month, parts.day));
  const cycles: CycleOption[] = [];

  // Look back far enough to gather `count` cycles even at one per week
  for (let back = 0; back < count * 8 && cycles.length < count; back++) {
    if (collectionDays.includes(cursor.getUTCDay())) {
      const id = formatDate(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
      );
      cycles.push({ id, label: labelFor(id), collectionDate: id });
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return cycles;
}

/** Cycle ids covering a trailing number of days, newest first. */
export function cyclesInRange(
  collectionDays: number[],
  days: number,
): string[] {
  const from = new Date();
  const earliest = new Date(Date.now() - days * 86_400_000);
  const out: string[] = [];

  for (const cycle of recentCycles(collectionDays, 400, from)) {
    const [y, m, d] = cycle.id.split("-").map(Number);
    if (Date.UTC(y, m - 1, d) < earliest.getTime()) break;
    out.push(cycle.id);
  }

  return out;
}
