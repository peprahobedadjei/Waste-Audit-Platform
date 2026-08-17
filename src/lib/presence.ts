import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { ONLINE_WINDOW_MINUTES } from "@/lib/types";

/*
  Sign-in activity.

  An honest caveat worth carrying into the UI: logout cannot be detected
  reliably. A closed tab, a flat battery or a phone that loses signal all leave
  no trace, so `logoutAt` is only ever set by a deliberate sign-out. Presence is
  therefore inferred from lastSeenAt, never asserted.
*/

const HEARTBEAT_THROTTLE_MS = 5 * 60 * 1000;

export async function startSession(args: {
  subjectId: string;
  subjectType: "user" | "auditor";
  name: string;
  role: string;
  userAgent?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const doc = await adminDb().collection("sessions").add({
    subjectId: args.subjectId,
    subjectType: args.subjectType,
    name: args.name,
    role: args.role,
    loginAt: now,
    lastSeenAt: now,
    logoutAt: null,
    userAgent: args.userAgent ?? null,
  });
  return doc.id;
}

/** Closes the most recent open session for this subject. */
export async function endSession(subjectId: string): Promise<void> {
  const db = adminDb();
  const open = await db
    .collection("sessions")
    .where("subjectId", "==", subjectId)
    .where("logoutAt", "==", null)
    .get();

  if (open.empty) return;

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const doc of open.docs) {
    batch.update(doc.ref, { logoutAt: now, lastSeenAt: now });
  }
  await batch.commit();
}

/**
 * Refreshes activity on the open session. Throttled, because writing on every
 * authenticated request would cost a Firestore write per API call.
 */
export async function touchSession(subjectId: string): Promise<void> {
  try {
    const db = adminDb();
    const open = await db
      .collection("sessions")
      .where("subjectId", "==", subjectId)
      .where("logoutAt", "==", null)
      .orderBy("loginAt", "desc")
      .limit(1)
      .get();

    if (open.empty) return;

    const doc = open.docs[0];
    const lastSeen = new Date(doc.data().lastSeenAt as string).getTime();
    if (Date.now() - lastSeen < HEARTBEAT_THROTTLE_MS) return;

    await doc.ref.update({ lastSeenAt: new Date().toISOString() });
  } catch {
    // Presence is diagnostic - never let it break a real request
  }
}

export function isOnline(lastSeenAt: string, logoutAt: string | null): boolean {
  if (logoutAt) return false;
  const age = Date.now() - new Date(lastSeenAt).getTime();
  return age < ONLINE_WINDOW_MINUTES * 60 * 1000;
}
