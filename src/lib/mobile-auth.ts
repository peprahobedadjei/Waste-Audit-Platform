import "server-only";

import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import type { Auditor } from "@/lib/types";

export type AuthedAuditor = Auditor & { uid: string };

/**
 * Guard for every mobile endpoint.
 *
 * The Android app signs in with Firebase Auth and sends the resulting ID token
 * as a bearer token. We verify it here - the app never touches Firestore
 * directly, so the token is the only thing it can present.
 */
export async function requireAuditor(request: Request): Promise<
  | { auditor: AuthedAuditor; error: null }
  | { auditor: null; error: NextResponse }
> {
  if (!isAdminConfigured()) {
    return {
      auditor: null,
      error: NextResponse.json(
        { error: "Server is not configured." },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return {
      auditor: null,
      error: NextResponse.json(
        { error: "Missing authentication token." },
        { status: 401 },
      ),
    };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const snap = await adminDb().collection("auditors").doc(decoded.uid).get();

    if (!snap.exists) {
      return {
        auditor: null,
        error: NextResponse.json(
          { error: "This account is not registered as an auditor." },
          { status: 403 },
        ),
      };
    }

    const auditor = { id: snap.id, uid: snap.id, ...snap.data() } as AuthedAuditor;

    if (auditor.status === "inactive") {
      return {
        auditor: null,
        error: NextResponse.json(
          { error: "This account has been deactivated." },
          { status: 403 },
        ),
      };
    }

    return { auditor, error: null };
  } catch {
    return {
      auditor: null,
      error: NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      ),
    };
  }
}
