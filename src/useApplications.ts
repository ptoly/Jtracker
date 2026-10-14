import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken, hasValidToken, preloadAuth, signIn, signOut } from './google/auth';
import { pickSpreadsheet, preloadPicker } from './google/picker';
import {
  createCsvFileAdapter,
  createGoogleSheetsAdapter,
  createSampleAdapter,
  PartialAddError,
  StorageError,
  type IdSetup,
  type PositionList,
  type RowIssue,
  type StorageAdapter,
} from './storage';
import {
  clearConnection,
  DEFAULT_TAB,
  loadConnection,
  saveConnection,
  type SheetConnection,
} from './storage/sheetConnection';
import {
  allowCsvEdits,
  canOpenCsvFiles,
  clearCsvHandle,
  createCsvFile,
  loadCsvHandle,
  pickCsvFile,
  saveCsvHandle,
} from './storage/csvConnection';
import { applicationsToCsv, csvToApplications, type CsvImport } from './storage/csvRows';
import { createDemoAdapter } from './storage/demoAdapter';
import { toIsoDate } from './lib/dates';
import { storageOptions } from './storageOptions';
import type { Application, ApplicationPatch, NewApplication } from './types/application';
import type { ConnectionMode } from './components/ConnectionBar/ConnectionBar';
import { EMPTY_POSITION_LIST } from './lib/positions';

const google = storageOptions.has('google');
// Open CSV file needs a browser that can save to a file; elsewhere it's Import / Export.
const canOpenCsv = storageOptions.has('csv') && canOpenCsvFiles;
const canImportCsv = storageOptions.has('csv') && !canOpenCsvFiles;

/** Focus can fire several times in a row; one reload is enough. */
const MIN_RELOAD_INTERVAL_MS = 5000;

function isAuthError(error: unknown): boolean {
  return error instanceof StorageError && error.kind === 'auth';
}

/** Loads Google's scripts early; failures surface later, on click. */
function preloadGoogle() {
  void preloadAuth().catch(() => undefined);
  void preloadPicker().catch(() => undefined);
}

/**
 * Where the applications come from (sample data, a CSV file on this computer,
 * or the connected Google Sheet), and everything that keeps them in step:
 * loading, saving, sign-in or file permission, and reloading when the window
 * regains focus. An open CSV file takes the place of a sheet.
 */
