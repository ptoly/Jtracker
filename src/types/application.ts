export const STATUSES = [
  'Applied',
  'Followed Up',
  'Interviewed',
  'Interviewed - Rejected',
  'Rejected',
  'Filled',
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Cell text a storage backend couldn't read as a value, kept for display.
 * Only rows loaded from a sheet have it.
 */
export interface UnparsedCells {
  dateApplied?: string;
  status?: string;
  followedUpDate?: string;
}

/** Dates are ISO calendar dates (YYYY-MM-DD). Age and follow-up-due are derived; see lib/derive. */
export interface Application {
  id: string;
  /** '' when the sheet has no readable date (see `unparsed`). */
  dateApplied: string;
  company: string;
  position: string;
  /** '' when the sheet's status is empty or not one of STATUSES (see `unparsed`). */
  status: Status | '';
  followedUpDate?: string;
  notes?: string;
  unparsed?: UnparsedCells;
}

/** Shape accepted by StorageAdapter.add — the adapter assigns the id. */
export type NewApplication = Omit<Application, 'id' | 'status' | 'unparsed'> & { status: Status };

/**
 * Shape accepted by StorageAdapter.update. Omitted keys are left alone;
 * an optional field set to `undefined` is cleared.
 */
export type ApplicationPatch = { [K in keyof NewApplication]?: NewApplication[K] | undefined };
