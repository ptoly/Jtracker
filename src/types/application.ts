export const STATUSES = ['Applied', 'Followed Up', 'Interviewed', 'Rejected', 'Filled'] as const;

export type Status = (typeof STATUSES)[number];

/** Dates are ISO calendar dates (YYYY-MM-DD). Age and follow-up-due are derived; see lib/derive. */
export interface Application {
  id: string;
  dateApplied: string;
  company: string;
  position: string;
  status: Status;
  followedUpDate?: string;
  notes?: string;
}

/** Shape accepted by StorageAdapter.add — the adapter assigns the id. */
export type NewApplication = Omit<Application, 'id'>;

/**
 * Shape accepted by StorageAdapter.update. Omitted keys are left alone;
 * an optional field set to `undefined` is cleared.
 */
export type ApplicationPatch = { [K in keyof NewApplication]?: NewApplication[K] | undefined };
