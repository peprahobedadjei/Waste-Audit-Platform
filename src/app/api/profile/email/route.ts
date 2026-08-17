import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";
import { sendEmailChangeConfirmation } from "@/lib/email";
import { getBranding } from "@/lib/branding";

const TTL_HOURS = 24;

/**
 * Starts an email change. Nothing moves until the owner of the NEW address
 * clicks the confirmation link, so a mistyped address cannot lock anyone out.
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { newEmail?: string; currentPassword?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const newEmail = body.newEmail?.trim().toLowerCase();
  const currentPassword = body.currentPassword ?? "";

  if (!newEmail) return badRequest("Enter the new email address.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return badRequest("That email address is not valid.");
  }
  if (newEmail === user.email.toLowerCase()) {
    return badRequest("That is already your email address.");
  }
  if (!currentPassword) return badRequest("Enter your current password.");

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return serverError("Authentication is not configured.");

  try {
    const verify = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: currentPassword,
          returnSecureToken: false,
        }),
      },
    );
    if (!verify.ok) {
      return NextResponse.json(
        { error: "Your current password is not correct." },
        { status: 400 },
      );
    }

    // Refuse if the address is already in use by anyone
    try {
      await adminAuth().getUserByEmail(newEmail);
      return badRequest("That email address is already in use.");
    } catch {
      // Not found is what we want
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    await adminDb()
      .collection("users")
      .doc(user.uid)
      .update({
        emailChangePending: { newEmail, token, expiresAt },
        updatedAt: new Date().toISOString(),
      });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const branding = await getBranding();

    await sendEmailChangeConfirmation({
      to: newEmail,
      name: user.name,
      confirmUrl: `${base}/confirm-email/${token}`,
      appName: branding.appName,
    });

    return NextResponse.json({ ok: true, newEmail });
  } catch {
    return serverError("Could not start the email change.");
  }
}

/** Cancels a pending email change. */
export async function DELETE() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await adminDb().collection("users").doc(user.uid).update({
      emailChangePending: null,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not cancel the email change.");
  }
}
