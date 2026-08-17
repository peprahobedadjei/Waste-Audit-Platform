"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ChartColumn,
  Flag,
  Home,
  Shield,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  Recycle,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/session-shared";
import type { SessionUser } from "@/lib/session";
import type { Branding } from "@/lib/branding-types";

// adminOnly entries are hidden from sub-admins. The pages enforce this too -
// hiding a link is presentation, not access control.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/districts", label: "Districts", icon: Building2 },
  { href: "/auditors", label: "Auditors", icon: Users },
  { href: "/houses", label: "Houses", icon: Home },
  { href: "/visits", label: "Visits", icon: ChartColumn },
  { href: "/flagged", label: "Flagged queue", icon: Flag },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/managers", label: "Sub-admins", icon: Shield, adminOnly: true },
  { href: "/activity", label: "Activity", icon: Activity, adminOnly: true },
  { href: "/branding", label: "Branding", icon: Palette, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function AppShell({
  user,
  branding,
  children,
}: {
  user: SessionUser;
  branding: Branding;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const visibleNav = NAV.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {visibleNav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-tint text-brand-dark"
                : "text-ink-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const brandHeader = (
    <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
      {branding.logoUrl ? (
        <Image
          src={branding.logoUrl}
          alt={branding.appName}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
          <Recycle className="h-4.5 w-4.5" />
        </div>
      )}
      <span className="truncate text-sm font-semibold text-ink">
        {branding.appName}
      </span>
    </div>
  );

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const footer = (
    <div className="border-t border-line p-3">
      <Link
        href="/profile"
        onClick={() => setMobileOpen(false)}
        className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
            {initials || "?"}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">
            {user.name}
          </span>
          <span className="block truncate text-xs text-ink-muted">
            {roleLabel(user.role)}
          </span>
        </span>
      </Link>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-danger"
      >
        <LogOut className="h-4.5 w-4.5" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        {brandHeader}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white">
            {brandHeader}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="truncate text-sm font-semibold text-ink">
            {branding.appName}
          </span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
