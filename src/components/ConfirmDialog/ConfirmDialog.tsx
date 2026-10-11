import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { canRetry, errorMessage } from '../../storage/errors';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  /** danger for destructive actions (the default); primary for safe ones. */
  confirmTone?: 'danger' | 'primary';
  /** Performs the action. Rejecting keeps the dialog open with the error and a Retry. */
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Modal confirmation on the native <dialog>: focus is trapped while open,
 * Escape cancels, and focus starts on Cancel so Enter can't destroy by accident.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmTone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const cancelId = `${baseId}-cancel`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.getElementById(cancelId)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, cancelId]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setFailure(null);
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setFailure(null);
    onCancel();
  }

  // After a failure that retrying can't fix, only closing is left.
  const retryable = !failure || canRetry(failure.error);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape: let the owner close it, so its state stays the source of truth.
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id={titleId} className="confirm-dialog__title size-h5">
        {title}
      </h2>
      <div id={descriptionId} className="confirm-dialog__description">
        {children}
      </div>
      {failure && (
        <div role="alert" className="confirm-dialog__error field-error">
          {errorMessage(failure.error, 'That didn’t work.')}
        </div>
      )}
      <div className="confirm-dialog__actions">
        <button id={cancelId} type="button" className="btn" onClick={cancel}>
          {retryable ? 'Cancel' : 'Close'}
        </button>
        {retryable && (
          <button
            type="button"
            className={`btn btn--${confirmTone}`}
            aria-disabled={busy}
            onClick={() => void confirm()}
          >
            {failure ? 'Retry' : confirmLabel}
          </button>
        )}
      </div>
    </dialog>
  );
}
