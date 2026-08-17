import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
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
