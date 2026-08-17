import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";

type Params = { params: Promise<{ token: string }> };

type InviteDoc = {
  auditorId: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

async function loadInvite(token: string) {
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

  const auditor = await db.collection("auditors").doc(invite.auditorId).get();
  if (!auditor.exists) {
    return { error: "This invite is no longer valid." } as const;
  }

  return { invite, auditor } as const;
}

/** Validates a token so the accept page can show who it belongs to. */
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

  const data = result.auditor.data() as { name: string; districtId: string };
  const district = await adminDb()
    .collection("districts")
    .doc(data.districtId)
    .get();

  return NextResponse.json({
    name: data.name,
    districtName: district.data()?.name ?? null,
  });
}

/** Consumes the invite and sets the auditor's chosen PIN. */
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

  const pin = body.pin?.trim();
  if (!pin || pin.length < 6) {
    return NextResponse.json(
      { error: "Your PIN must be at least 6 characters." },
      { status: 400 },
    );
  }

  const result = await loadInvite(token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date().toISOString();
  const auditorId = result.invite.auditorId;

  await adminAuth().updateUser(auditorId, {
    password: pin,
    emailVerified: true,
  });

  await db.collection("invites").doc(token).update({ usedAt: now });
  await db.collection("auditors").doc(auditorId).update({
    status: "active",
    activatedAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true });
}
