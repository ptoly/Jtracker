import type { Application, ApplicationPatch, NewApplication } from '../types/application';
import { PartialAddError, StorageError } from './errors';
import {
  cellInput,
  columnLetter,
  HEADERS,
  isWritableId,
  issuesOf,
  newRowCells,
  parseSheet,
  quoteTab,
  rowFromRange,
  rowsWithId,
  type Cell,
  type Columns,
  type ParsedSheet,
  type SheetRow,
} from './sheetRows';
import type { ListResult, StorageAdapter } from './StorageAdapter';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Waits before retrying a read that hit a server error (Google's advice: back off and retry). */
const READ_RETRY_DELAYS_MS = [500, 1500];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GoogleSheetsOptions {
  spreadsheetId: string;
  /** Tab name, e.g. "Sheet1". */
  tab: string;
  /** OAuth access token; `renew` asks for a fresh one after a 401. */
  getToken: (options?: { renew?: boolean }) => Promise<string>;
}

export interface GoogleSheetsAdapter extends StorageAdapter {
  /** One-time setup: adds the ID column if needed and fills IDs for rows without one. */
  setUpIds(): Promise<void>;
}

interface TabInfo {
  sheetId: number;
  columnCount: number;
}

interface Snapshot extends ParsedSheet {
  tab: TabInfo;
}

/** Turns a failed response into a user-facing error. Google's text never includes cell values. */
async function toStorageError(response: Response, step: string): Promise<StorageError> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    // Not JSON; the status code is enough.
  }
  const suffix = detail ? ` (${response.status}: ${detail})` : ` (${response.status})`;
  switch (response.status) {
    case 401:
      return new StorageError('auth', 'Google sign-in expired. Use Reconnect, then try again.');
    case 403:
      return new StorageError(
        'auth',
        `Google refused access to this spreadsheet. Reconnect and pick it again.${suffix}`,
      );
    case 404:
      return new StorageError(
        'not-found',
        'The spreadsheet wasn’t found. It may have been deleted or moved.',
      );
    case 429:
      return new StorageError('network', `Google Sheets is busy. Wait a moment, then try again.`);
    default:
      return new StorageError('network', `Google Sheets failed while ${step}.${suffix}`);
  }
}

