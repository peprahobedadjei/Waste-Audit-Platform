/*
  Runtime-agnostic session constants.

  Kept separate from session.ts because middleware runs on the edge runtime and
  cannot import firebase-admin or anything marked "server-only".
*/
export const SESSION_COOKIE = "wa_session";
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export type Role = "admin" | "manager";
