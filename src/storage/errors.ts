import type { Application } from '../types/application';

/**
 * - auth: the Google session expired or was refused; reconnect, then retry.
 * - network: the request failed or Google returned an error; retrying may work.
 * - not-found: the row or sheet isn't there any more; reload.
 * - conflict: the sheet's data stops Jtracker from writing safely (e.g. a shared ID).
 * - sheet: the sheet's layout (tab, headers) needs fixing first.
 */
export type StorageErrorKind = 'auth' | 'network' | 'not-found' | 'conflict' | 'sheet';

/** A storage failure with a message fit to show the user. Never contains row data. */
export class StorageError extends Error {
  readonly kind: StorageErrorKind;

  constructor(kind: StorageErrorKind, message: string) {
    super(message);
    this.name = 'StorageError';
    this.kind = kind;
  }
}

/**
 * The row was added, but a follow-up write (the Age formula) failed.
 * `retry` repeats only that write.
 */
export class PartialAddError extends StorageError {
  readonly application: Application;
  readonly retry: () => Promise<void>;

  constructor(application: Application, cause: unknown, retry: () => Promise<void>) {
    super(
      cause instanceof StorageError ? cause.kind : 'network',
      `Added ${application.company}, but couldn’t set its Age formula. ${errorMessage(cause, '')}`.trim(),
    );
    this.name = 'PartialAddError';
    this.application = application;
    this.retry = retry;
  }
}

/** The message to show for any thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof StorageError ? error.message : fallback;
}

/** Whether repeating the same call could succeed. */
export function canRetry(error: unknown): boolean {
  return !(error instanceof StorageError) || error.kind === 'auth' || error.kind === 'network';
}
