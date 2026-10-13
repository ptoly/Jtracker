import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { XCloseIcon } from '../Icons/Icons';

export interface DialogProps {
  open: boolean;
  title: string;
  /** Escape, the close button, or the owner's own Cancel. */
  onClose: () => void;
  children: ReactNode;
  /** small for confirmations; medium for forms and lists. */
  size?: 'small' | 'medium';
}

/**
 * Modal on the native <dialog>: focus is trapped while open, Escape closes,
 * and focus goes back to whatever opened it. On open, focus goes to the first
 * element marked data-autofocus, else the close button.
 * Children stay mounted while closed, so a half-filled form keeps its input.
 */
export function Dialog({ open, title, onClose, children, size = 'medium' }: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let the owner close it, so its state stays the source of truth.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog__header">
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <div className="dialog__close">
          <IconButton label="Close" tooltip="Close" icon={<XCloseIcon />} onClick={onClose} />
        </div>
      </div>
      {children}
    </dialog>
  );
}
