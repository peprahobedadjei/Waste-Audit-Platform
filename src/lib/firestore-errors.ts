import "server-only";

import { NextResponse } from "next/server";

/**
 * Turns a Firestore failure into something actionable.
 *
 * The common one in this app is a missing composite index: any query that
 * combines a `where` with an `orderBy` needs one, and Firestore's error
 * carries a direct console link to create it. That link is the useful part, so
 * it is logged in full rather than swallowed behind a generic 500.
 */
export function firestoreError(
  err: unknown,
  fallback = "Something went wrong.",
): NextResponse {
  const message = err instanceof Error ? err.message : String(err);

  if (/FAILED_PRECONDITION|requires an index|needs an index/i.test(message)) {
    // Contains the create-index URL - the only way to act on this quickly
    console.error("[firestore] missing composite index:", message);
    return NextResponse.json(
      {
        error:
          "This query needs a database index that has not been created yet. " +
          "Check the server logs for the link to create it.",
      },
      { status: 503 },
    );
  }

  if (/NOT_FOUND|database.*does not exist/i.test(message)) {
    console.error("[firestore] database missing:", message);
    return NextResponse.json(
      { error: "The Firestore database has not been created for this project." },
      { status: 503 },
    );
  }

  console.error("[firestore] query failed:", message);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
