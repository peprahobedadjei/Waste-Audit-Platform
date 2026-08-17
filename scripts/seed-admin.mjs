/**
 * Creates the default administrator account.
 *
 *   node --env-file=.env.local scripts/seed-admin.mjs
 *
 * Safe to re-run: if the account already exists it is left alone and only the
 * Firestore user document is reconciled. There is no sign-up flow in the app,
 * so this script is the only way the first account comes into existence.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  SEED_ADMIN_EMAIL = "admin@gmail.com",
  SEED_ADMIN_PASSWORD = "admin123",
  SEED_ADMIN_NAME = "System Administrator",
} = process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error(
    "\nMissing Firebase Admin credentials.\n" +
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY " +
      "in .env.local from your service account JSON, then run this again.\n",
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

/** Turns Firebase's provisioning errors into something actionable. */
function explain(err) {
  const code = err?.code ?? "";
  const message = String(err?.message ?? err);

  if (code === "auth/configuration-not-found" || message.includes("CONFIGURATION_NOT_FOUND")) {
    return [
      "Firebase Authentication is not enabled on this project.",
      "",
      "Fix it in the Firebase console:",
      `  1. Open https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication`,
      "  2. Click 'Get started'",
      "  3. Sign-in method > enable 'Email/Password' > Save",
      "",
      "Then run this again.",
    ].join("\n");
  }

  if (code === 5 || code === "NOT_FOUND" || message.includes("NOT_FOUND")) {
    return [
      "The Firestore database has not been created for this project.",
      "",
      "Fix it in the Firebase console:",
      `  1. Open https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore`,
      "  2. Click 'Create database' > Production mode",
      "  3. Choose a region (this cannot be changed later)",
      "",
      "Then run this again.",
    ].join("\n");
  }

  if (code === "auth/invalid-credential" || message.includes("invalid_grant")) {
    return [
      "The service account credentials were rejected.",
      "",
      "Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.",
      "The private key must be wrapped in double quotes and keep its literal \\n sequences.",
    ].join("\n");
  }

  return message;
}

function fail(err) {
  console.error(`\n${explain(err)}\n`);
  process.exit(1);
}

let user;
try {
  user = await auth.getUserByEmail(SEED_ADMIN_EMAIL);
  console.log(`Auth user already exists: ${SEED_ADMIN_EMAIL}`);
} catch (lookupError) {
  // A genuine "no such user" is expected on first run; anything else is a
  // provisioning problem and should not be swallowed by the create attempt.
  if (lookupError?.code && lookupError.code !== "auth/user-not-found") {
    fail(lookupError);
  }
  try {
    user = await auth.createUser({
      email: SEED_ADMIN_EMAIL,
      password: SEED_ADMIN_PASSWORD,
      displayName: SEED_ADMIN_NAME,
      emailVerified: true,
    });
    console.log(`Created auth user: ${SEED_ADMIN_EMAIL}`);
  } catch (createError) {
    fail(createError);
  }
}

try {
  await auth.setCustomUserClaims(user.uid, { role: "admin" });

  await db.collection("users").doc(user.uid).set(
    {
      email: SEED_ADMIN_EMAIL,
      name: SEED_ADMIN_NAME,
      role: "admin",
      seeded: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
} catch (writeError) {
  fail(writeError);
}

console.log(`\nAdministrator ready.\n  email:    ${SEED_ADMIN_EMAIL}\n  password: ${SEED_ADMIN_PASSWORD}\n\nChange this password after first sign-in.\n`);
process.exit(0);
