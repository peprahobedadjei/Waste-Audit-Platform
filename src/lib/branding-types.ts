/*
  Branding shape and defaults.

  Kept separate from branding.ts because client components need the defaults as
  a real value, and branding.ts is marked "server-only" - importing it from the
  browser would drag firebase-admin into the client bundle.
*/

export type Branding = {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  hoverColor: string;
  darkColor: string;
  tintColor: string;
};

export const DEFAULT_BRANDING: Branding = {
  appName: "Waste Audit System",
  logoUrl: null,
  primaryColor: "#16a34a",
  hoverColor: "#15803d",
  darkColor: "#166534",
  tintColor: "#dcfce7",
};

export function brandingToCssVars(branding: Branding): string {
  return [
    `--brand-primary:${branding.primaryColor}`,
    `--brand-hover:${branding.hoverColor}`,
    `--brand-dark:${branding.darkColor}`,
    `--brand-tint:${branding.tintColor}`,
  ].join(";");
}
