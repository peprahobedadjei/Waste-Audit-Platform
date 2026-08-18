"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Flag, TriangleAlert } from "lucide-react";

type Alert = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 60_000;

export function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const response = await fetch("/api/alerts");
      if (!response.ok) return;
      const body = await response.json();
      setAlerts(body.alerts ?? []);
      setUnread(body.unread ?? 0);
    } catch {
      // Offline or signed out - leave the last known state alone
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnread(0);
    setAlerts((current) =>
      current.map((a) => ({ ...a, readAt: a.readAt ?? new Date().toISOString() })),
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Alerts${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Alerts</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-brand hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Nothing to report.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {alerts.map((alert) => {
                const Icon = alert.kind === "flagged_visit" ? Flag : TriangleAlert;
                const inner = (
                  <div className="flex items-start gap-2.5 px-4 py-3 hover:bg-surface">
                    <Icon
                      className={
                        alert.readAt
                          ? "mt-0.5 h-4 w-4 shrink-0 text-ink-muted"
                          : "mt-0.5 h-4 w-4 shrink-0 text-danger"
                      }
                    />
                    <div className="min-w-0">
                      <p
                        className={
                          alert.readAt
                            ? "text-sm text-ink-muted"
                            : "text-sm font-medium text-ink"
                        }
                      >
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{alert.body}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={alert.id}>
                    {alert.link ? (
                      <Link href={alert.link} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
