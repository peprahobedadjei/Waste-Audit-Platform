import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session";

// firebase-admin needs real Node APIs; it cannot run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    // A malformed service-account key surfaces here too, and it is not the
    // user's fault - separate it from a genuinely bad token so the deployment
    // problem is visible instead of looking like a failed sign-in.
    const message = err instanceof Error ? err.message : String(err);
    const isCredentialProblem =
      /private key|PEM|DECODER|invalid_grant|Failed to parse|credential/i.test(
        message,
      );

    console.error("[auth/session] token verification failed:", message);

    if (isCredentialProblem) {
      return NextResponse.json(
        {
          error:
            "The server's Firebase credentials are not valid. Check FIREBASE_PRIVATE_KEY.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Could not verify sign-in." },
      { status: 401 },
    );
  }

  try {
    // Only provisioned users may hold a dashboard session. There is no sign-up.
    const snap = await adminDb().collection("users").doc(uid).get();
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth/session] session creation failed:", message);

    if (/NOT_FOUND|database.*does not exist/i.test(message)) {
      return NextResponse.json(
        { error: "The Firestore database has not been created for this project." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Could not complete sign-in. Check the server logs." },
      { status: 500 },
    );
  }
}
