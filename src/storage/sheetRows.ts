// Pure translation between sheet cells and applications. No network, no logging.
import {
  STATUSES,
  type Application,
  type ApplicationPatch,
  type NewApplication,
  type Status,
  type UnparsedCells,
} from '../types/application';
import type { RowIssue } from './StorageAdapter';

/** A cell as the Sheets API returns it with UNFORMATTED_VALUE (missing trailing cells are absent). */
export type Cell = string | number | boolean | null | undefined;

/** Columns Jtracker knows, by header text (matched trimmed and case-insensitive). */
export const HEADERS = {
  dateApplied: 'Date',
  company: 'Company',
  position: 'Position',
  status: 'Status',
  followedUpDate: 'Followed Up',
  notes: 'Notes',
  id: 'ID',
  age: 'Age',
} as const;

export type ColumnKey = keyof typeof HEADERS;
export type Columns = Partial<Record<ColumnKey, number>>;

const REQUIRED_COLUMNS = ['dateApplied', 'company', 'position', 'status'] as const;

/** Ids for rows that can't be written (no ID, or an ID shared with another row). */
const UNWRITABLE_PREFIX = '#row-';

export function isWritableId(id: string): boolean {
  return !id.startsWith(UNWRITABLE_PREFIX);
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/** Finds Jtracker's columns in the header row. Returns an error message if it can't. */
export function matchHeaders(headerRow: Cell[]): { columns: Columns } | { error: string } {
  const columns: Columns = {};
  const duplicates = new Set<string>();
  const keys = Object.keys(HEADERS) as ColumnKey[];
  headerRow.forEach((cell, index) => {
    const text = cellText(cell).toLowerCase();
    const key = keys.find((k) => HEADERS[k].toLowerCase() === text);
    if (!key) return;
    if (columns[key] === undefined) columns[key] = index;
    else duplicates.add(HEADERS[key]);
  });

  const missing = REQUIRED_COLUMNS.filter((key) => columns[key] === undefined).map(
    (key) => HEADERS[key],
  );
  if (missing.length > 0) {
    return {
      error: `The header row (row 1) needs these columns: ${missing.join(', ')}.`,
    };
  }
  if (duplicates.size > 0) {
    return { error: `The header row has more than one ${[...duplicates].join(', ')} column.` };
  }
  return { columns };
}

export function cellText(cell: Cell): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Day 0 of Sheets' date serial numbers. */
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);

/** 46304 → "2026-10-09". The time of day, if any, is dropped. */
export function serialToIsoDate(serial: number): string {
  return new Date(SERIAL_EPOCH + Math.floor(serial) * MS_PER_DAY).toISOString().slice(0, 10);
}

function isoFromParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * A date cell as an ISO date: '' when empty, null when it can't be read.
 * Accepts serial numbers and text in YYYY-MM-DD, M/D/YYYY, M/D/YY or M.D.YY
 * (US order; two-digit years are 20YY).
 */
export function parseSheetDate(cell: Cell): string | null {
  if (typeof cell === 'number') return cell > 0 ? serialToIsoDate(cell) : null;
  const text = cellText(cell);
  if (!text) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4}|\d{2})$/.exec(text);
  if (us) {
    const year = Number(us[4]);
    return isoFromParts(year < 100 ? 2000 + year : year, Number(us[1]), Number(us[3]));
  }
  return null;
}

export function parseStatus(cell: Cell): Status | null {
  const text = cellText(cell).toLowerCase();
  return STATUSES.find((status) => status.toLowerCase() === text) ?? null;
}

/** Cells that make a row an application. Age (often a filled-down formula) doesn't count. */
const CONTENT_COLUMNS = [
  'dateApplied',
  'company',
  'position',
  'status',
  'followedUpDate',
  'notes',
  'id',
] as const;

export interface SheetRow {
  /** 1-based, as shown in the sheet. */
  rowNumber: number;
  /** The ID cell's text; '' when empty. */
  sheetId: string;
  application: Application;
  problems: string[];
}

export interface ParsedSheet {
  columns: Columns;
  /** Number of cells in the header row; a new ID column goes right after. */
  headerWidth: number;
  rows: SheetRow[];
}

function at(row: Cell[], index: number | undefined): Cell {
  return index === undefined ? undefined : row[index];
}

