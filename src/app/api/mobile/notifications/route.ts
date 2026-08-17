import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";

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

  let query = adminDb()
    .collection("notifications")
    .where("auditorId", "==", auditor.uid);

  if (unreadOnly) query = query.where("readAt", "==", null);

  const snap = await query.orderBy("createdAt", "desc").limit(limit).get();

  const notifications = snap.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    body: doc.data().body,
    readAt: doc.data().readAt,
    createdAt: doc.data().createdAt,
  }));

  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.readAt).length,
  });
}
