import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session";

/**
 * Exchanges a Firebase ID token (obtained in the browser after sign-in) for an
 * httpOnly session cookie. The browser never holds a long-lived credential.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured. Missing Firebase Admin credentials." },
      { status: 503 },
    );
  }

  let idToken: string | undefined;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);

    // Only provisioned users may hold a dashboard session. There is no sign-up.
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "This account is not provisioned for the dashboard." },
        { status: 403 },
      );
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not verify sign-in." }, { status: 401 });
  }
}
