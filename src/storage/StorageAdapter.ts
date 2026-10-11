import type { Application, ApplicationPatch, NewApplication } from '../types/application';

/** A row the backend loaded but couldn't fully read. The row is still listed. */
export interface RowIssue {
  /** Row number as the user sees it in the sheet. */
  row: number;
  problems: string[];
}

/** One-time setup a sheet needs before Jtracker can write to it. */
export interface IdSetup {
  /** The sheet has no ID column yet; one will be added. */
  addsColumn: boolean;
  /** Rows with data but no ID. */
  rowsWithoutId: number;
}

/**
 * The user's edits to the position suggestions (see lib/positions):
 * suggestions = positions in use + added − hidden. Names never overlap
 * between the two lists.
 */
export interface PositionList {
  added: string[];
  hidden: string[];
}

export interface ListResult {
  applications: Application[];
  issues: RowIssue[];
  positions: PositionList;
  /** Present when IDs are missing; writes need them. */
  idSetup?: IdSetup;
}

/** Persistence boundary. Async so a remote backend can implement it. */
export interface StorageAdapter {
  list(): Promise<ListResult>;
  add(input: NewApplication): Promise<Application>;
  update(id: string, patch: ApplicationPatch): Promise<Application>;
  remove(id: string): Promise<void>;
  /**
   * Applies `change` to the position list as it is in storage now (not as it
   * was last loaded), saves it, and returns the result.
   */
  updatePositions(change: (current: PositionList) => PositionList): Promise<PositionList>;
  /**
   * Renames a position on every application that uses it (case-insensitive
   * match), and in the position list. Returns how many applications changed.
   */
  renamePosition(from: string, to: string): Promise<{ changed: number; positions: PositionList }>;
}
