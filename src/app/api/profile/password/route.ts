import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";

/**
 * Changes the signed-in user's password.
 *
 * The current password is re-checked against Firebase's REST sign-in endpoint
 * first. A valid session alone is not enough - an unattended browser should not
 * be all it takes to lock the real owner out of the administrator account.
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (!currentPassword) return badRequest("Enter your current password.");
  if (newPassword.length < 8) {
    return badRequest("Your new password must be at least 8 characters.");
  }
  if (newPassword === currentPassword) {
    return badRequest("The new password must be different from the current one.");
  }

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

    await adminAuth().updateUser(user.uid, { password: newPassword });

    // Force other devices to sign in again with the new password
    await adminAuth().revokeRefreshTokens(user.uid);

    await adminDb().collection("auditLog").add({
      userId: user.uid,
      action: "profile.password_change",
      targetType: "user",
      targetId: user.uid,
      detail: {},
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not change your password.");
  }
}
