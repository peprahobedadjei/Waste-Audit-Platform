import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { endSession } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Close the activity-log entry before the cookie goes, while we can still
  // identify who is signing out.
  try {
    const user = await getCurrentUser();
    if (user) await endSession(user.uid);
  } catch (err) {
    console.error("[auth/logout] could not close session record:", err);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
