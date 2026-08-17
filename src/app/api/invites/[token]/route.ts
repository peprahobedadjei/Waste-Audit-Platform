import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

type InviteDoc = {
  subjectId?: string;
  subjectType?: "auditor" | "manager";
  auditorId?: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

/**
 * Resolves an invite token to the account it belongs to. Handles both auditors
 * (mobile) and sub-admins (dashboard), which live in different collections.
 */
export async function loadInvite(token: string) {
  const db = adminDb();
  const snap = await db.collection("invites").doc(token).get();
  if (!snap.exists) return { error: "This invite link is not valid." } as const;

  const invite = snap.data() as InviteDoc;
  if (invite.revokedAt) {
    return { error: "This link was replaced by a newer invite." } as const;
  }
  if (invite.usedAt) {
    return { error: "This invite has already been used." } as const;
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return { error: "This invite has expired." } as const;
  }

  const subjectType = invite.subjectType ?? "auditor";
  const subjectId = invite.subjectId ?? invite.auditorId;
  if (!subjectId) return { error: "This invite is no longer valid." } as const;

  const collection = subjectType === "manager" ? "users" : "auditors";
  const account = await db.collection(collection).doc(subjectId).get();
  if (!account.exists) {
    return { error: "This invite is no longer valid." } as const;
  }

  return { invite, subjectId, subjectType, account } as const;
}

export async function GET(_request: Request, { params }: Params) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const result = await loadInvite(token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = result.account.data() as { name: string; districtId?: string };

  let districtName: string | null = null;
  if (result.subjectType === "auditor" && data.districtId) {
    const district = await adminDb()
      .collection("districts")
      .doc(data.districtId)
      .get();
    districtName = (district.data()?.name as string) ?? null;
  }

  return NextResponse.json({
    name: data.name,
    subjectType: result.subjectType,
    districtName,
  });
}

/** Consumes the invite and sets the chosen password or PIN. */
export async function POST(request: Request, { params }: Params) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const secret = body.pin?.trim();
  const result = await loadInvite(token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Sub-admins reach the full dashboard, so they get the longer minimum
  const minimum = result.subjectType === "manager" ? 8 : 6;
  if (!secret || secret.length < minimum) {
    return NextResponse.json(
      {
        error: `Your ${result.subjectType === "manager" ? "password" : "PIN"} must be at least ${minimum} characters.`,
      },
      { status: 400 },
    );
  }

  const db = adminDb();
  const now = new Date().toISOString();

  await adminAuth().updateUser(result.subjectId, {
    password: secret,
    emailVerified: true,
  });

  await db.collection("invites").doc(token).update({ usedAt: now });

  const collection = result.subjectType === "manager" ? "users" : "auditors";
  await db.collection(collection).doc(result.subjectId).update({
    status: "active",
    activatedAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true, subjectType: result.subjectType });
}
