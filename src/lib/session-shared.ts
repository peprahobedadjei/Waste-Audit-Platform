/*
  Runtime-agnostic session constants.

  Kept separate from session.ts because middleware runs on the edge runtime and
  cannot import firebase-admin or anything marked "server-only".
*/
export const SESSION_COOKIE = "wa_session";
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export type Role = "admin" | "manager";

/*
  What each role is called on screen.

  The stored value stays "manager" - it is already written into Firestore
  documents, Firebase custom claims and every audit-log entry, and renaming it
  would be a migration that buys nothing. Only the label changes, and it lives
  here so the sidebar, the profile page and the activity log cannot drift apart.
*/
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Sub-admin",
  auditor: "Auditor",
};

const ROLE_LABELS_LONG: Record<string, string> = {
  admin: "System administrator",
  manager: "Sub-administrator",
  auditor: "Auditor",
};

export function roleLabel(role: string, variant: "short" | "long" = "short") {
  const table = variant === "long" ? ROLE_LABELS_LONG : ROLE_LABELS;
  return table[role] ?? role;
}