function parseRow(row: Cell[], rowNumber: number, columns: Columns): SheetRow {
  const problems: string[] = [];
  const unparsed: UnparsedCells = {};
  const get = (key: ColumnKey) => at(row, columns[key]);

  const dateCell = get('dateApplied');
  let dateApplied = parseSheetDate(dateCell);
  if (dateApplied === '') problems.push('no date');
  if (dateApplied === null) {
    problems.push(`date “${cellText(dateCell)}” not recognized`);
    unparsed.dateApplied = cellText(dateCell);
    dateApplied = '';
  }

  const statusCell = get('status');
  const status = parseStatus(statusCell);
  if (!status) {
    const text = cellText(statusCell);
    if (text) {
      problems.push(`status “${text}” not recognized`);
      unparsed.status = text;
    } else {
      problems.push('no status');
    }
  }

  const followedCell = get('followedUpDate');
  const followedUpDate = parseSheetDate(followedCell);
  if (followedUpDate === null) {
    problems.push(`followed-up date “${cellText(followedCell)}” not recognized`);
    unparsed.followedUpDate = cellText(followedCell);
  }

  const company = cellText(get('company'));
  const position = cellText(get('position'));
  if (!company) problems.push('no company');
  if (!position) problems.push('no position');
  const notes = cellText(get('notes'));
  const sheetId = cellText(get('id'));

  const application: Application = {
    id: sheetId || `${UNWRITABLE_PREFIX}${rowNumber}`,
    dateApplied,
    company,
    position,
    status: status ?? '',
    ...(followedUpDate && { followedUpDate }),
    ...(notes && { notes }),
    ...(Object.keys(unparsed).length > 0 && { unparsed }),
  };
  return { rowNumber, sheetId, application, problems };
}

/** Reads a whole tab (row 1 = headers). Rows with nothing in Jtracker's columns are skipped. */
export function parseSheet(values: Cell[][]): ParsedSheet | { error: string } {
  const header = values[0];
  if (!header || header.every((cell) => !cellText(cell))) {
    return { error: 'The sheet has no header row. Row 1 needs Date, Company, Position, Status.' };
  }
  const matched = matchHeaders(header);
  if ('error' in matched) return matched;
  const { columns } = matched;

  const rows: SheetRow[] = [];
  values.slice(1).forEach((row, index) => {
    const blank = CONTENT_COLUMNS.every((key) => !cellText(at(row, columns[key])));
    if (!blank) rows.push(parseRow(row, index + 2, columns));
  });

  // A shared ID can't identify a row: those rows get placeholder ids and stay read-only.
  const byId = new Map<string, SheetRow[]>();
  for (const row of rows) {
    if (row.sheetId) byId.set(row.sheetId, [...(byId.get(row.sheetId) ?? []), row]);
  }
  for (const group of byId.values()) {
    if (group.length < 2) continue;
    const numbers = group.map((row) => row.rowNumber).join(', ');
    for (const row of group) {
      row.application = { ...row.application, id: `${UNWRITABLE_PREFIX}${row.rowNumber}` };
      row.problems.push(`same ID as rows ${numbers}; Jtracker won’t change it until that’s fixed`);
    }
  }

  return { columns, headerWidth: header.length, rows };
}

export function issuesOf(sheet: ParsedSheet): RowIssue[] {
  return sheet.rows
    .filter((row) => row.problems.length > 0)
    .map((row) => ({ row: row.rowNumber, problems: row.problems }));
}

/** Rows whose ID cell matches `id` exactly. */
export function rowsWithId(sheet: ParsedSheet, id: string): SheetRow[] {
  return sheet.rows.filter((row) => row.sheetId === id);
}

type FieldKey = keyof ApplicationPatch;
const DATE_FIELDS: ReadonlySet<FieldKey> = new Set(['dateApplied', 'followedUpDate']);

/**
 * A value to send with valueInputOption USER_ENTERED. Dates go as YYYY-MM-DD so
 * Sheets stores real dates. Text gets a leading apostrophe so Sheets keeps it as
 * typed: "=…" isn't run as a formula and "3/4" doesn't become a date. The
 * apostrophe isn't shown in the cell.
 */
export function cellInput(field: FieldKey, value: string | undefined): string {
  if (value === undefined || value === '') return '';
  return DATE_FIELDS.has(field) ? value : `'${value}`;
}

/** The cells of a new row, from column A to the last column Jtracker writes. */
export function newRowCells(input: NewApplication, id: string, columns: Columns): string[] {
  const values: Partial<Record<ColumnKey, string>> = {
    dateApplied: cellInput('dateApplied', input.dateApplied),
    company: cellInput('company', input.company),
    position: cellInput('position', input.position),
    status: cellInput('status', input.status),
    followedUpDate: cellInput('followedUpDate', input.followedUpDate),
    notes: cellInput('notes', input.notes),
    id: `'${id}`,
  };
  const keys = Object.keys(values) as ColumnKey[];
  const width = Math.max(...keys.map((key) => columns[key] ?? -1)) + 1;
  const cells = Array.from({ length: width }, () => '');
  for (const key of keys) {
    const index = columns[key];
    if (index !== undefined) cells[index] = values[key] ?? '';
  }
  return cells;
}

/** Row number from an A1 range like "'Sheet1'!A31:H31". */
export function rowFromRange(range: string): number | null {
  const match = /![A-Z]+(\d+)/.exec(range);
  return match ? Number(match[1]) : null;
}

/** A tab name quoted for A1 notation: Sheet1 → 'Sheet1', it's → 'it''s'. */
export function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}
