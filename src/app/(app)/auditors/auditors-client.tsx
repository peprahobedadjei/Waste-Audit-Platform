"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Download,
  Mail,
  Plus,
  Search,
  Trash2,
  Upload,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { AUDITOR_CSV_TEMPLATE } from "@/lib/csv";
import type { Auditor, AuditorStatus, District } from "@/lib/types";

type RowResult = {
  row: number;
  name: string;
  email: string;
  district: string;
  status: "ok" | "error";
  message?: string;
};

const STATUS_TONE: Record<AuditorStatus, "success" | "pending" | "neutral"> = {
  active: "success",
  invited: "pending",
  inactive: "neutral",
};

export function AuditorsClient({
  auditors,
  districts,
  canEdit = true,
}: {
  auditors: Auditor[];
  districts: District[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const districtNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of districts) map[d.id] = d.name;
    return map;
  }, [districts]);

  const counts = useMemo(
    () => ({
      total: auditors.length,
      active: auditors.filter((a) => a.status === "active").length,
      invited: auditors.filter((a) => a.status === "invited").length,
    }),
    [auditors],
  );

  const filtered = auditors.filter((auditor) => {
    if (districtFilter && auditor.districtId !== districtFilter) return false;
    if (statusFilter && auditor.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        auditor.name.toLowerCase().includes(q) ||
        auditor.email.toLowerCase().includes(q) ||
        auditor.phone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function resendInvite(auditor: Auditor) {
    setBusyId(auditor.id);
    setNotice(null);
    const response = await fetch(`/api/auditors/${auditor.id}/invite`, {
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? `Invite re-sent to ${auditor.email}.`
        : (body.error ?? "Could not send the invite."),
    );
    setBusyId(null);
    router.refresh();
  }

  async function removeAuditor(auditor: Auditor) {
    if (
      !window.confirm(
        `Remove ${auditor.name}? If they have submitted visits they will be deactivated instead, so their work stays attributable.`,
      )
    ) {
      return;
    }
    setBusyId(auditor.id);
    const response = await fetch(`/api/auditors/${auditor.id}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setNotice(
        body.deactivated
          ? `${auditor.name} has submitted visits, so they were deactivated rather than deleted.`
          : `${auditor.name} was removed.`,
      );
    }
    setBusyId(null);
    router.refresh();
  }

  function downloadTemplate() {
    const blob = new Blob([AUDITOR_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditors-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const noDistricts = districts.length === 0;

  return (
    <>
      {/* Onboarding tracker */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Auditors added" value={counts.total} />
        <StatTile label="Activated" value={counts.active} tone="success" />
        <StatTile label="Awaiting activation" value={counts.invited} tone="pending" />
      </div>

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{notice}</span>
        </div>
      )}

      {noDistricts && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-pending/30 bg-pending/5 px-4 py-3 text-sm text-pending">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Add at least one district before inviting auditors.</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Auditors"
          description={`${filtered.length} of ${auditors.length} shown`}
          action={
            canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCsvOpen(true)}
                  disabled={noDistricts}
                >
                  <Upload className="h-4 w-4" />
                  Bulk upload
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  disabled={noDistricts}
                >
                  <Plus className="h-4 w-4" />
                  Add auditor
                </Button>
              </div>
            ) : null
          }
        />

        {auditors.length > 0 && (
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
            <Input
              id="search"
              placeholder="Search name, email or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
            <Select
              id="district-filter"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        )}

        {auditors.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No auditors yet"
            description="Add them one at a time, or upload a CSV to invite the whole team at once."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" />
                  CSV template
                </Button>
                <Button onClick={() => setAddOpen(true)} disabled={noDistricts}>
                  <Plus className="h-4 w-4" />
                  Add auditor
                </Button>
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No auditors match those filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-medium text-ink-muted">Name</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Email</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">District</th>
                  <th className="px-5 py-3 font-medium text-ink-muted">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((auditor) => (
                  <tr key={auditor.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-ink">{auditor.name}</span>
                      {auditor.phone && (
                        <span className="block text-xs text-ink-muted">
                          {auditor.phone}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{auditor.email}</td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {districtNames[auditor.districtId] ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={STATUS_TONE[auditor.status]}>
                        {auditor.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        {auditor.status !== "active" && (
                          <button
                            onClick={() => resendInvite(auditor)}
                            disabled={busyId === auditor.id}
                            title="Resend invite"
                            aria-label={`Resend invite to ${auditor.name}`}
                            className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-50"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => removeAuditor(auditor)}
                          disabled={busyId === auditor.id}
                          title="Remove auditor"
                          aria-label={`Remove ${auditor.name}`}
                          className="rounded-lg p-2 text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        >
                          {auditor.status === "inactive" ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddAuditorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        districts={districts}
        onDone={(message) => {
          setNotice(message);
          router.refresh();
        }}
      />

      <CsvUploadModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onDownloadTemplate={downloadTemplate}
        onDone={(message) => {
          setNotice(message);
          router.refresh();
        }}
      />
    </>
  );
}

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "pending";
}) {
  const colour =
    tone === "success"
      ? "text-success"
      : tone === "pending"
        ? "text-pending"
        : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colour}`}>{value}</p>
    </div>
  );
}

function AddAuditorModal({
  open,
  onClose,
  districts,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  districts: District[];
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const response = await fetch("/api/auditors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, districtId }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error ?? "Could not add the auditor.");
      setSaving(false);
      return;
    }

    onDone(
      body.emailSent
        ? `${name} was added and their invite has been emailed.`
        : `${name} was added, but the invite email failed to send. Use the resend button to try again.`,
    );
    setName("");
    setPhone("");
    setEmail("");
    setDistrictId("");
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add auditor"
      description="They will receive an email with a single-use link to set their PIN."
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
          id="auditor-name"
          label="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="auditor-phone"
          label="Phone number"
          placeholder="+252 61 234 5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          id="auditor-email"
          type="email"
          label="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select
          id="auditor-district"
          label="District"
          required
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
        >
          <option value="">Select a district</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add and send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CsvUploadModal({
  open,
  onClose,
  onDownloadTemplate,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onDone: (message: string) => void;
}) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCsv(null);
    setFileName("");
    setResults(null);
    setSummary(null);
    setError(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResults(null);
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    setBusy(true);

    const response = await fetch("/api/auditors/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, mode: "validate" }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not read the file.");
      return;
    }
    setResults(body.results);
    setSummary(body.summary);
  }

  async function handleCommit() {
    if (!csv) return;
    setBusy(true);
    setError(null);

    const response = await fetch("/api/auditors/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, mode: "commit" }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not import the file.");
      return;
    }

    const { invited, emailFailures, invalid } = body.summary;
    let message = `${invited} auditor${invited === 1 ? "" : "s"} invited.`;
    if (emailFailures > 0) message += ` ${emailFailures} invite email(s) failed to send.`;
    if (invalid > 0) message += ` ${invalid} row(s) skipped.`;

    onDone(message);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Bulk upload auditors"
      description="Nothing is created until you review the preview and confirm."
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-ink">
            Required columns: <code className="text-xs">name, phone, email, district</code>
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            The district column must match a district name exactly.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={onDownloadTemplate}
          >
            <Download className="h-4 w-4" />
            Download template
          </Button>
        </div>

        <div>
          <label
            htmlFor="csv-file"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="w-full rounded-lg border border-line bg-white p-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
          {fileName && (
            <p className="mt-1.5 text-sm text-ink-muted">{fileName}</p>
          )}
        </div>

        {summary && (
          <div className="rounded-lg border border-line">
            <div className="flex flex-wrap gap-4 border-b border-line px-4 py-3 text-sm">
              <span className="text-ink">
                <strong>{summary.total}</strong> rows
              </span>
              <span className="text-success">
                <strong>{summary.valid}</strong> ready
              </span>
              {summary.invalid > 0 && (
                <span className="text-danger">
                  <strong>{summary.invalid}</strong> with problems
                </span>
              )}
            </div>

            {results && results.some((r) => r.status === "error") && (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {results
                      .filter((r) => r.status === "error")
                      .map((r) => (
                        <tr key={r.row} className="border-b border-line last:border-0">
                          <td className="px-4 py-2 text-ink-muted">Row {r.row}</td>
                          <td className="px-4 py-2 text-ink">{r.name || r.email || "—"}</td>
                          <td className="px-4 py-2 text-danger">{r.message}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCommit}
            loading={busy}
            disabled={!summary || summary.valid === 0}
          >
            {summary
              ? `Invite ${summary.valid} auditor${summary.valid === 1 ? "" : "s"}`
              : "Invite"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
