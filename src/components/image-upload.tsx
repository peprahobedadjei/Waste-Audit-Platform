"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Uploads straight to Cloudinary using a signature fetched from our API, so
 * the image bytes never pass through the app server and the API secret stays
 * on it.
 */
export function ImageUpload({
  kind,
  value,
  onChange,
  label,
  hint,
  rounded = false,
}: {
  kind: "avatar" | "logo";
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  hint?: string;
  rounded?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be under 5MB.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const signResponse = await fetch("/api/upload-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!signResponse.ok) {
        const body = await signResponse.json().catch(() => ({}));
        throw new Error(body.error ?? "Uploads are not available.");
      }
      const sign = await signResponse.json();

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);

      const upload = await fetch(sign.uploadUrl, {
        method: "POST",
        body: form,
      });
      if (!upload.ok) throw new Error("The upload was rejected.");

      const result = await upload.json();
      onChange(result.secure_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-line bg-surface",
            rounded ? "rounded-full" : "rounded-xl",
          )}
        >
          {value ? (
            <Image
              src={value}
              alt={label}
              width={80}
              height={80}
              className="h-20 w-20 object-cover"
              unoptimized
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-ink-muted" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {value ? "Replace" : "Upload"}
            </button>
            {value && !busy && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <X className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
          {hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
          {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
