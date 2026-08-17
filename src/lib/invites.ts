import "server-only";

import { randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const INVITE_TTL_DAYS = 7;

/**
 * Creates (or replaces) a single-use invite for an auditor and returns the URL
 * to email them. Any earlier unused invite for the same auditor is revoked, so
 * a resend always invalidates the previous link.
 */
export async function createInvite(auditorId: string): Promise<string> {
  const db = adminDb();
  const token = randomBytes(32).toString("hex");

  const previous = await db
    .collection("invites")
    .where("auditorId", "==", auditorId)
    .where("usedAt", "==", null)
    .get();

  const batch = db.batch();
  for (const doc of previous.docs) {
    batch.update(doc.ref, { revokedAt: new Date().toISOString() });
  }

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  batch.set(db.collection("invites").doc(token), {
    auditorId,
    token,
    expiresAt,
    usedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  });

  await batch.commit();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/invite/${token}`;
}

/**
 * Reserves the auditor's email in Firebase Auth so it cannot be taken twice.
 * The account exists from this moment but has an unguessable random password -
 * the auditor sets a real PIN when they accept the invite.
 */
export async function provisionAuthUser(args: {
  email: string;
  name: string;
}): Promise<string> {
  const auth = adminAuth();

  try {
    const existing = await auth.getUserByEmail(args.email);
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email: args.email,
      password: randomBytes(24).toString("hex"),
      displayName: args.name,
      emailVerified: false,
    });
    await auth.setCustomUserClaims(created.uid, { role: "auditor" });
    return created.uid;
  }
}
