"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Mail,
  Shield,
  SlidersHorizontal,
  UserPlus,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { roleLabel } from "@/lib/session-shared";
import type { Auditor, District, ManagerAccount } from "@/lib/types";

export function ManagersClient({
  managers,
  districts,
  auditors,
}: {
  managers: ManagerAccount[];
  districts: District[];
  auditors: Auditor[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<ManagerAccount | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const subAdmins = managers.filter((m) => m.role !== "admin");
  const systemAdmin = managers.find((m) => m.role === "admin");

  // Which auditors are already spoken for, and by whom
  const ownership = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const manager of subAdmins) {
      for (const auditorId of manager.scope?.auditorIds ?? []) {
        map[auditorId] = { id: manager.id, name: manager.name };
      }
    }
    return map;
  }, [subAdmins]);

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;

  async function resendInvite(manager: ManagerAccount) {
    setBusyId(manager.id);
    const response = await fetch(`/api/managers/${manager.id}/invite`, {
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? `Invite re-sent to ${manager.email}.`
        : (body.error ?? "Could not send the invite."),
    );
    setBusyId(null);
    router.refresh();
  }

  async function deactivate(manager: ManagerAccount) {
    if (
      !window.confirm(
        `Deactivate ${manager.name}? They will be signed out immediately and lose all access. Their past reviews and messages stay on the record.`,
      )
    ) {
      return;
    }
    setBusyId(manager.id);
    const response = await fetch(`/api/managers/${manager.id}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok ? `${manager.name} was deactivated.` : (body.error ?? "Failed."),
    );
    setBusyId(null);
    router.refresh();
  }

  return (
    <>
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{notice}</span>
        </div>
      )}

      {systemAdmin && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
              <Shield className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{systemAdmin.name}</p>
              <p className="text-sm text-ink-muted">{systemAdmin.email}</p>
            </div>
            <Badge tone="success">{roleLabel("admin", "long")}</Badge>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Sub-administrators"
          description="Each sees only the districts and auditors assigned to them. Settings and Branding stay with you."
          action={
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite sub-admin
            </Button>
          }
        />

        {subAdmins.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-5 w-5" />}
            title="No sub-administrators yet"
            description="Invite someone to help manage districts. They set their own password from an emailed link, and start with no access until you assign them a scope."
            action={
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite the first sub-admin
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {subAdmins.map((manager) => {
              const scopedDistricts = manager.scope?.districtIds ?? [];
              const scopedAuditors = manager.scope?.auditorIds ?? [];
              const unassigned =
                scopedDistricts.length === 0 && scopedAuditors.length === 0;

              return (
                <li key={manager.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{manager.name}</p>
                      <p className="text-sm text-ink-muted">{manager.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          manager.status === "active"
                            ? "success"
                            : manager.status === "invited"
                              ? "pending"
                              : "neutral"
                        }
                      >
                        {manager.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setScopeFor(manager)}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Assign
                      </Button>
                      {manager.status !== "active" && (
                        <button
                          onClick={() => resendInvite(manager)}
                          disabled={busyId === manager.id}
                          aria-label={`Resend invite to ${manager.name}`}
                          title="Resend invite"
                          className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-50"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      {manager.status !== "inactive" && (
                        <button
                          onClick={() => deactivate(manager)}
                          disabled={busyId === manager.id}
                          aria-label={`Deactivate ${manager.name}`}
                          title="Deactivate"
                          className="rounded-lg p-2 text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    {unassigned ? (
                      <p className="inline-flex items-center gap-1.5 text-sm text-pending">
                        <AlertCircle className="h-4 w-4" />
                        Nothing assigned yet — they can see nothing until you
                        assign a district.
                      </p>
                    ) : (
                      <p className="text-sm text-ink-muted">
                        <span className="text-ink">
                          {scopedDistricts.length} district
                          {scopedDistricts.length === 1 ? "" : "s"}
                        </span>
                        {scopedDistricts.length > 0 && (
                          <>
                            {" "}
                            (
                            {scopedDistricts
                              .map((d) => districtNames[d] ?? "?")
                              .join(", ")}
                            )
                          </>
                        )}{" "}
                        ·{" "}
                        <span className="text-ink">
                          {scopedAuditors.length} auditor
                          {scopedAuditors.length === 1 ? "" : "s"}
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onDone={(message) => {
          setNotice(message);
          router.refresh();
        }}
      />

      {scopeFor && (
        <ScopeModal
          manager={scopeFor}
          districts={districts}
          auditors={auditors}
          ownership={ownership}
          onClose={() => setScopeFor(null)}
          onDone={(message) => {
            setNotice(message);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function InviteModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const response = await fetch("/api/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not send the invite.");
      return;
    }

    onDone(
      body.emailSent
        ? `${name} was invited. Assign their districts next — they can see nothing until you do.`
        : `${name} was created, but the invite email failed to send. Use the resend button.`,
    );
    setName("");
    setEmail("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite sub-administrator"
      description="They set their own password from an emailed link. They cannot reach Settings or Branding."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          id="manager-name"
          label="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="manager-email"
          type="email"
          label="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ScopeModal({
  manager,
  districts,
  auditors,
  ownership,
  onClose,
  onDone,
}: {
  manager: ManagerAccount;
  districts: District[];
  auditors: Auditor[];
  ownership: Record<string, { id: string; name: string }>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [districtIds, setDistrictIds] = useState<string[]>(
    manager.scope?.districtIds ?? [],
  );
  const [auditorIds, setAuditorIds] = useState<string[]>(
    manager.scope?.auditorIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleDistrict(id: string) {
    setDistrictIds((current) => {
      if (current.includes(id)) {
        // Dropping a district drops its auditors too - an auditor cannot be
        // assigned without the district they work in
        setAuditorIds((a) =>
          a.filter(
            (auditorId) =>
              auditors.find((x) => x.id === auditorId)?.districtId !== id,
          ),
        );
        return current.filter((d) => d !== id);
      }
      return [...current, id];
    });
  }

  function toggleAuditor(id: string) {
    setAuditorIds((current) =>
      current.includes(id)
        ? current.filter((a) => a !== id)
        : [...current, id],
    );
  }

  async function handleSave() {
    setError(null);
    setBusy(true);

    const response = await fetch(`/api/managers/${manager.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: { districtIds, auditorIds } }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not save the assignment.");
      return;
    }

    onDone(
      `${manager.name} now manages ${auditorIds.length} auditor${auditorIds.length === 1 ? "" : "s"} across ${districtIds.length} district${districtIds.length === 1 ? "" : "s"}.`,
    );
    onClose();
  }

  const selectedDistricts = districts.filter((d) => districtIds.includes(d.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign ${manager.name}`}
      description="Pick districts first, then choose which auditors within them they manage."
    >
      <div className="space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Districts</p>
          {districts.length === 0 ? (
            <p className="text-sm text-ink-muted">No districts exist yet.</p>
          ) : (
            <div className="space-y-1.5">
              {districts.map((district) => (
                <label
                  key={district.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={districtIds.includes(district.id)}
                    onChange={() => toggleDistrict(district.id)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  <span className="text-sm text-ink">{district.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {selectedDistricts.map((district) => {
          const inDistrict = auditors.filter(
            (a) => a.districtId === district.id && a.status !== "inactive",
          );
          const selectedHere = inDistrict.filter((a) =>
            auditorIds.includes(a.id),
          ).length;

          return (
            <div key={district.id}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-ink">
                  Auditors in {district.name}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const available = inDistrict.filter(
                      (a) =>
                        !ownership[a.id] || ownership[a.id].id === manager.id,
                    );
                    const allSelected = available.every((a) =>
                      auditorIds.includes(a.id),
                    );
                    setAuditorIds((current) =>
                      allSelected
                        ? current.filter(
                            (id) => !available.some((a) => a.id === id),
                          )
                        : [
                            ...new Set([
                              ...current,
                              ...available.map((a) => a.id),
                            ]),
                          ],
                    );
                  }}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Select all available
                </button>
              </div>

              {inDistrict.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No active auditors in this district yet.
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {inDistrict.map((auditor) => {
                    const owner = ownership[auditor.id];
                    const takenByOther = owner && owner.id !== manager.id;

                    return (
                      <label
                        key={auditor.id}
                        className={
                          takenByOther
                            ? "flex cursor-not-allowed items-center gap-3 rounded-lg border border-line px-3 py-2.5 opacity-60"
                            : "flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface"
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={Boolean(takenByOther)}
                          checked={auditorIds.includes(auditor.id)}
                          onChange={() => toggleAuditor(auditor.id)}
                          className="h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">
                            {auditor.name}
                          </span>
                          {takenByOther && (
                            <span className="block truncate text-xs text-pending">
                              Already managed by {owner.name}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <p className="mt-1.5 text-xs text-ink-muted">
                {selectedHere} of {inDistrict.length} selected
              </p>
            </div>
          );
        })}

        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink-muted">
          An auditor answers to one sub-admin only. Anyone already managed
          elsewhere is shown but cannot be selected.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={handleSave}>
            Save assignment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
