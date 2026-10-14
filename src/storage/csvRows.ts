// Applications ⇄ CSV text, in the Google Sheet's columns. Pure: no file access.
import type { Application } from '../types/application';
import { parseCsv, toCsv } from './csv';
import { HEADERS, issuesOf, parseSheet } from './sheetRows';
import type { RowIssue } from './StorageAdapter';

/** A new file's columns, in the Sheet's order (no Age: Jtracker calculates it). */
export const NEW_FILE_HEADER = [
  HEADERS.dateApplied,
  HEADERS.company,
  HEADERS.position,
  HEADERS.status,
  HEADERS.followedUpDate,
  HEADERS.notes,
  HEADERS.id,
];

/** 2026-10-02 → 10/2/2026, the way Google Sheets writes US dates. */
export function csvDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

/** The applications as a CSV file with NEW_FILE_HEADER's columns (Export CSV). */
export function applicationsToCsv(applications: readonly Application[]): string {
  return toCsv([
    NEW_FILE_HEADER,
    ...applications.map((app) => [
      app.dateApplied ? csvDate(app.dateApplied) : (app.unparsed?.dateApplied ?? ''),
      app.company,
      app.position,
      app.status || (app.unparsed?.status ?? ''),
      app.followedUpDate ? csvDate(app.followedUpDate) : (app.unparsed?.followedUpDate ?? ''),
      app.notes ?? '',
      app.id,
    ]),
  ]);
}

export interface CsvImport {
  applications: Application[];
  issues: RowIssue[];
}

/**
 * Applications from a CSV file's text (Import CSV), read like the Sheet:
 * row 1 is headers; dates without a year are read against `today`. Each
 * row gets a fresh ID, since the imported copy is separate from the file.
 */
export function csvToApplications(text: string, today: Date): CsvImport | { error: string } {
  const sheet = parseSheet(parseCsv(text), today);
  if ('error' in sheet) return { error: sheet.error.replace('sheet', 'file') };
  return {
    applications: sheet.rows.map((row) => ({ ...row.application, id: crypto.randomUUID() })),
    issues: issuesOf(sheet),
  };
}
