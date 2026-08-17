import { notFound } from "next/navigation";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { canEditSystemConfig } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { DEFAULT_SETTINGS, type AuditSettings } from "@/lib/types";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

async function loadSettings(): Promise<AuditSettings> {
  if (!isAdminConfigured()) return DEFAULT_SETTINGS;

  const snap = await adminDb().collection("settings").doc("audit").get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AuditSettings>) };
}

export default async function SettingsPage() {
  // Settings change the flagging rules for every district, so they stay with
  // the system administrator regardless of what a sub-admin is assigned.
  const user = await getCurrentUser();
  if (!user || !canEditSystemConfig(user)) notFound();

  const settings = await loadSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Audit rules applied across all districts. Changes affect visits submitted from now on."
      />
      <SettingsClient initial={settings} />
    </div>
  );
}
