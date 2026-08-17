import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export function Select({
  label,
  error,
  className,
  id,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink",
          "focus:outline-2 focus:outline-offset-0 focus:outline-brand",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
