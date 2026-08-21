import { ReactNode } from "react";
import { GlassButton, GlassButtonVariant } from "./glass";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: GlassButtonVariant;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared in-app replacement for window.confirm — a themed modal instead of the native browser dialog. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  // Callers must render this outside any backdrop-blur/overflow-hidden ancestor (e.g. not
  // nested inside a GlassPanel) — backdrop-filter creates a new containing block for
  // fixed-position descendants, which would confine inset-0 to the ancestor's box instead
  // of the full viewport, and overflow-hidden would then clip it.
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-400 mt-2">{message}</p>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <GlassButton type="button" onClick={onCancel} variant="secondary">
            {cancelLabel}
          </GlassButton>
          <GlassButton type="button" onClick={onConfirm} variant={confirmVariant}>
            {confirmLabel}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
