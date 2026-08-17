import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover focus-visible:outline-brand disabled:bg-brand/50",
  secondary:
    "bg-white text-ink border border-line hover:bg-surface focus-visible:outline-brand",
  danger:
    "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger disabled:bg-danger/50",
  ghost: "bg-transparent text-ink-muted hover:bg-surface hover:text-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
