import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { isEmailConfigured } from "@/lib/email";

/*
  Deployment diagnostics.

  Reports only whether each piece of configuration is present and working -
  never a value, never a fragment of a key. Safe to hit from a browser on a
  live deployment, which is the point: it answers "why is login returning 500"
  without needing access to the runtime logs.
*/
export async function GET() {
  const env = {
    FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    CLOUDINARY: isCloudinaryConfigured(),
    SMTP: isEmailConfigured(),
  };

  // A private key pasted with its surrounding quotes still left on is the most
  // common deployment mistake, and it fails in a way that looks like a bad
  // password. Check the shape without revealing the contents.
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const privateKey = {
    present: rawKey.length > 0,
    wrappedInQuotes: rawKey.startsWith('"') || rawKey.startsWith("'"),
    hasPemHeader: rawKey.includes("BEGIN PRIVATE KEY"),
    hasEscapedNewlines: rawKey.includes("\\n"),
    hasRealNewlines: rawKey.includes("\n"),
  };

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  if (!isAdminConfigured()) {
    checks.firebaseAdmin = {
      ok: false,
      detail: "Admin credentials are missing from the environment.",
    };
  } else {
    try {
      // Cheapest call that forces credential parsing and a real API round-trip
      await adminAuth().listUsers(1);
      checks.firebaseAuth = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.firebaseAuth = {
        ok: false,
        detail: /CONFIGURATION_NOT_FOUND/i.test(message)
          ? "Authentication is not enabled for this Firebase project."
          : message.slice(0, 300),
      };
    }

    try {
      await adminDb().collection("settings").doc("branding").get();
      checks.firestore = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.firestore = {
        ok: false,
        detail: /NOT_FOUND/i.test(message)
          ? "The Firestore database has not been created for this project."
          : message.slice(0, 300),
      };
    }
  }

  const healthy = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { healthy, env, privateKey, checks },
    { status: healthy ? 200 : 503 },
  );
}