export function useApplications(today: Date) {
  // With no sheet or file chosen: the demo (sample data kept in this browser), or an
  // empty list when this build doesn't offer the demo.
  const demo = useMemo(
    () => (storageOptions.has('demo') ? createDemoAdapter({ today }) : null),
    [today],
  );
  const emptyAdapter = useMemo(() => createSampleAdapter([]), []);
  // The imported file's name; null while the demo shows sample data.
  const [demoSource, setDemoSource] = useState(() => demo?.source() ?? null);
  const [pendingImport, setPendingImport] = useState<(CsvImport & { name: string }) | null>(null);
  // A remembered sheet only counts when this build offers Google.
  const [connection, setConnection] = useState(() => (google ? loadConnection() : null));
  // The CSV file from last time is looked up before anything loads.
  const [csvChecked, setCsvChecked] = useState(!canOpenCsv);
  const [csvFile, setCsvFile] = useState<FileSystemFileHandle | null>(null);
  // The browser asks again on a later visit before Jtracker can use the file.
  const [csvAllowed, setCsvAllowed] = useState(false);
  const [csvError, setCsvError] = useState<{ error: unknown; retry: () => void } | null>(null);
  // A new file made while another is open: the user chooses which to keep using.
  const [newCsvFile, setNewCsvFile] = useState<FileSystemFileHandle | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Renewing failed (popup blocked or refused): saving needs Reconnect.
  const [sessionExpired, setSessionExpired] = useState(false);
  // The hour-long token ran out while the window was away, so focus couldn't reload.
  // Not an error: the next click that talks to Google (a save, Reload) renews it.
  const [syncPaused, setSyncPaused] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<{ error: unknown } | null>(null);

  const [applications, setApplications] = useState<Application[] | null>(null);
  const [issues, setIssues] = useState<RowIssue[]>([]);
  const [positions, setPositions] = useState<PositionList>(EMPTY_POSITION_LIST);
  const [dismissedIssues, setDismissedIssues] = useState('');
  const [idSetup, setIdSetup] = useState<IdSetup | null>(null);
  const [setupDeclined, setSetupDeclined] = useState(false);
  const [loadError, setLoadError] = useState<{ error: unknown } | null>(null);
  const [ageError, setAgeError] = useState<{ failure: PartialAddError; error: unknown } | null>(
    null,
  );

  // Read by the focus listener, never during render.
  const loadSeq = useRef(0);
  const lastLoad = useRef(0);
  const pendingWrites = useRef(0);
  const tableBusy = useRef(false);

  const mode: ConnectionMode = csvFile
    ? csvAllowed
      ? 'csv'
      : 'csv-reconnect'
    : !connection
      ? 'sample'
      : signedIn
        ? 'sheet'
        : 'reconnect';
  const spreadsheetId = connection?.spreadsheetId;
  const tab = connection?.tab ?? DEFAULT_TAB;

  const sheetAdapter = useMemo(
    () =>
      mode === 'sheet' && spreadsheetId
        ? createGoogleSheetsAdapter({ spreadsheetId, tab, getToken })
        : null,
    [mode, spreadsheetId, tab],
  );
  const csvAdapter = useMemo(
    () => (mode === 'csv' && csvFile ? createCsvFileAdapter({ handle: csvFile, today }) : null),
    [mode, csvFile, today],
  );
  const adapter: StorageAdapter | null = !csvChecked
    ? null
    : mode === 'sample'
      ? (demo ?? emptyAdapter)
      : (csvAdapter ?? sheetAdapter);

  // A CSV file opened last time: use it again if the browser still allows it.
  useEffect(() => {
    if (!canOpenCsv) return;
    let current = true;
    void (async () => {
      const handle = await loadCsvHandle();
      if (!current) return;
      if (handle) {
        const allowed = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
        if (!current) return;
        setCsvFile(handle);
        setCsvAllowed(allowed);
      }
      setCsvChecked(true);
    })();
    return () => {
      current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!adapter) return;
    const seq = ++loadSeq.current;
    lastLoad.current = Date.now();
    try {
      const result = await adapter.list();
      if (seq !== loadSeq.current) return;
      setApplications(result.applications);
      if (adapter === demo) setDemoSource(demo.source());
      setIssues(result.issues);
      setPositions(result.positions);
      setIdSetup(result.idSetup ?? null);
      setLoadError(null);
      setSyncPaused(false);
      setSessionExpired(false);
    } catch (error) {
      if (seq !== loadSeq.current) return;
      if (isAuthError(error)) setSessionExpired(true);
      setLoadError({ error });
    }
  }, [adapter, demo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A sheet is remembered from last time: get Google's scripts ready for Reconnect.
  useEffect(() => {
    if (mode === 'reconnect') preloadGoogle();
  }, [mode]);

  // Pick up changes made in the sheet (or the file) when the user comes back to the window.
  useEffect(() => {
    if (mode !== 'sheet' && mode !== 'csv') return;
    function sync() {
      if (document.visibilityState !== 'visible') return;
      if (tableBusy.current || pendingWrites.current > 0) return;
      if (Date.now() - lastLoad.current < MIN_RELOAD_INTERVAL_MS) return;
      // Renewing opens a popup, which browsers block outside a click. Wait for one.
      if (mode === 'sheet' && !hasValidToken()) {
        setSyncPaused(true);
        return;
      }
      void reload();
    }
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [mode, reload]);

  /** Runs a write; marks the session expired on an auth failure. Rethrows so callers keep their input. */
  async function write<T>(run: (target: StorageAdapter) => Promise<T>): Promise<T> {
    if (!adapter) throw new StorageError('auth', 'Reconnect your Google Sheet, then try again.');
    pendingWrites.current += 1;
    try {
      const result = await run(adapter);
      // The save renewed the token if it had to: catch up on what focus skipped.
      setSessionExpired(false);
      if (syncPaused) void reload();
      return result;
    } catch (error) {
      if (isAuthError(error) && mode === 'sheet') setSessionExpired(true);
      // The browser took back permission to edit the file: ask again.
      if (isAuthError(error) && mode === 'csv') setCsvAllowed(false);
      throw error;
    } finally {
      pendingWrites.current -= 1;
    }
  }

  async function add(input: NewApplication) {
    try {
      const added = await write((target) => target.add(input));
      setApplications((prev) => [...(prev ?? []), added]);
    } catch (error) {
      // The row is in the sheet; only its Age formula is missing.
      if (error instanceof PartialAddError) {
        setApplications((prev) => [...(prev ?? []), error.application]);
        setAgeError({ failure: error, error });
        return;
      }
      throw error;
    }
  }

  async function retryAge() {
    if (!ageError) return;
    try {
      await write(() => ageError.failure.retry());
      setAgeError(null);
    } catch (error) {
      setAgeError({ failure: ageError.failure, error });
    }
  }

  async function update(id: string, patch: ApplicationPatch) {
    const updated = await write((target) => target.update(id, patch));
    setApplications((prev) => (prev ?? []).map((app) => (app.id === id ? updated : app)));
    return updated;
  }

  async function remove(id: string) {
    await write((target) => target.remove(id));
    setApplications((prev) => (prev ?? []).filter((app) => app.id !== id));
  }

  /** Applies a change to the position list as it is in storage now. */
  async function updatePositions(change: (current: PositionList) => PositionList) {
    setPositions(await write((target) => target.updatePositions(change)));
  }

  /** Renames a position on every application that uses it; returns how many changed. */
  async function renamePosition(from: string, to: string) {
    const result = await write((target) => target.renamePosition(from, to));
    setPositions(result.positions);
    await reload();
    return result.changed;
  }

  async function setUpIds() {
    if (!sheetAdapter) return;
    await write(() => sheetAdapter.setUpIds());
    await reload();
  }

  /** Clears what belonged to the previous data source. */
  function resetData() {
    loadSeq.current += 1;
    setApplications(null);
    setIssues([]);
    setPositions(EMPTY_POSITION_LIST);
    setIdSetup(null);
    setSetupDeclined(false);
    setLoadError(null);
    setAgeError(null);
  }

  async function connect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const token = await signIn();
      setSignedIn(true);
      setSessionExpired(false);
      const picked = await pickSpreadsheet(token);
      if (!picked) return;
      const next: SheetConnection = { spreadsheetId: picked.id, name: picked.name, tab };
      saveConnection(next);
      resetData();
      setConnection(next);
    } catch (error) {
      setConnectError({ error });
    } finally {
      setConnecting(false);
    }
  }

  async function reconnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await signIn();
      setSignedIn(true);
      setSessionExpired(false);
    } catch (error) {
      setConnectError({ error });
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    signOut();
    clearConnection();
    resetData();
    setSignedIn(false);
    setSessionExpired(false);
    setConnectError(null);
    setConnection(null);
  }

  /** Switches to a CSV file once the browser allows edits; it replaces sample data, a sheet or another file. */
  async function switchToCsv(
    choose: () => Promise<FileSystemFileHandle | null>,
    retry: () => void,
  ) {
    setCsvError(null);
    try {
      const handle = await choose();
      if (!handle) return;
      const allowed = await allowCsvEdits(handle);
      await saveCsvHandle(handle);
      resetData();
      setCsvFile(handle);
      setCsvAllowed(allowed);
    } catch (error) {
      setCsvError({ error, retry });
    }
  }

  /** Picks an existing CSV file. */
  function openCsv() {
    return switchToCsv(pickCsvFile, () => void openCsv());
  }

  /**
   * Saves a new CSV file with just the header row. With no file open it's
   * used straight away; with one open, the user picks which to keep using.
   */
  async function newCsv() {
    if (!csvFile) return switchToCsv(createCsvFile, () => void newCsv());
    setCsvError(null);
    try {
      setNewCsvFile(await createCsvFile());
    } catch (error) {
      setCsvError({ error, retry: () => void newCsv() });
    }
  }

  /** Switches to the file just created (the old one stays on disk as it is). */
  async function switchToNewCsv() {
    const handle = newCsvFile;
    setNewCsvFile(null);
    if (handle)
      await switchToCsv(
        async () => handle,
        () => void switchToNewCsv(),
      );
  }

  /** On a later visit: the browser asks once more before Jtracker edits the file. */
  async function allowCsv() {
    if (!csvFile) return;
    setCsvError(null);
    try {
      setCsvAllowed(await allowCsvEdits(csvFile));
    } catch (error) {
      setCsvError({ error, retry: () => void allowCsv() });
    }
  }

  /** Stops using the file (it stays on disk as it is) and goes back to sample data or the sheet. */
  function closeCsv() {
    void clearCsvHandle().catch(() => undefined);
    resetData();
    setCsvFile(null);
    setCsvAllowed(false);
    setCsvError(null);
  }

  /** Fresh sample data in place of everything in the demo (after the user confirms). */
  async function resetDemo() {
    if (!demo) return;
    await demo.reset();
    setDismissedIssues('');
    await reload();
  }

  /** Reads a CSV file the user chose (Import CSV); the import waits for them to confirm. */
  async function importCsv(file: File) {
    setCsvError(null);
    try {
      const result = csvToApplications(await file.text(), today);
      if ('error' in result) throw new StorageError('sheet', result.error);
      setPendingImport({ name: file.name, ...result });
    } catch (error) {
      setCsvError({ error, retry: () => void importCsv(file) });
    }
  }

  /** The confirmed import: the file's applications replace the demo's. */
  async function confirmImport() {
    if (!demo || !pendingImport) return;
    await demo.replaceWith(pendingImport);
    setPendingImport(null);
    await reload();
  }

  /** Downloads the applications as a CSV file in the new-file columns (Export CSV). */
  function exportCsv() {
    if (!applications) return;
    const blob = new Blob([applicationsToCsv(applications)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jtracker-applications-${toIsoDate(today)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function changeTab(nextTab: string) {
    if (!connection) return;
    const next = { ...connection, tab: nextTab };
    saveConnection(next);
    resetData();
    setConnection(next);
  }

  const issuesKey = JSON.stringify(issues);

  return {
    mode,
    connection,
    /** The open CSV file's name, e.g. "Job hunt.csv". */
    csvName: csvFile?.name ?? null,
    canOpenCsv,
    canImportCsv,
    google,
    /** The demo: whether it can keep changes, and what it holds (null: sample data). */
    demo: demo && { persistent: demo.persistent, source: demoSource },
    resetDemo,
    importCsv,
    /** Set while the user confirms an import. */
    pendingImport: pendingImport && {
      name: pendingImport.name,
      count: pendingImport.applications.length,
    },
    confirmImport,
    cancelImport: () => setPendingImport(null),
    exportCsv,
    csvError,
    openCsv,
    newCsv,
    /** Set while the user chooses between a new file and the open one. */
    newCsvName: newCsvFile?.name ?? null,
    switchToNewCsv,
    keepCurrentCsv: () => setNewCsvFile(null),
    allowCsv,
    closeCsv,
    tab,
    applications,
    /** Problems in the loaded rows, unless the user dismissed this same list. */
    issues: issuesKey === dismissedIssues ? [] : issues,
    dismissIssues: () => setDismissedIssues(issuesKey),
    loadError,
    ageError,
    retryAge,
    /** The sheet needs IDs before Jtracker can write; until then it's read-only. */
    idSetup,
    setupDialogOpen: mode === 'sheet' && idSetup !== null && !setupDeclined,
    readOnly: mode === 'sheet' && idSetup !== null,
    declineSetup: () => setSetupDeclined(true),
    reopenSetup: () => setSetupDeclined(false),
    setUpIds,
    sessionExpired,
    syncPaused,
    connecting,
    connectError,
    connect,
    reconnect,
    disconnect,
    changeTab,
    reload,
    preloadGoogle,
    add,
    update,
    remove,
    positions,
    updatePositions,
    renamePosition,
    /** From the table: a row is being edited or a delete confirmed; don't reload under it. */
    setTableBusy: useCallback((busy: boolean) => {
      tableBusy.current = busy;
    }, []),
  };
}
