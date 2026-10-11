import type { ReactNode } from 'react';
import { canRetry, errorMessage } from '../../storage/errors';
import { IconButton } from '../IconButton/IconButton';
import { AlertCircleIcon, XCloseIcon } from '../Icons/Icons';

export interface NoticeProps {
  tone: 'warning' | 'error';
  children: ReactNode;
  /** Buttons that act on the notice (Retry, Reconnect…). */
  actions?: ReactNode;
  /** Shows a close (X) button. */
  onDismiss?: () => void;
  /** Accessible name for the close button when there could be several on a page; must start with "Dismiss". */
  dismissLabel?: string;
  /** 'alert' for failures the user just caused; 'status' for news; none for what's there on load. */
  role?: 'alert' | 'status';
  className?: string;
}

/** A banner for sample data, sheet problems and failed saves: icon, message, actions, close. */
export function Notice({
  tone,
  children,
  actions,
  onDismiss,
  dismissLabel,
  role,
  className = '',
}: NoticeProps) {
  return (
    <div className={`notice notice--${tone} ${className}`} role={role}>
      <span className="notice__icon">
        <AlertCircleIcon />
      </span>
      <div className="notice__body">{children}</div>
      {actions && <div className="notice__actions">{actions}</div>}
      {onDismiss && (
        <div className="notice__dismiss">
          <IconButton
            label={dismissLabel ?? 'Dismiss'}
            tooltip="Dismiss"
            icon={<XCloseIcon />}
            onClick={onDismiss}
          />
        </div>
      )}
    </div>
  );
}

export interface SaveErrorProps {
  error: unknown;
  /** Shown for errors that aren't StorageErrors. */
  fallback: string;
  /** Repeats the failed call. Offered only when repeating could work. */
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

/** A failed save: what went wrong, plus Retry when trying again could help. */
export function SaveError({
  error,
  fallback,
  onRetry,
  retrying = false,
  className,
}: SaveErrorProps) {
  return (
    <Notice
      tone="error"
      role="alert"
      {...(className && { className })}
      actions={
        canRetry(error) && (
          <button
            type="button"
            className="btn"
            aria-disabled={retrying}
            onClick={() => {
              if (!retrying) onRetry();
            }}
          >
            Retry
          </button>
        )
      }
    >
      {errorMessage(error, fallback)}
    </Notice>
  );
}
