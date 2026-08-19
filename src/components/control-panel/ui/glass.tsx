import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../../utils/cn";

/**
 * Shared "Liquid Glass"-inspired UI primitives for the Control Panel.
 * Blur is intentionally kept to this framing layer (panels/buttons) rather than
 * nested further — stacking backdrop-blur inside backdrop-blur is a real GPU cost
 * on the modest laptops operators run this alongside OBS/vMix on.
 */

export function GlassPanel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl",
        "shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassPanelHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 mb-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionLabel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-xs font-semibold uppercase tracking-wider text-zinc-400", className)} {...rest}>
      {children}
    </div>
  );
}

export type GlassButtonVariant = "primary" | "secondary" | "destructive" | "success" | "ghost";

const glassButtonVariants: Record<GlassButtonVariant, string> = {
  primary:
    "bg-indigo-500/80 hover:bg-indigo-500 text-white border border-indigo-400/40 shadow-[0_0_20px_rgba(99,102,241,0.35)]",
  secondary: "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-100 border border-white/10",
  destructive: "bg-red-500/80 hover:bg-red-500 text-white border border-red-400/40",
  success: "bg-emerald-500/80 hover:bg-emerald-500 text-white border border-emerald-400/40",
  ghost: "bg-transparent hover:bg-white/[0.06] text-zinc-300 border border-transparent",
};

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
}

export function GlassButton({ className, variant = "secondary", type = "button", ...rest }: GlassButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
        "transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        glassButtonVariants[variant],
        className,
      )}
      {...rest}
    />
  );
}

/** Shared class strings for plain (non-<GlassButton>) inputs/selects, kept as constants so every panel stays consistent. */
export const glassInputClass =
  "bg-white/[0.05] text-zinc-100 rounded-lg px-3 py-2 text-sm border border-white/10 " +
  "focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-zinc-500";

export const glassInputClassSm =
  "bg-white/[0.05] text-zinc-100 rounded-md px-2 py-1 text-xs border border-white/10 " +
  "focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-zinc-500";

/** A flat (non-blurred) inner surface for content nested inside a GlassPanel — list rows, inline forms, etc. */
export const glassInsetClass = "bg-white/[0.03] border border-white/[0.07] rounded-xl";
