"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: ReactNode;
};

export function Input({
  label,
  error,
  icon,
  className,
  id,
  type = "text",
  ...props
}: InputProps) {
  const [revealed, setRevealed] = useState(false);

  // Password fields get a reveal toggle automatically. Auditors are typing a
  // PIN one-handed in daylight, so being able to check what went in matters.
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={resolvedType}
          className={cn(
            "h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink",
            "placeholder:text-ink-muted",
            "focus:outline-2 focus:outline-offset-0 focus:outline-brand",
            icon && "pl-10",
            isPassword && "pr-11",
            error ? "border-danger" : "border-line",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            tabIndex={-1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
