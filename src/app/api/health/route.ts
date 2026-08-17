import { NextResponse } from "next/server";

/*
  Deployment diagnostics.

  Deliberately imports nothing at module scope. If a dependency fails to load
  in the serverless bundle - which is exactly the failure we are chasing - a
  top-level import would take this route down with it and produce the same
  opaque 500 it is meant to explain. Everything is loaded lazily inside
  try/catch so the response always arrives.

  Reports only whether configuration is present and working, never a value and
  never a fragment of a key.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail?: string };

function describe(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`.slice(0, 400);
  }
  return String(err).slice(0, 400);
}

export async function GET() {
  const checks: Record<string, Check> = {};

  const env = {
    FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    CLOUDINARY_CLOUD_NAME: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    CLOUDINARY_API_KEY: Boolean(process.env.CLOUDINARY_API_KEY),
    CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET),
    SMTP_USER: Boolean(process.env.SMTP_USER),
    SMTP_APP_PASSWORD: Boolean(process.env.SMTP_APP_PASSWORD),
  };

  // A private key pasted with its surrounding quotes still attached is the most
  // common deployment mistake, and it fails in a way that looks like a bad
  // password. Check the shape without revealing the contents.
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const privateKey = {
    present: rawKey.length > 0,
    length: rawKey.length,
    wrappedInQuotes: rawKey.startsWith('"') || rawKey.startsWith("'"),
    hasPemHeader: rawKey.includes("BEGIN PRIVATE KEY"),
    hasEscapedNewlines: rawKey.includes("\\n"),
    hasRealNewlines: rawKey.includes("\n"),
  };

  const node = {
    version: process.version,
    platform: process.platform,
  };

  // 1. Can firebase-admin even be loaded in this bundle?
  let firebaseAdmin: typeof import("firebase-admin/app") | null = null;
  try {
    firebaseAdmin = await import("firebase-admin/app");
    checks.loadFirebaseAdmin = { ok: true };
  } catch (err) {
    checks.loadFirebaseAdmin = {
      ok: false,
      detail: `firebase-admin failed to load: ${describe(err)}`,
    };
  }

  // 2. Do the credentials parse into a usable app?
  let app: unknown = null;
  if (firebaseAdmin && privateKey.present && env.FIREBASE_CLIENT_EMAIL) {
    try {
      const { cert, getApps, initializeApp } = firebaseAdmin;
      app =
        getApps().length > 0
          ? getApps()[0]
          : initializeApp({
              credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: rawKey.replace(/\\n/g, "\n"),
              }),
            });
      checks.credentials = { ok: true };
    } catch (err) {
      checks.credentials = {
        ok: false,
        detail: `Credentials rejected: ${describe(err)}`,
      };
    }
  } else if (firebaseAdmin) {
    checks.credentials = {
      ok: false,
      detail: "Admin credentials are missing from the environment.",
    };
  }

  // 3. Is Firebase Authentication enabled on the project?
  if (app) {
    try {
      const { getAuth } = await import("firebase-admin/auth");
      await getAuth().listUsers(1);
      checks.firebaseAuth = { ok: true };
    } catch (err) {
      const message = describe(err);
      checks.firebaseAuth = {
        ok: false,
        detail: /CONFIGURATION_NOT_FOUND/i.test(message)
          ? "Authentication is not enabled for this Firebase project. Enable Email/Password in the console."
          : message,
      };
    }

    // 4. Does the Firestore database exist?
    try {
      const { getFirestore } = await import("firebase-admin/firestore");
      await getFirestore().collection("settings").doc("branding").get();
      checks.firestore = { ok: true };
    } catch (err) {
      const message = describe(err);
      checks.firestore = {
        ok: false,
        detail: /NOT_FOUND/i.test(message)
          ? "The Firestore database has not been created for this project."
          : message,
      };
    }
  }

  // 5. Optional integrations - never fatal for login
  try {
    await import("nodemailer");
    checks.loadNodemailer = { ok: true };
  } catch (err) {
    checks.loadNodemailer = {
      ok: false,
      detail: `nodemailer failed to load: ${describe(err)}`,
    };
  }

  const healthy = Object.values(checks).every((c) => c.ok);

  // Always 200 so the body is readable in a browser even when unhealthy
  return NextResponse.json({ healthy, node, env, privateKey, checks });
}
