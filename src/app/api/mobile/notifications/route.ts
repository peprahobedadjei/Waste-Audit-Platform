import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";
import { firestoreError } from "@/lib/firestore-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Messages sent to this auditor by a manager.
 *
 * Schedule notes, announcements and direct messages only. Nothing about flags
 * or review outcomes is ever delivered here - that would undo the silence the
 * submission flow depends on.
 */
export async function GET(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const unreadOnly = url.searchParams.get("unread") === "true";

  try {
    let query = adminDb()
      .collection("notifications")
      .where("auditorId", "==", auditor.uid);

    if (unreadOnly) query = query.where("readAt", "==", null);

    const snap = await query.orderBy("createdAt", "desc").limit(limit).get();

    const notifications = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        body: data.body,
        // Older records predate the sender being stored, so fall back rather
        // than showing a blank name
        sentByName: (data.sentByName as string | undefined) ?? "Your manager",
        sentByRole: (data.sentByRole as string | undefined) ?? "manager",
        readAt: data.readAt,
        createdAt: data.createdAt,
      };
    });

    return NextResponse.json({
      notifications,
      unread: notifications.filter((n) => !n.readAt).length,
    });
  } catch (err) {
    return firestoreError(err, "Could not load your messages.");
  }
}
