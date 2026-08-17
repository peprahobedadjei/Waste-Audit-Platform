import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Resolves a flagged visit.
 *
 * Nothing is ever deleted - a rejected visit stays on the record, marked, and
 * is excluded from the rates. A flag that could vanish without trace would
 * defeat the point of having one.
 */
export async function POST(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  let body: { decision?: "accepted" | "rejected"; reason?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const decision = body.decision;
  const reason = body.reason?.trim();

  if (decision !== "accepted" && decision !== "rejected") {
    return badRequest("Choose whether to accept or reject the visit.");
  }
  if (!reason) {
    return badRequest("A reason is required so the decision is auditable.");
  }

  try {
    const db = adminDb();
    const ref = db.collection("visits").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Visit not found." }, { status: 404 });
    }

    const now = new Date().toISOString();

    await ref.update({
      reviewStatus: decision,
      reviewedBy: user.uid,
      reviewReason: reason,
      reviewedAt: now,
    });

    await db.collection("auditLog").add({
      userId: user.uid,
      action: `visit.review.${decision}`,
      targetType: "visit",
      targetId: id,
      detail: { reason },
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not save the review.");
  }
}
