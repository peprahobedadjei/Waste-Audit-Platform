import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireAdmin, requireUser, serverError } from "@/lib/api-auth";
import { DEFAULT_BRANDING, getBranding, type Branding } from "@/lib/branding";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  return NextResponse.json({ branding: await getBranding() });
}

/** Branding is admin-only - it changes what every user and every device sees. */
export async function PUT(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  let body: Partial<Branding>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const branding: Branding = { ...DEFAULT_BRANDING, ...body };

  const appName = branding.appName?.trim();
  if (!appName) return badRequest("The app name is required.");
  if (appName.length > 40) return badRequest("The app name is too long.");
  branding.appName = appName;

  for (const [field, value] of [
    ["primary colour", branding.primaryColor],
    ["hover colour", branding.hoverColor],
    ["dark colour", branding.darkColor],
    ["tint colour", branding.tintColor],
  ] as const) {
    if (!HEX.test(value)) {
      return badRequest(`The ${field} must be a hex value such as #16a34a.`);
    }
  }

  if (branding.logoUrl && !/^https:\/\//.test(branding.logoUrl)) {
    return badRequest("The logo must be an uploaded image.");
  }

  try {
    const db = adminDb();
    const now = new Date().toISOString();

    await db
      .collection("settings")
      .doc("branding")
      .set({ ...branding, updatedAt: now, updatedBy: user.uid }, { merge: true });

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "branding.update",
      targetType: "settings",
      targetId: "branding",
      detail: branding,
      createdAt: now,
    });

    return NextResponse.json({ ok: true, branding });
  } catch {
    return serverError("Could not save the branding.");
  }
}
