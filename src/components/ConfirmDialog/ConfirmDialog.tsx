import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  /** Performs the action. Rejecting keeps the dialog open with an error. */
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const cancelId = `${baseId}-cancel`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    try {
      await onConfirm();
    } catch {
      setError('That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setError('');
    onCancel();
  }

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
      {error && (
        <div role="alert" className="field-error">
          {error}
        </div>
      )}
      <div className="confirm-dialog__actions">
        <button id={cancelId} type="button" className="btn" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--danger"
          aria-disabled={busy}
          onClick={() => void confirm()}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
