import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const snap = await adminDb()
      .collection("alerts")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({
      alerts,
      unread: alerts.filter((a) => !(a as { readAt?: string }).readAt).length,
    });
  } catch {
    return serverError("Could not load alerts.");
  }
}

/** Marks one alert read, or all of them when no id is given. */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const db = adminDb();
    const now = new Date().toISOString();

    if (body.id) {
      const ref = db.collection("alerts").doc(body.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.userId !== user.uid) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      await ref.update({ readAt: now });
      return NextResponse.json({ ok: true });
    }

    const unread = await db
      .collection("alerts")
      .where("userId", "==", user.uid)
      .where("readAt", "==", null)
      .get();

    const batch = db.batch();
    for (const doc of unread.docs) batch.update(doc.ref, { readAt: now });
    await batch.commit();

    return NextResponse.json({ ok: true, marked: unread.size });
  } catch {
    return serverError("Could not update alerts.");
  }
}
