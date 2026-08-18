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

  Barely cached, deliberately.

  This was originally cached for five minutes with an hour of
  stale-while-revalidate, which meant an administrator could change the brand
  and see nothing on the handsets for up to an hour - indistinguishable from
  broken. The payload is a few hundred bytes fetched a handful of times per
  device per day, so aggressive caching saves nothing worth that confusion.
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
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
