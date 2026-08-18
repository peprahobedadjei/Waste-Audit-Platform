import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  Branding, without authentication.

  The mobile app's sign-in screen has to be branded before anyone has signed
  in, so this cannot sit behind a token. Nothing here is sensitive - it is the
  app's name, its logo and four hex colours, all of which are visible to anyone
  who opens the app anyway.

  Cached at the edge for a few minutes so a rebrand propagates quickly without
  every app launch hitting Firestore.
*/
export async function GET() {
  const branding = await getBranding();

  return NextResponse.json(
    {
      appName: branding.appName,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      hoverColor: branding.hoverColor,
      darkColor: branding.darkColor,
      tintColor: branding.tintColor,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
