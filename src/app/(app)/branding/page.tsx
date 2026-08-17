import { getBranding } from "@/lib/branding";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/card";
import { BrandingClient } from "./branding-client";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const [branding, user] = await Promise.all([getBranding(), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Branding"
        description="Name, logo and colours for the dashboard, the auditors' app and outgoing email."
      />
      <BrandingClient initial={branding} canEdit={user?.role === "admin"} />
    </div>
  );
}