export function createGoogleSheetsAdapter({
  spreadsheetId,
  tab,
  getToken,
}: GoogleSheetsOptions): GoogleSheetsAdapter {
  const base = `${API}/${encodeURIComponent(spreadsheetId)}`;
  const quotedTab = quoteTab(tab);
  const a1 = (column: number, row: number) => `${quotedTab}!${columnLetter(column)}${row}`;

  /** Authorized JSON request. Only the OAuth token is sent: never an API key. */
  /**
   * `step` names the call in error messages ("reading rows"), so a failure says where it happened.
   * Reads that hit a 5xx are retried with backoff; writes aren't, because a write that
   * errored may still have landed (a repeated append would add the row twice).
   */
  async function request<T>(
    step: string,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) {
    const send = async (token: string) => {
      try {
        return await fetch(`${base}${path}`, {
          method: init.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
          },
          ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
        });
      } catch {
        throw new StorageError('network', 'Couldn’t reach Google Sheets. Check your connection.');
      }
    };
    const isRead = (init.method ?? 'GET') === 'GET';
    let response = await send(await getToken());
    if (response.status === 401) response = await send(await getToken({ renew: true }));
    for (const delay of isRead ? READ_RETRY_DELAYS_MS : []) {
      if (response.status < 500) break;
      await wait(delay);
      response = await send(await getToken());
    }
    if (!response.ok) throw await toStorageError(response, step);
    return (await response.json()) as T;
  }

  async function readTab(): Promise<TabInfo> {
    const fields = 'sheets(properties(sheetId,title,gridProperties(columnCount)))';
    const meta = await request<{
      sheets?: {
        properties: { sheetId: number; title: string; gridProperties?: { columnCount?: number } };
      }[];
    }>('reading the spreadsheet’s tabs', `?fields=${encodeURIComponent(fields)}`);
    const found = meta.sheets?.find((sheet) => sheet.properties.title === tab);
    if (!found) {
      throw new StorageError(
        'sheet',
        `There’s no tab named “${tab}” in this spreadsheet. Change it in Sheet settings.`,
      );
    }
    return {
      sheetId: found.properties.sheetId,
      columnCount: found.properties.gridProperties?.columnCount ?? 0,
    };
  }

  /** The whole tab, freshly read: every write looks rows up by ID at save time. */
  async function read(): Promise<Snapshot> {
    const params = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
    const [tabInfo, values] = await Promise.all([
      readTab(),
      request<{ values?: Cell[][] }>(
        'reading rows',
        `/values/${encodeURIComponent(quotedTab)}?${params}`,
      ),
    ]);
    const parsed = parseSheet(values.values ?? []);
    if ('error' in parsed) throw new StorageError('sheet', parsed.error);
    return { ...parsed, tab: tabInfo };
  }

  function writeValues(
    step: string,
    data: { range: string; values: string[][] }[],
    input: 'USER_ENTERED' | 'RAW',
  ) {
    return request(step, '/values:batchUpdate', {
      method: 'POST',
      body: { valueInputOption: input, data },
    });
  }

  function batchUpdate(step: string, requests: unknown[]) {
    return request(step, ':batchUpdate', { method: 'POST', body: { requests } });
  }

  /** The one row with this ID, or an error saying why there isn't one. */
  function findRow(sheet: Snapshot, id: string): SheetRow {
    if (!isWritableId(id)) {
      throw new StorageError(
        'conflict',
        'This row has no usable ID in the sheet (it’s empty or shared with another row). Fix the ID column, then reload.',
      );
    }
    const rows = rowsWithId(sheet, id);
    if (rows.length > 1) {
      throw new StorageError(
        'conflict',
        `Rows ${rows.map((row) => row.rowNumber).join(', ')} share this row’s ID. Fix the ID column, then reload.`,
      );
    }
    const [row] = rows;
    if (!row) {
      throw new StorageError(
        'not-found',
        'This application is no longer in the sheet. Reload to see the latest.',
      );
    }
    return row;
  }

  function requireColumn(columns: Columns, key: keyof typeof HEADERS): number {
    const index = columns[key];
    if (index === undefined) {
      throw new StorageError(
        'sheet',
        `The sheet has no “${HEADERS[key]}” column. Add it to the header row, then try again.`,
      );
    }
    return index;
  }

  /** Age = days since the Date cell, kept live by the sheet itself, shown as a whole number. */
  async function writeAge(sheet: Snapshot, rowNumber: number) {
    const age = sheet.columns.age;
    const date = sheet.columns.dateApplied;
    if (age === undefined || date === undefined) return;
    await batchUpdate('setting the Age formula', [
      {
        updateCells: {
          start: { sheetId: sheet.tab.sheetId, rowIndex: rowNumber - 1, columnIndex: age },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { formulaValue: `=TODAY()-${columnLetter(date)}${rowNumber}` },
                  userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } },
                },
              ],
            },
          ],
          fields: 'userEnteredValue,userEnteredFormat.numberFormat',
        },
      },
    ]);
  }

  return {
    async list(): Promise<ListResult> {
      const sheet = await read();
      const rowsWithoutId = sheet.rows.filter((row) => !row.sheetId).length;
      const addsColumn = sheet.columns.id === undefined;
      return {
        applications: sheet.rows.map((row) => row.application),
        issues: issuesOf(sheet),
        ...((addsColumn || rowsWithoutId > 0) && { idSetup: { addsColumn, rowsWithoutId } }),
      };
    },

    async add(input: NewApplication): Promise<Application> {
      const sheet = await read();
      requireColumn(sheet.columns, 'id');
      if (input.followedUpDate) requireColumn(sheet.columns, 'followedUpDate');
      if (input.notes) requireColumn(sheet.columns, 'notes');

      const id = crypto.randomUUID();
      const appended = await request<{ updates?: { updatedRange?: string } }>(
        'adding the row',
        `/values/${encodeURIComponent(`${quotedTab}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: { values: [newRowCells(input, id, sheet.columns)] } },
      );
      const application: Application = { ...input, id };

      const rowNumber = rowFromRange(appended.updates?.updatedRange ?? '');
      // Retrying looks the row up again, in case rows moved in the meantime.
      const retryAge = async () => {
        const fresh = await read();
        await writeAge(fresh, findRow(fresh, id).rowNumber);
      };
      try {
        if (rowNumber === null) await retryAge();
        else await writeAge(sheet, rowNumber);
      } catch (error) {
        throw new PartialAddError(application, error, retryAge);
      }
      return application;
    },

    async update(id: string, patch: ApplicationPatch): Promise<Application> {
      const sheet = await read();
      const row = findRow(sheet, id);
      const keys = Object.keys(patch) as (keyof ApplicationPatch)[];
      const data = keys.map((key) => {
        const value = patch[key];
        const column = value ? requireColumn(sheet.columns, key) : sheet.columns[key];
        return column === undefined
          ? null
          : { range: a1(column, row.rowNumber), values: [[cellInput(key, value)]] };
      });
      const writes = data.filter((entry) => entry !== null);
      if (writes.length > 0) await writeValues('saving changes', writes, 'USER_ENTERED');

      // The row as it is now in the sheet, with the saved cells applied.
      // A saved cell is no longer unreadable; an explicit undefined clears a field.
      const unparsed = Object.entries(row.application.unparsed ?? {}).filter(
        ([key]) => !(key in patch),
      );
      const next = {
        ...row.application,
        ...patch,
        id,
        unparsed: unparsed.length > 0 ? Object.fromEntries(unparsed) : undefined,
      };
      return Object.fromEntries(
        Object.entries(next).filter(([, value]) => value !== undefined),
      ) as unknown as Application;
    },

    async remove(id: string): Promise<void> {
      const sheet = await read();
      const row = findRow(sheet, id);
      await batchUpdate('deleting the row', [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.tab.sheetId,
              dimension: 'ROWS',
              startIndex: row.rowNumber - 1,
              endIndex: row.rowNumber,
            },
          },
        },
      ]);
    },

    async setUpIds(): Promise<void> {
      const sheet = await read();
      let idColumn = sheet.columns.id;
      const data: { range: string; values: string[][] }[] = [];
      if (idColumn === undefined) {
        idColumn = sheet.headerWidth;
        if (idColumn >= sheet.tab.columnCount) {
          await batchUpdate('adding the ID column', [
            { appendDimension: { sheetId: sheet.tab.sheetId, dimension: 'COLUMNS', length: 1 } },
          ]);
        }
        data.push({ range: a1(idColumn, 1), values: [[HEADERS.id]] });
      }
      for (const row of sheet.rows) {
        if (!row.sheetId) {
          data.push({ range: a1(idColumn, row.rowNumber), values: [[crypto.randomUUID()]] });
        }
      }
      // RAW: IDs and the header are plain text; nothing for Sheets to interpret.
      if (data.length > 0) await writeValues('writing IDs', data, 'RAW');
    },
  };
}
