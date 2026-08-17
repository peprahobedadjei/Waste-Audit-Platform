import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  const { id } = await params;
  const ref = adminDb().collection("notifications").doc(id);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.auditorId !== auditor.uid) {
    return NextResponse.json(
      { error: "Notification not found." },
      { status: 404 },
    );
  }

  if (!snap.data()?.readAt) {
    await ref.update({ readAt: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}
