import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase-admin/firestore";

/*
  Server-only Firebase access.

  Every write in this system goes through the Admin SDK behind our own API
  routes - never straight from the browser or the Android app. That is what
  lets us compute the location-verification distance and the flag on the
  server, where a tampered client cannot reach them.

  Initialisation is lazy so the app still boots (login page, static pages)
  when credentials are not configured yet.
*/

let app: App | null = null;

function hasCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getAdminApp(): App {
  if (!hasCredentials()) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local",
    );
  }

  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Private keys carry literal \n when stored in an env var
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  return app;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

let firestore: Firestore | null = null;

export function adminDb(): Firestore {
  if (firestore) return firestore;

  const currentApp = getAdminApp();

  /*
    Force the REST transport instead of gRPC.

    firebase-admin defaults to gRPC, which keeps long-lived HTTP/2 connections
    open. That assumption does not hold in a serverless function that gets
    frozen and thawed between invocations - the connection dies with the
    container and the next call hangs or throws in a way that takes the whole
    function down rather than surfacing as a catchable error. REST is
    stateless, so each invocation stands on its own.
  */
  try {
    firestore = initializeFirestore(currentApp, { preferRest: true });
  } catch {
    // Already initialised on a warm container - reuse it
    firestore = getFirestore(currentApp);
  }

  return firestore;
}

export function isAdminConfigured(): boolean {
  return hasCredentials();
}
