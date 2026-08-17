"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/*
  Browser-side Firebase - used ONLY for authentication (sign-in, password
  reset). It never reads or writes Firestore directly; all data access goes
  through our API routes using the Admin SDK.

  These values are public by design. They identify the project, they do not
  authorise anything.
*/
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const clientApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const clientAuth = getAuth(clientApp);
