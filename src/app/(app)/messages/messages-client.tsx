"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Mail,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Auditor, District, Message } from "@/lib/types";

type AudienceType = "all" | "district" | "auditors";

export function MessagesClient({
  messages,
  districts,
  auditors,
}: {
  messages: Message[];
  districts: District[];
  auditors: Auditor[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;

  function describeAudience(message: Message) {
    if (message.audience.type === "all") return "All auditors";
    if (message.audience.type === "district") {
      return districtNames[message.audience.districtId] ?? "A district";
    }
    return `${message.audience.auditorIds.length} selected`;
  }

  return (
    <>
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{notice}</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Messages"
          description="Announcements and schedule notes delivered to the auditors' app."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Send className="h-4 w-4" />
              New message
            </Button>
          }
        />

        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title="No messages sent yet"
            description="Send a note to everyone, to one district, or to specific auditors. It appears in their app and can be emailed as well."
            action={
              <Button onClick={() => setOpen(true)}>
                <Send className="h-4 w-4" />
                Send the first message
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {messages.map((message) => (
              <li key={message.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{message.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
                      {message.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone="neutral">{describeAudience(message)}</Badge>
                    {message.alsoEmail && (
                      <Badge tone="success">
                        <Mail className="mr-1 inline h-3 w-3" />
                        Emailed
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {message.recipientCount} recipient
                  {message.recipientCount === 1 ? "" : "s"} ·{" "}
                  {new Date(message.createdAt).toLocaleString()} · {message.sentByName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ComposeModal
        open={open}
        onClose={() => setOpen(false)}
        districts={districts}
        auditors={auditors}
        onSent={(message) => {
          setNotice(message);
          router.refresh();
        }}
      />
    </>
  );
}

function ComposeModal({
  open,
  onClose,
  districts,
  auditors,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  districts: District[];
  auditors: Auditor[];
  onSent: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [districtId, setDistrictId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const reachable = auditors.filter((a) => a.status !== "inactive");

  const recipientCount =
    audienceType === "all"
      ? reachable.length
      : audienceType === "district"
        ? reachable.filter((a) => a.districtId === districtId).length
        : selected.length;

  function toggleAuditor(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((a) => a !== id)
        : [...current, id],
    );
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);

    const audience =
      audienceType === "all"
        ? { type: "all" as const }
        : audienceType === "district"
          ? { type: "district" as const, districtId }
          : { type: "auditors" as const, auditorIds: selected };

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, audience, alsoEmail }),
    });
    const result = await response.json().catch(() => ({}));
    setSending(false);

    if (!response.ok) {
      setError(result.error ?? "Could not send the message.");
      return;
    }

    let message = `Sent to ${result.recipientCount} auditor${result.recipientCount === 1 ? "" : "s"}.`;
    if (alsoEmail) {
      message += ` ${result.emailsSent} email${result.emailsSent === 1 ? "" : "s"} delivered`;
      if (result.emailsFailed > 0) message += `, ${result.emailsFailed} failed`;
      message += ".";
    }

    onSent(message);
    setTitle("");
    setBody("");
    setSelected([]);
    setAlsoEmail(false);
    setAudienceType("all");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      description="Delivered to the auditors' app. Nothing about flags or reviews is ever sent this way."
    >
      <form onSubmit={handleSend} className="space-y-4">
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
          id="message-title"
          label="Subject"
          placeholder="e.g. Sunday audit starts at 7am"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <label
            htmlFor="message-body"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Message
          </label>
          <textarea
            id="message-body"
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the announcement here."
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Send to</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All auditors"],
                ["district", "One district"],
                ["auditors", "Specific auditors"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudienceType(value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  audienceType === value
                    ? "border-transparent bg-brand text-white"
                    : "border-line bg-white text-ink-muted hover:bg-surface",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {audienceType === "district" && (
          <Select
            id="message-district"
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
        )}

        {audienceType === "auditors" && (
          <div className="max-h-52 overflow-y-auto rounded-lg border border-line">
            {reachable.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-muted">
                No auditors available.
              </p>
            ) : (
              reachable.map((auditor) => (
                <label
                  key={auditor.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(auditor.id)}
                    onChange={() => toggleAuditor(auditor.id)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {auditor.name}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {auditor.email}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}

        <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={alsoEmail}
            onChange={(e) => setAlsoEmail(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Email this as well
            </span>
            <span className="block text-sm text-ink-muted">
              For anything that has to land even if the auditor does not open the
              app.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Users className="h-4 w-4" />
            {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={sending} disabled={recipientCount === 0}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
