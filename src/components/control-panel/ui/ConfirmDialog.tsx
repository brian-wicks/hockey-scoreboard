import { ReactNode } from "react";
import { Button, ButtonVariant } from "./primitives";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
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

  // Callers must render this outside any overflow-hidden ancestor, which would clip it.
  return (
    <div className="ui fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-canvas border border-line rounded-sm p-5">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="text-sm text-muted mt-2">{message}</p>
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} variant={confirmVariant}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
