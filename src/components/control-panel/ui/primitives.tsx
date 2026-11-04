import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { Radio } from "lucide-react";
import { cn } from "../../../utils/cn";

/** Shared UI primitives for the operator screens. design.md describes the system they implement. */

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative bg-canvas border border-line rounded-sm p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 mb-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionLabel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-xs text-muted", className)} {...rest}>
      {children}
    </div>
  );
}

/** Icon plus app name. Inherits its colour, so it works on black and on white. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <Radio size={20} aria-hidden="true" className="shrink-0" />
      <span>Hockey Scoreboard</span>
    </span>
  );
}

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-action hover:bg-action-hover text-canvas border border-action hover:border-action-hover",
  secondary: "bg-canvas hover:bg-surface text-ink border border-line",
  destructive: "bg-danger hover:bg-danger-hover text-canvas border border-danger hover:border-danger-hover",
  ghost: "bg-transparent hover:bg-surface text-ink border border-transparent",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "secondary", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold",
        "transition-colors duration-150 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        buttonVariants[variant],
        "disabled:bg-surface disabled:text-muted disabled:border-line disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    />
  );
}

/** Shared class strings for plain (non-<Button>) inputs/selects, kept as constants so every panel stays consistent. */
export const inputClass =
  "bg-canvas text-ink rounded-sm px-3 py-2 text-sm border border-line focus:border-ink placeholder:text-muted";

export const inputClassSm =
  "bg-canvas text-ink rounded-sm px-2 py-1 text-xs border border-line focus:border-ink placeholder:text-muted";

/** A flat inner surface for content nested inside a Panel: list rows, inline forms, etc. */
export const insetClass = "bg-canvas border border-line rounded-sm";
