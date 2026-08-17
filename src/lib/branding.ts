import "server-only";

import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { DEFAULT_BRANDING, type Branding } from "@/lib/branding-types";

/*
  White-label configuration. The admin can change the app name, logo and
  colours at runtime; the Android app reads the same values through the API,
  so a rebrand needs no code change and no app release.
*/

export { DEFAULT_BRANDING, brandingToCssVars } from "@/lib/branding-types";
export type { Branding } from "@/lib/branding-types";

export async function getBranding(): Promise<Branding> {
  if (!isAdminConfigured()) return DEFAULT_BRANDING;

  try {
    const snap = await adminDb().collection("settings").doc("branding").get();
    if (!snap.exists) return DEFAULT_BRANDING;
    return { ...DEFAULT_BRANDING, ...(snap.data() as Partial<Branding>) };
  } catch {
    // Never let a branding lookup take the whole app down
    return DEFAULT_BRANDING;
  }
}
