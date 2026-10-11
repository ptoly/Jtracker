// Runs the adapter against a small fake of the Sheets REST API. Fixtures are fictional.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartialAddError, StorageError } from './errors';
import { createGoogleSheetsAdapter } from './googleSheetsAdapter';
import type { Cell } from './sheetRows';

const SPREADSHEET = 'sheet-123';
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET}`;

interface Call {
  method: string;
  url: string;
  body: unknown;
  auth: string | null;
}

/** An in-memory tab (plus an optional Positions tab) and a log of every request the adapter sent. */
function fakeSheets(
  initial: Cell[][],
  { columnCount = 26, positions }: { columnCount?: number; positions?: Cell[][] } = {},
) {
  const sheet = {
    values: initial.map((row) => [...row]),
    columnCount,
    positions: positions?.map((row) => [...row]) ?? null,
  };
  const calls: Call[] = [];
  const formats: { row: number; column: number; formula: string; pattern: string }[] = [];
  let failNext: { match: RegExp; status: number } | null = null;

  function cellRef(range: string) {
    const match = /!([A-Z]+)(\d+)/.exec(decodeURIComponent(range));
    if (!match?.[1] || !match[2]) throw new Error(`bad range ${range}`);
    const column = [...match[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return { row: Number(match[2]) - 1, column };
  }

  function setCell(row: number, column: number, value: Cell) {
    while (sheet.values.length <= row) sheet.values.push([]);
    const cells = sheet.values[row] ?? [];
    cells[column] = value;
    sheet.values[row] = cells;
  }

  function userEntered(value: string): Cell {
    if (value.startsWith("'")) return value.slice(1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return (Date.parse(value) - Date.UTC(1899, 11, 30)) / 86_400_000;
    }
    return value;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body: unknown = init.body ? JSON.parse(String(init.body)) : undefined;
    const auth = new Headers(init.headers).get('Authorization');
    calls.push({ method, url, body, auth });
    if (failNext && failNext.match.test(url)) {
      const { status } = failNext;
      failNext = null;
      return json({ error: { message: 'Simulated failure' } }, status);
    }

    const path = url.slice(BASE.length);
    if (method === 'GET' && path.startsWith('?fields=')) {
      return json({
        sheets: [
          { properties: { sheetId: 7, title: 'Other', gridProperties: { columnCount: 5 } } },
          {
            properties: {
              sheetId: 42,
              title: 'Sheet1',
              gridProperties: { columnCount: sheet.columnCount },
            },
          },
          ...(sheet.positions
            ? [
                {
                  properties: {
                    sheetId: 99,
                    title: 'Positions',
                    gridProperties: { columnCount: 2 },
                  },
                },
              ]
            : []),
        ],
      });
    }
    if (method === 'GET' && path.startsWith('/values/')) {
      if (decodeURIComponent(path).startsWith("/values/'Positions'")) {
        return sheet.positions
          ? json({ values: sheet.positions })
          : json({ error: { message: 'Unable to parse range' } }, 400);
      }
      return json({ values: sheet.values });
    }
    if (method === 'POST' && path.includes(':append')) {
      const { values } = body as { values: string[][] };
      const rowNumber = sheet.values.length + 1;
      values[0]?.forEach((value, column) => setCell(rowNumber - 1, column, userEntered(value)));
      return json({ updates: { updatedRange: `'Sheet1'!A${rowNumber}:H${rowNumber}` } });
    }
    if (method === 'POST' && path === '/values:batchUpdate') {
      const { valueInputOption, data } = body as {
        valueInputOption: string;
        data: { range: string; values: string[][] }[];
      };
      for (const entry of data) {
        if (entry.range.startsWith("'Positions'!")) {
          // The whole list is written from A1; blank cells clear old rows.
          sheet.positions = entry.values.map((cells) =>
            cells.map((value) => (value.startsWith("'") ? value.slice(1) : value)),
          );
          continue;
        }
        const { row, column } = cellRef(entry.range);
        const value = entry.values[0]?.[0] ?? '';
        setCell(row, column, valueInputOption === 'RAW' ? value : userEntered(value));
      }
      return json({});
    }
    if (method === 'POST' && path === ':batchUpdate') {
      for (const request of (body as { requests: Record<string, never>[] }).requests) {
        const del = request.deleteDimension as
          { range: { sheetId: number; startIndex: number; endIndex: number } } | undefined;
        if (del)
          sheet.values.splice(del.range.startIndex, del.range.endIndex - del.range.startIndex);
        if (request.addSheet) sheet.positions = [];
        const append = request.appendDimension as { length: number } | undefined;
        if (append) sheet.columnCount += append.length;
        const update = request.updateCells as
          | {
              start: { rowIndex: number; columnIndex: number };
              rows: {
                values: {
                  userEnteredValue: { formulaValue: string };
                  userEnteredFormat: { numberFormat: { pattern: string } };
                }[];
              }[];
            }
          | undefined;
        const cell = update?.rows[0]?.values[0];
        if (update && cell) {
          formats.push({
            row: update.start.rowIndex + 1,
            column: update.start.columnIndex,
            formula: cell.userEnteredValue.formulaValue,
            pattern: cell.userEnteredFormat.numberFormat.pattern,
          });
        }
      }
      return json({});
    }
    return json({ error: { message: 'Unhandled' } }, 400);
  });

  return {
    sheet,
    calls,
    formats,
    fetchMock,
    failOnce(match: RegExp, status: number) {
      failNext = { match, status };
    },
    writes: () => calls.filter((call) => call.method === 'POST'),
  };
}

const HEADER = ['Date', 'Company', 'Position', 'Status', 'Followed Up', 'Notes', 'Age', 'ID'];

function setup(values: Cell[][], options?: { columnCount?: number; positions?: Cell[][] }) {
  const fake = fakeSheets(values, options);
  vi.stubGlobal('fetch', fake.fetchMock);
  const getToken = vi.fn(async () => 'token-abc');
  const adapter = createGoogleSheetsAdapter({
    spreadsheetId: SPREADSHEET,
    tab: 'Sheet1',
    getToken,
  });
  return { fake, adapter, getToken };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('googleSheetsAdapter', () => {
  it('sends the OAuth token and never an API key', async () => {
    const { fake, adapter } = setup([
      HEADER,
      [46304, 'Example Co', 'Designer', 'Applied', '', '', 2, 'id-1'],
    ]);
    await adapter.list();
    await adapter.update('id-1', { notes: 'Called' });
    for (const call of fake.calls) {
      expect(call.auth).toBe('Bearer token-abc');
      expect(call.url).not.toMatch(/[?&]key=/);
    }
  });

  it('lists rows, problems and the ID setup needed', async () => {
    const { adapter } = setup([
      ['Date', 'Company', 'Position', 'Status'],
      [46304, 'Example Co', 'Designer', 'Ghosted'],
    ]);
    const result = await adapter.list();
    expect(result.applications).toHaveLength(1);
    expect(result.issues).toEqual([{ row: 2, problems: ['status “Ghosted” not recognized'] }]);
    expect(result.idSetup).toEqual({ addsColumn: true, rowsWithoutId: 1 });
  });

  it('sets up IDs in one batch, adding a column when the grid is full', async () => {
    const { fake, adapter } = setup(
      [
        ['Date', 'Company', 'Position', 'Status'],
        [46304, 'Example Co', 'Designer', 'Applied'],
        [],
        [46300, 'Sample Labs', 'Engineer', 'Rejected'],
      ],
      { columnCount: 4 },
    );
    await adapter.setUpIds();
    expect(fake.sheet.columnCount).toBe(5);
    expect(fake.sheet.values[0]?.[4]).toBe('ID');
    expect(fake.sheet.values[1]?.[4]).toMatch(/^[0-9a-f-]{36}$/);
    expect(fake.sheet.values[2]?.[4]).toBeUndefined();
    expect(fake.sheet.values[3]?.[4]).toMatch(/^[0-9a-f-]{36}$/);
    const valueWrites = fake.writes().filter((call) => call.url.endsWith('/values:batchUpdate'));
    expect(valueWrites).toHaveLength(1);
    expect((await adapter.list()).idSetup).toBeUndefined();
  });

  it('appends a row with dates as dates and text kept as text, then a numeric Age formula', async () => {
    const { fake, adapter } = setup([
      HEADER,
      [46304, 'Example Co', 'Designer', 'Applied', '', '', 2, 'id-1'],
    ]);
    const added = await adapter.add({
      dateApplied: '2026-10-11',
      company: '=1+1',
      position: 'Designer',
      status: 'Applied',
      notes: '3/4',
    });
    const row = fake.sheet.values[2] ?? [];
    expect(row.slice(0, 6)).toEqual([46306, '=1+1', 'Designer', 'Applied', '', '3/4']);
    expect(row[7]).toBe(added.id);
    expect(fake.formats).toEqual([{ row: 3, column: 6, formula: '=TODAY()-A3', pattern: '0' }]);
  });

  it('reports a partial add when only the Age formula fails, and can retry it', async () => {
    const { fake, adapter } = setup([HEADER]);
    fake.failOnce(/:batchUpdate$/, 500);
    const error = await adapter
      .add({
        dateApplied: '2026-10-11',
        company: 'Example Co',
        position: 'Designer',
        status: 'Applied',
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PartialAddError);
    expect(fake.sheet.values).toHaveLength(2);
    await (error as PartialAddError).retry();
    expect(fake.formats).toEqual([{ row: 2, column: 6, formula: '=TODAY()-A2', pattern: '0' }]);
  });

  it('updates only the changed cells of the row found by ID, even after the sheet was sorted', async () => {
    const { fake, adapter } = setup([
      HEADER,
      [46300, 'Sample Labs', 'Engineer', 'Applied', '', 'Keep', 9, 'id-2'],
      [46304, 'Example Co', 'Designer', 'Applied', '', '', 2, 'id-1'],
    ]);
    const updated = await adapter.update('id-1', {
      status: 'Followed Up',
      followedUpDate: '2026-10-11',
      notes: undefined,
    });
    const write = fake.writes()[0]?.body as { data: { range: string }[] };
    expect(write.data.map((entry) => entry.range)).toEqual([
      "'Sheet1'!D3",
      "'Sheet1'!E3",
      "'Sheet1'!F3",
    ]);
    expect(fake.sheet.values[1]).toEqual([
      46300,
      'Sample Labs',
      'Engineer',
      'Applied',
      '',
      'Keep',
      9,
      'id-2',
    ]);
    expect(updated).toEqual({
      id: 'id-1',
      dateApplied: '2026-10-09',
      company: 'Example Co',
      position: 'Designer',
      status: 'Followed Up',
      followedUpDate: '2026-10-11',
    });
  });

  it('deletes the row with the ID, using the tab’s sheetId', async () => {
    const { fake, adapter } = setup([
      HEADER,
      [46300, 'Sample Labs', 'Engineer', 'Applied', '', '', 9, 'id-2'],
      [46304, 'Example Co', 'Designer', 'Applied', '', '', 2, 'id-1'],
    ]);
    await adapter.remove('id-1');
    const request = (fake.writes()[0]?.body as { requests: unknown[] }).requests[0];
    expect(request).toEqual({
      deleteDimension: { range: { sheetId: 42, dimension: 'ROWS', startIndex: 2, endIndex: 3 } },
    });
    expect(fake.sheet.values).toHaveLength(2);
  });

  it('refuses to write rows it can’t identify', async () => {
    const { fake, adapter } = setup([
      HEADER,
      [46300, 'A', 'B', 'Applied', '', '', 9, 'same'],
      [46304, 'C', 'D', 'Applied', '', '', 2, 'same'],
    ]);
    const { applications } = await adapter.list();
    await expect(adapter.remove(applications[0]?.id ?? '')).rejects.toMatchObject({
      kind: 'conflict',
    });
    await expect(adapter.update('gone', { notes: 'x' })).rejects.toMatchObject({
      kind: 'not-found',
    });
    expect(fake.writes()).toHaveLength(0);
  });

  it('renews the token once after a 401', async () => {
    const { fake, adapter, getToken } = setup([HEADER]);
    fake.failOnce(/\?fields=/, 401);
    await adapter.list();
    expect(getToken).toHaveBeenCalledWith({ renew: true });
  });

  it('retries a read that hits a server error, but never a write', async () => {
    vi.useFakeTimers();
    try {
      const { fake, adapter } = setup([HEADER, [46304, 'A', 'B', 'Applied', '', '', 2, 'id-1']]);
      fake.failOnce(/\/values\//, 500);
      const listed = adapter.list();
      await vi.runAllTimersAsync();
      await expect(listed).resolves.toMatchObject({ applications: [{ id: 'id-1' }] });

      fake.failOnce(/\/values:batchUpdate$/, 500);
      const saved = adapter.update('id-1', { notes: 'x' }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      expect(await saved).toMatchObject({
        kind: 'network',
        message: 'Google Sheets failed while saving changes. (500: Simulated failure)',
      });
      expect(fake.writes()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('turns failures into user-facing errors', async () => {
    const { fake, adapter } = setup([HEADER]);
    fake.failOnce(/\/values\//, 400);
    const error = await adapter.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ kind: 'network' });

    const missingTab = createGoogleSheetsAdapter({
      spreadsheetId: SPREADSHEET,
      tab: 'Jobs',
      getToken: async () => 'token-abc',
    });
    await expect(missingTab.list()).rejects.toMatchObject({ kind: 'sheet' });
  });

  describe('positions', () => {
    const ROWS: Cell[][] = [
      HEADER,
      [46300, 'Sample Labs', 'Sr. Designer', 'Applied', '', '', 9, 'id-2'],
      [46304, 'Example Co', 'sr. designer ', 'Applied', '', '', 2, 'id-1'],
      [46305, 'Demo Inc', 'Engineer', 'Applied', '', '', 1, 'id-3'],
    ];

    it('lists an empty position list when there’s no Positions tab, without asking for it', async () => {
      const { fake, adapter } = setup(ROWS);
      expect((await adapter.list()).positions).toEqual({ added: [], hidden: [] });
      expect(fake.calls.some((call) => call.url.includes('Positions'))).toBe(false);
    });

    it('reads added and hidden positions from the Positions tab', async () => {
      const { adapter } = setup(ROWS, {
        positions: [
          ['Position', 'Hidden'],
          ['Staff Designer', ''],
          ['Engineer', 'Yes'],
          ['Old Title', true],
        ],
      });
      expect((await adapter.list()).positions).toEqual({
        added: ['Staff Designer'],
        hidden: ['Engineer', 'Old Title'],
      });
    });

    it('creates the Positions tab on the first change, then applies changes to what’s there now', async () => {
      const { fake, adapter } = setup(ROWS);
      await adapter.updatePositions((list) => ({
        ...list,
        added: [...list.added, 'Staff Designer'],
      }));
      expect(fake.sheet.positions).toEqual([
        ['Position', 'Hidden'],
        ['Staff Designer', ''],
      ]);
      // Someone hides a position in Sheets; the next change keeps it.
      fake.sheet.positions?.push(['Engineer', 'Yes']);
      const next = await adapter.updatePositions((list) => ({ ...list, added: [] }));
      expect(next).toEqual({ added: [], hidden: ['Engineer'] });
      expect(fake.sheet.positions).toEqual([
        ['Position', 'Hidden'],
        ['Engineer', 'Yes'],
        ['', ''],
      ]);
    });

    it('won’t write over a Positions tab that isn’t Jtracker’s', async () => {
      const { fake, adapter } = setup(ROWS, { positions: [['Team', 'Role']] });
      expect((await adapter.list()).positions).toEqual({ added: [], hidden: [] });
      await expect(
        adapter.updatePositions((list) => ({ ...list, added: ['X'] })),
      ).rejects.toMatchObject({ kind: 'sheet' });
      expect(fake.writes()).toHaveLength(0);
    });

    it('renames a position on every matching row and in the list, in one write', async () => {
      const { fake, adapter } = setup(ROWS, {
        positions: [
          ['Position', 'Hidden'],
          ['Senior Designer', 'Yes'],
        ],
      });
      const result = await adapter.renamePosition('Sr. Designer', 'Senior Designer');
      expect(result).toEqual({ changed: 2, positions: { added: [], hidden: [] } });
      expect(fake.sheet.values.map((row) => row[2])).toEqual([
        'Position',
        'Senior Designer',
        'Senior Designer',
        'Engineer',
      ]);
      const writes = fake.writes();
      expect(writes).toHaveLength(1);
      expect(writes[0]?.url).toMatch(/\/values:batchUpdate$/);
    });
  });
});
