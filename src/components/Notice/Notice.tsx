import type { ReactNode } from 'react';
import { canRetry, errorMessage } from '../../storage/errors';

export interface NoticeProps {
  tone: 'warning' | 'error';
  children: ReactNode;
  /** Buttons that act on the notice (Retry, Reconnect…). */
  actions?: ReactNode;
  /** Shows a Dismiss button. */
  onDismiss?: () => void;
  /** Accessible name for Dismiss when there could be several on a page; must contain "Dismiss". */
  dismissLabel?: string;
  /** 'alert' for failures the user just caused; 'status' for news; none for what's there on load. */
  role?: 'alert' | 'status';
  className?: string;
}

/** A banner for sample data, sheet problems and failed saves. */
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
      <div className="notice__body">{children}</div>
      {(actions || onDismiss) && (
        <div className="notice__actions">
          {actions}
          {onDismiss && (
            <button type="button" className="btn" aria-label={dismissLabel} onClick={onDismiss}>
              Dismiss
            </button>
          )}
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
