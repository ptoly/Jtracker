/** The chosen spreadsheet, remembered across reloads. Never tokens or row data. */
export interface SheetConnection {
  spreadsheetId: string;
  name: string;
  tab: string;
}

export const DEFAULT_TAB = 'Sheet1';
const KEY = 'jtracker.sheet';

export function loadConnection(): SheetConnection | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { spreadsheetId, name, tab } = value as Record<string, unknown>;
    if (typeof spreadsheetId !== 'string' || !spreadsheetId) return null;
    return {
      spreadsheetId,
      name: typeof name === 'string' ? name : 'Google Sheet',
      tab: typeof tab === 'string' && tab.trim() ? tab : DEFAULT_TAB,
    };
  } catch {
    return null;
  }
}

export function saveConnection(connection: SheetConnection): void {
  localStorage.setItem(KEY, JSON.stringify(connection));
}

export function clearConnection(): void {
  localStorage.removeItem(KEY);
}
