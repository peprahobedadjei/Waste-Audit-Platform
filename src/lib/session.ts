import "server-only";

import { cookies } from "next/headers";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, type Role } from "@/lib/session-shared";

export { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session-shared";
export type { Role } from "@/lib/session-shared";

export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

/**
 * Resolves the signed-in user from the session cookie.
 * Returns null when there is no valid session - callers decide what to do.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isAdminConfigured()) return null;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    if (!snap.exists) return null;

    const data = snap.data() as {
      email: string;
      name: string;
      role: Role;
      avatarUrl?: string | null;
    };
    return {
      uid: decoded.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      avatarUrl: data.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}
