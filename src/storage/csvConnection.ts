/**
 * The CSV file the user opened, remembered across reloads. A file handle
 * can't go in localStorage, so it's kept in IndexedDB; the browser asks
 * again for permission to edit the file on a later visit.
 */

import { toCsv } from './csv';
import { HEADERS } from './sheetRows';

/** A new file's columns, in the Sheet's order (no Age: Jtracker calculates it). */
const NEW_FILE_HEADER = [
  HEADERS.dateApplied,
  HEADERS.company,
  HEADERS.position,
  HEADERS.status,
  HEADERS.followedUpDate,
  HEADERS.notes,
  HEADERS.id,
];

const DB_NAME = 'jtracker';
const STORE = 'files';
const KEY = 'csv';

/** Chrome, Edge and Opera on desktop can open a file and save back to it. */
export const canOpenCsvFiles = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'));
  });
}

async function run<T>(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pending = request(db.transaction(STORE, mode).objectStore(STORE));
      pending.onsuccess = () => resolve(pending.result);
      pending.onerror = () => reject(pending.error ?? new Error('IndexedDB failed'));
    });
  } finally {
    db.close();
  }
}

export async function loadCsvHandle(): Promise<FileSystemFileHandle | null> {
  if (!canOpenCsvFiles) return null;
  try {
    const value: unknown = await run('readonly', (store) => store.get(KEY));
    return value instanceof FileSystemFileHandle ? value : null;
  } catch {
    return null;
  }
}

export async function saveCsvHandle(handle: FileSystemFileHandle): Promise<void> {
  await run('readwrite', (store) => store.put(handle, KEY));
}

export async function clearCsvHandle(): Promise<void> {
  await run('readwrite', (store) => store.delete(KEY));
}

/** Asks for (or confirms) permission to save to the file. Needs a click when it asks. */
export async function allowCsvEdits(handle: FileSystemFileHandle): Promise<boolean> {
  const descriptor = { mode: 'readwrite' } as const;
  if ((await handle.queryPermission(descriptor)) === 'granted') return true;
  return (await handle.requestPermission(descriptor)) === 'granted';
}

const CSV_TYPES = [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }];

/** Null when the user cancels a picker; other failures are thrown. */
async function unlessCancelled<T>(pick: () => Promise<T>): Promise<T | null> {
  try {
    return await pick();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

/** Lets the user pick a .csv. Null when they cancel. */
export async function pickCsvFile(): Promise<FileSystemFileHandle | null> {
  const { showOpenFilePicker } = window;
  if (!showOpenFilePicker) return null;
  const handles = await unlessCancelled(() =>
    showOpenFilePicker({ id: 'jtracker-csv', types: CSV_TYPES }),
  );
  return handles?.[0] ?? null;
}

/**
 * Lets the user save a new .csv with just Jtracker's header row, ready to
 * add to. Null when they cancel. (Choosing an existing file replaces it;
 * the browser asks first.)
 */
export async function createCsvFile(): Promise<FileSystemFileHandle | null> {
  const { showSaveFilePicker } = window;
  if (!showSaveFilePicker) return null;
  const handle = await unlessCancelled(() =>
    showSaveFilePicker({
      id: 'jtracker-csv',
      suggestedName: 'Job applications.csv',
      types: CSV_TYPES,
    }),
  );
  if (!handle) return null;
  const writable = await handle.createWritable();
  await writable.write(toCsv([NEW_FILE_HEADER]));
  await writable.close();
  return handle;
}
