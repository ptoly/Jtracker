import { normalize } from '../lib/applicationRules';
import { EMPTY_POSITION_LIST, renameInList } from '../lib/positions';
import type { Application, ApplicationPatch, NewApplication } from '../types/application';
import { parseCsv, toCsv } from './csv';
import { StorageError } from './errors';
import {
  cellText,
  HEADERS,
  issuesOf,
  parseSheet,
  rowsWithId,
  type ColumnKey,
  type ParsedSheet,
} from './sheetRows';
import type { PositionList, StorageAdapter } from './StorageAdapter';

export interface CsvFileOptions {
  /** A .csv the user picked (File System Access API), with readwrite permission. */
  handle: FileSystemFileHandle;
  /** The app's reference date: dates saved without a year are read against it. */
  today: Date;
}

/** The file as last read: its cells, and how to write it back the same way. */
interface CsvTable {
  cells: string[][];
  sheet: ParsedSheet;
  eol: string;
  bom: string;
}

/** 2026-10-02 → 10/2/2026, the way Google Sheets writes US dates. */
function csvDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

function cellValue(key: ColumnKey, value: string | undefined): string {
  if (!value) return '';
  return key === 'dateApplied' || key === 'followedUpDate' ? csvDate(value) : value;
}

const PATCH_KEYS = [
  'dateApplied',
  'company',
  'position',
  'status',
  'followedUpDate',
  'notes',
] as const satisfies readonly (keyof ApplicationPatch & ColumnKey)[];

/** File errors as storage errors the app already knows how to show. */
function fileError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new StorageError('auth', 'Jtracker no longer has access to the file. Open it again.');
  }
  if (name === 'NotFoundError') {
    return new StorageError('not-found', 'The file was moved or deleted. Open it again.');
  }
  return new StorageError('network', 'Couldn’t read or save the file.');
}

/**
 * Applications in a CSV file on the user's computer, read and written whole
 * through the File System Access API (Chrome, Edge). Same columns as the
 * Google Sheet (row 1 = headers; see sheetRows), so a sheet downloaded as CSV
 * works as it is. Every write reads the file first, so edits made elsewhere
 * aren't lost. Saving drops the Age column: Jtracker calculates age itself.
 * Rows without an ID get one on first load. The position list is kept in
 * this browser (localStorage), by file name.
 */
