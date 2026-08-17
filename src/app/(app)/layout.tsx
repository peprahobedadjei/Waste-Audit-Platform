import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getBranding } from "@/lib/branding";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real protection lives here - middleware only checks that a cookie exists.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const branding = await getBranding();

  return (
    <AppShell user={user} branding={branding}>
      {children}
    </AppShell>
  );
}
