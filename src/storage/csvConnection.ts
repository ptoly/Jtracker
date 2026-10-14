/**
 * The CSV file the user opened, remembered across reloads. A file handle
 * can't go in localStorage, so it's kept in IndexedDB; the browser asks
 * again for permission to edit the file on a later visit.
 */

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

/** Lets the user pick a .csv. Null when they cancel. */
export async function pickCsvFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null;
  try {
    const [handle] = await window.showOpenFilePicker({
      id: 'jtracker-csv',
      types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
    });
    return handle ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}
