import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuditor } from "@/lib/mobile-auth";
import { getBranding } from "@/lib/branding";
import { loadSettings } from "@/lib/visits";
import { currentCycleId } from "@/lib/cycles";

/**
 * Everything the app needs on launch: who the auditor is, the rules that govern
 * submission, and the branding to theme itself with. One call, so the app can
 * cache it and work offline afterwards.
 */
export async function GET(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  const db = adminDb();
  const [districtSnap, settings, branding] = await Promise.all([
    db.collection("districts").doc(auditor.districtId).get(),
    loadSettings(),
    getBranding(),
  ]);

  const cycleId = currentCycleId(settings.collectionDays);

  const [houseCount, unread] = await Promise.all([
    db
      .collection("houses")
      .where("districtId", "==", auditor.districtId)
      .where("registeredBy", "==", auditor.uid)
      .count()
      .get(),
    db
      .collection("notifications")
      .where("auditorId", "==", auditor.uid)
      .where("readAt", "==", null)
      .count()
      .get(),
  ]);

  return NextResponse.json({
    auditor: {
      id: auditor.uid,
      name: auditor.name,
      email: auditor.email,
      phone: auditor.phone,
      status: auditor.status,
    },
    district: {
      id: auditor.districtId,
      name: districtSnap.data()?.name ?? null,
      centerLat: districtSnap.data()?.centerLat ?? null,
      centerLng: districtSnap.data()?.centerLng ?? null,
    },
    settings: {
      toleranceMeters: settings.toleranceMeters,
      minGpsAccuracy: settings.minGpsAccuracy,
      accuracyOverrideSeconds: settings.accuracyOverrideSeconds,
      collectionDays: settings.collectionDays,
      auditDays: settings.auditDays,
    },
    branding: {
      appName: branding.appName,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
    },
    currentCycleId: cycleId,
    housesRegistered: houseCount.data().count,
    unreadNotifications: unread.data().count,
  });
}
