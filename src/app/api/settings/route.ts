import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireAdmin, requireUser, serverError } from "@/lib/api-auth";
import { DEFAULT_SETTINGS, type AuditSettings } from "@/lib/types";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const snap = await adminDb().collection("settings").doc("audit").get();
    const settings: AuditSettings = snap.exists
      ? { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AuditSettings>) }
      : DEFAULT_SETTINGS;
    return NextResponse.json({ settings, configured: snap.exists });
  } catch {
    return serverError("Could not load settings.");
  }
}

export async function PUT(request: Request) {
  // Admin only - these thresholds govern flagging across every district
  const { user, error } = await requireAdmin();
  if (error) return error;

  let body: Partial<AuditSettings>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const settings: AuditSettings = { ...DEFAULT_SETTINGS, ...body };

  if (settings.toleranceMeters < 5 || settings.toleranceMeters > 1000) {
    return badRequest("Distance tolerance must be between 5m and 1000m.");
  }
  if (settings.minGpsAccuracy < 5 || settings.minGpsAccuracy > 200) {
    return badRequest("Minimum GPS accuracy must be between 5m and 200m.");
  }
  if (settings.minGpsAccuracy >= settings.toleranceMeters) {
    return badRequest(
      "GPS accuracy threshold must be tighter than the distance tolerance, " +
        "otherwise normal drift alone can trip a flag.",
    );
  }

  const weights = settings.cleanlinessWeights;
  const total = weights.collection + weights.cleanliness + weights.satisfaction;
  if (total !== 100) {
    return badRequest(`Cleanliness weights must total 100% (currently ${total}%).`);
  }

  if (settings.collectionDays.length === 0) {
    return badRequest("Select at least one collection day.");
  }
  if (settings.auditDays.length === 0) {
    return badRequest("Select at least one audit day.");
  }

  try {
    const db = adminDb();
    const now = new Date().toISOString();

    await db
      .collection("settings")
      .doc("audit")
      .set({ ...settings, updatedAt: now, updatedBy: user.uid }, { merge: true });

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "settings.update",
      targetType: "settings",
      targetId: "audit",
      detail: settings,
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not save settings.");
  }
}
