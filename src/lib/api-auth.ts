import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { isAdminConfigured } from "@/lib/firebase/admin";

/**
 * Guard for API routes. Returns either the signed-in user or a response to
 * return immediately. Every data route in the dashboard goes through this.
 */
export async function requireUser(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  if (!isAdminConfigured()) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Server is not configured." },
        { status: 503 },
      ),
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  return { user, error: null };
}

/** Same as requireUser, but also rejects anyone who is not an admin. */
export async function requireAdmin(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const result = await requireUser();
  if (result.error) return result;

  if (result.user.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      ),
    };
  }

  return result;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Something went wrong.") {
  return NextResponse.json({ error: message }, { status: 500 });
}
