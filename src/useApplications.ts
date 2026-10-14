import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken, hasValidToken, preloadAuth, signIn, signOut } from './google/auth';
import { pickSpreadsheet, preloadPicker } from './google/picker';
import {
  createCsvFileAdapter,
  createGoogleSheetsAdapter,
  PartialAddError,
  sampleAdapter,
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
  loadCsvHandle,
  pickCsvFile,
  saveCsvHandle,
} from './storage/csvConnection';
import type { Application, ApplicationPatch, NewApplication } from './types/application';
import type { ConnectionMode } from './components/ConnectionBar/ConnectionBar';
import { EMPTY_POSITION_LIST } from './lib/positions';

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
  const [connection, setConnection] = useState(loadConnection);
  // The CSV file from last time is looked up before anything loads.
  const [csvChecked, setCsvChecked] = useState(!canOpenCsvFiles);
  const [csvFile, setCsvFile] = useState<FileSystemFileHandle | null>(null);
  // The browser asks again on a later visit before Jtracker can use the file.
  const [csvAllowed, setCsvAllowed] = useState(false);
  const [csvError, setCsvError] = useState<{ error: unknown; retry: () => void } | null>(null);
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
      ? sampleAdapter
      : (csvAdapter ?? sheetAdapter);

  // A CSV file opened last time: use it again if the browser still allows it.
  useEffect(() => {
    if (!canOpenCsvFiles) return;
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
  }, [adapter]);

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

  /** Picks a CSV file and asks to edit it; it replaces sample data or a sheet. */
  async function openCsv() {
    setCsvError(null);
    try {
      const handle = await pickCsvFile();
      if (!handle) return;
      const allowed = await allowCsvEdits(handle);
      await saveCsvHandle(handle);
      resetData();
      setCsvFile(handle);
      setCsvAllowed(allowed);
    } catch (error) {
      setCsvError({ error, retry: () => void openCsv() });
    }
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
    canOpenCsv: canOpenCsvFiles,
    csvError,
    openCsv,
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