export function createCsvFileAdapter({ handle, today }: CsvFileOptions): StorageAdapter {
  const positionsKey = `jtracker.csv.positions:${handle.name}`;
  // One write at a time: each reads the file, changes it and saves it.
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(run: () => Promise<T>): Promise<T> {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  async function read(): Promise<CsvTable> {
    let text: string;
    try {
      text = await (await handle.getFile()).text();
    } catch (error) {
      throw fileError(error);
    }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const bom = text.startsWith('﻿') ? '﻿' : '';
    let cells = parseCsv(text);

    // Age is calculated, never stored: leave it out of what gets saved.
    const ageIndex = (cells[0] ?? []).findIndex(
      (cell) => cellText(cell).toLowerCase() === HEADERS.age.toLowerCase(),
    );
    if (ageIndex >= 0) cells = cells.map((row) => row.filter((_, index) => index !== ageIndex));

    const sheet = parseSheet(cells, today);
    if ('error' in sheet) throw new StorageError('sheet', sheet.error.replace('sheet', 'file'));
    return { cells, sheet, eol, bom };
  }

  async function save(table: CsvTable): Promise<void> {
    try {
      const writable = await handle.createWritable();
      await writable.write(table.bom + toCsv(table.cells, table.eol));
      await writable.close();
    } catch (error) {
      throw fileError(error);
    }
  }

  function reparse(table: CsvTable): CsvTable {
    const sheet = parseSheet(table.cells, today);
    if ('error' in sheet) throw new StorageError('sheet', sheet.error);
    return { ...table, sheet };
  }

  /** Sets a cell, padding the row out to the header's width first. */
  function setCell(table: CsvTable, rowIndex: number, column: number, value: string) {
    const width = Math.max(table.cells[0]?.length ?? 0, column + 1);
    const row = table.cells[rowIndex] ?? [];
    while (row.length < width) row.push('');
    row[column] = value;
    table.cells[rowIndex] = row;
  }

  /** The one row with this ID, as an index into the cells. */
  function rowIndexOf(table: CsvTable, id: string): number {
    const rows = rowsWithId(table.sheet, id);
    if (rows.length === 0) {
      throw new StorageError('not-found', 'That application isn’t in the file any more. Reload.');
    }
    if (rows.length > 1) {
      throw new StorageError('conflict', 'More than one row in the file has this ID.');
    }
    return (rows[0]?.rowNumber ?? 0) - 1;
  }

  function applicationAt(table: CsvTable, id: string): Application {
    const row = rowsWithId(table.sheet, id)[0];
    if (!row) throw new StorageError('not-found', 'That application isn’t in the file any more.');
    return row.application;
  }

  /** Adds an ID column if there isn't one, and an ID to every row without one. */
  function fillIds(table: CsvTable): boolean {
    let idColumn = table.sheet.columns.id;
    const missing = table.sheet.rows.filter((row) => !row.sheetId);
    if (idColumn !== undefined && missing.length === 0) return false;
    if (idColumn === undefined) {
      idColumn = table.cells[0]?.length ?? 0;
      setCell(table, 0, idColumn, HEADERS.id);
    }
    for (const row of missing) setCell(table, row.rowNumber - 1, idColumn, crypto.randomUUID());
    return true;
  }

  function loadPositions(): PositionList {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(positionsKey) ?? 'null');
      if (typeof value !== 'object' || value === null) return EMPTY_POSITION_LIST;
      const { added, hidden } = value as Record<string, unknown>;
      const names = (list: unknown) =>
        Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : [];
      return { added: names(added), hidden: names(hidden) };
    } catch {
      return EMPTY_POSITION_LIST;
    }
  }

  function savePositions(list: PositionList) {
    localStorage.setItem(positionsKey, JSON.stringify(list));
  }

  return {
    list: () =>
      serial(async () => {
        let table = await read();
        if (fillIds(table)) {
          await save(table);
          table = reparse(table);
        }
        return {
          applications: table.sheet.rows.map((row) => row.application),
          issues: issuesOf(table.sheet),
          positions: loadPositions(),
        };
      }),

    add: (input: NewApplication) =>
      serial(async () => {
        const table = await read();
        fillIds(table);
        const rowIndex = table.cells.length;
        const id = crypto.randomUUID();
        const { columns } = reparse(table).sheet;
        for (const key of PATCH_KEYS) {
          const column = columns[key];
          if (column !== undefined) setCell(table, rowIndex, column, cellValue(key, input[key]));
        }
        setCell(table, rowIndex, columns.id ?? 0, id);
        await save(table);
        return applicationAt(reparse(table), id);
      }),

    update: (id: string, patch: ApplicationPatch) =>
      serial(async () => {
        const table = await read();
        const rowIndex = rowIndexOf(table, id);
        for (const key of PATCH_KEYS) {
          if (!(key in patch)) continue;
          const column = table.sheet.columns[key];
          if (column !== undefined) setCell(table, rowIndex, column, cellValue(key, patch[key]));
        }
        await save(table);
        return applicationAt(reparse(table), id);
      }),

    remove: (id: string) =>
      serial(async () => {
        const table = await read();
        table.cells.splice(rowIndexOf(table, id), 1);
        await save(table);
      }),

    async updatePositions(change) {
      const next = change(loadPositions());
      savePositions(next);
      return next;
    },

    renamePosition: (from: string, to: string) =>
      serial(async () => {
        const table = await read();
        const target = to.trim();
        const column = table.sheet.columns.position;
        let changed = 0;
        if (column !== undefined) {
          for (const row of table.sheet.rows) {
            if (normalize(row.application.position) !== normalize(from)) continue;
            setCell(table, row.rowNumber - 1, column, target);
            changed += 1;
          }
        }
        if (changed > 0) await save(table);
        const positions = renameInList(loadPositions(), from, target);
        savePositions(positions);
        return { changed, positions };
      }),
  };
}
