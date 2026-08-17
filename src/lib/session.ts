import "server-only";

import { cookies } from "next/headers";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, type Role } from "@/lib/session-shared";
import { EMPTY_SCOPE, type ManagerScope, type ManagerStatus } from "@/lib/types";

export { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session-shared";
export type { Role } from "@/lib/session-shared";

export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  status: ManagerStatus;
  /** Null for the system administrator, who is not scoped. */
  scope: ManagerScope | null;
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
      status?: ManagerStatus;
      scope?: ManagerScope | null;
    };

    // A deactivated account must lose access immediately, not at cookie expiry
    if (data.status === "inactive") return null;

    return {
      uid: decoded.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      avatarUrl: data.avatarUrl ?? null,
      status: data.status ?? "active",
      scope:
        data.role === "admin" ? null : { ...EMPTY_SCOPE, ...(data.scope ?? {}) },
    };
  } catch {
    return null;
  }
}
