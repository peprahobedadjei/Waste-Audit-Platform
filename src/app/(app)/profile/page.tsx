import { redirect } from "next/navigation";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/card";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let pendingEmail: { newEmail: string; expiresAt: string } | null = null;

  if (isAdminConfigured()) {
    const snap = await adminDb().collection("users").doc(user.uid).get();
    const pending = snap.data()?.emailChangePending as
      | { newEmail: string; expiresAt: string }
      | null
      | undefined;
    if (pending && new Date(pending.expiresAt) > new Date()) {
      pendingEmail = pending;
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Your profile"
        description="Your name, photo and sign-in details."
      />
      <ProfileClient user={user} pendingEmail={pendingEmail} />
    </div>
  );
}
