import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/mobile-auth";
import { endSession, startSession, touchSession } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by the app on sign-in, and again as a heartbeat while it is open.
 * The heartbeat is throttled server-side, so calling it often is cheap.
 */
export async function POST(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  let body: { event?: "login" | "heartbeat" };
  try {
    body = await request.json();
  } catch {
    body = { event: "heartbeat" };
  }

  try {
    if (body.event === "login") {
      await startSession({
        subjectId: auditor.uid,
        subjectType: "auditor",
        name: auditor.name,
        role: "auditor",
        userAgent: request.headers.get("user-agent"),
      });
    } else {
      await touchSession(auditor.uid);
    }
  } catch (err) {
    console.error("[mobile/session] presence write failed:", err);
  }

  return NextResponse.json({ ok: true });
}

/** Called on deliberate sign-out from the app. */
export async function DELETE(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  try {
    await endSession(auditor.uid);
  } catch (err) {
    console.error("[mobile/session] could not close session:", err);
  }

  return NextResponse.json({ ok: true });
}
