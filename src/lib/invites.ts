import "server-only";

import { randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const INVITE_TTL_DAYS = 7;

export type InviteSubject = "auditor" | "manager";

/**
 * Creates (or replaces) a single-use invite and returns the URL to email.
 * Any earlier unused invite for the same person is revoked, so a resend always
 * invalidates the previous link.
 */
export async function createInvite(
  subjectId: string,
  subjectType: InviteSubject = "auditor",
): Promise<string> {
  const db = adminDb();
  const token = randomBytes(32).toString("hex");

  const previous = await db
    .collection("invites")
    .where("subjectId", "==", subjectId)
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
    subjectId,
    subjectType,
    // Retained so existing auditor invites keep working
    auditorId: subjectType === "auditor" ? subjectId : null,
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
 * Reserves the email in Firebase Auth so it cannot be taken twice. The account
 * exists from this moment but has an unguessable random password - the person
 * sets a real one when they accept the invite.
 */
export async function provisionAuthUser(args: {
  email: string;
  name: string;
  role?: "auditor" | "manager";
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
    await auth.setCustomUserClaims(created.uid, {
      role: args.role ?? "auditor",
    });
    return created.uid;
  }
}
