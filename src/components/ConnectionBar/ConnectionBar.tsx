import { useId, type ReactNode } from 'react';
import { Notice } from '../Notice/Notice';

export type ConnectionMode = 'sample' | 'reconnect' | 'sheet' | 'csv' | 'csv-reconnect';

export interface ConnectionBarProps {
  /**
   * sample: no sheet or file chosen (the demo, when the build offers it). reconnect: a sheet is remembered but there's no
   * sign-in yet. csv-reconnect: a CSV file is remembered, but the browser asks again
   * before Jtracker can edit it.
   */
  mode: ConnectionMode;
  sheetName?: string;
  fileName?: string;
  /** Shows "Open CSV file" with sample data or a sheet to reconnect (browsers that can save to a file). */
  onOpenCsv?: () => void;
  onAllowCsv?: () => void;
  onCloseCsv?: () => void;
  /**
   * The demo's data, kept in this browser: whether it can keep changes, and
   * the imported file's name (null: the sample data). Absent: no demo.
   */
  demo?: { persistent: boolean; source: string | null } | null;
  /** Shows "Reset sample data" (the owner confirms first). */
  onResetDemo?: () => void;
  /** Shows "Import CSV" (browsers that can't save to a file) with the file chosen. */
  onImportCsv?: (file: File) => void;
  /** Shows "Export CSV". */
  onExportCsv?: () => void;
  /** Renewing the Google sign-in failed; saving needs Reconnect. */
  sessionExpired?: boolean;
  /** The hour-long sign-in ran out while away, so changes in the sheet weren't loaded. */
  syncPaused?: boolean;
  /** Sign-in or the Picker is open. */
  busy?: boolean;
  /** Shows "Connect Google Sheet" (builds that offer Google). */
  onConnect?: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onReload: () => void;
  /** Loads Google's scripts before a click, so the sign-in popup isn't blocked. */
  onPreload?: () => void;
}

/**
 * Banners about where the data comes from: sample data, a sheet waiting for
 * Reconnect, a CSV file waiting for permission, or a sign-in that ran out.
 * Renders nothing while a sheet or file is in use; their own controls sit
 * by the table.
 */
export function ConnectionBar({
  mode,
  sheetName = 'Google Sheet',
  fileName = 'your CSV file',
  onOpenCsv,
  onAllowCsv,
  onCloseCsv,
  demo,
  onResetDemo,
  onImportCsv,
  onExportCsv,
  sessionExpired = false,
  syncPaused = false,
  busy = false,
  onConnect,
  onReconnect,
  onDisconnect,
  onReload,
  onPreload,
}: ConnectionBarProps) {
  const preload = onPreload && { onPointerEnter: onPreload, onFocus: onPreload };
  const fileInputId = `${useId()}-import`;

  function primary(label: string, onClick: () => void) {
    return (
      <button
        type="button"
        className="btn btn--primary"
        aria-disabled={busy}
        onClick={() => {
          if (!busy) onClick();
        }}
        {...preload}
      >
        {label}
      </button>
    );
  }

  if (mode === 'sample') {
    // The choices this build and browser offer, in order; the first is the primary button.
    const actions: { label: string; onClick: () => void; google?: boolean }[] = [
      ...(onOpenCsv ? [{ label: 'Open CSV file', onClick: onOpenCsv }] : []),
      ...(onImportCsv
        ? [{ label: 'Import CSV', onClick: () => document.getElementById(fileInputId)?.click() }]
        : []),
      ...(onExportCsv ? [{ label: 'Export CSV', onClick: onExportCsv }] : []),
      ...(onConnect ? [{ label: 'Connect Google Sheet', onClick: onConnect, google: true }] : []),
      ...(onResetDemo ? [{ label: 'Reset sample data', onClick: onResetDemo }] : []),
    ];
    const [first, ...rest] = actions;

    let message: ReactNode;
    if (!demo) {
      message = onOpenCsv
        ? 'Open your CSV file to get started.'
        : 'Import a CSV file to get started.';
    } else {
      const kept = demo.persistent
        ? 'Your changes stay in this browser.'
        : 'This browser won’t let Jtracker keep data, so changes last until you reload.';
      message = demo.source ? (
        <>
          Your applications from <strong>{demo.source}</strong>. {kept}
          {onExportCsv && ' Export CSV to save a copy.'}
        </>
      ) : (
        `Demo with sample data. ${kept}`
      );
    }

    return (
      <Notice
        tone="warning"
        className="connection-bar"
        actions={
          <>
            {first && primary(first.label, first.onClick)}
            {rest.map((action) => (
              <button
                key={action.label}
                type="button"
                className="btn"
                onClick={action.onClick}
                {...(action.google && preload)}
              >
                {action.label}
              </button>
            ))}
            {onImportCsv && (
              // Opened by Import CSV; not a tab stop of its own.
              <input
                id={fileInputId}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) onImportCsv(file);
                }}
              />
            )}
          </>
        }
      >
        {message}
      </Notice>
    );
  }

  if (mode === 'csv-reconnect') {
    return (
      <Notice
        tone="warning"
        className="connection-bar"
        actions={
          <>
            {onAllowCsv && primary('Allow', onAllowCsv)}
            {onCloseCsv && (
              <button type="button" className="btn" onClick={onCloseCsv}>
                Close file
              </button>
            )}
          </>
        }
      >
        Allow Jtracker to open and save <strong>{fileName}</strong> again.
      </Notice>
    );
  }

  if (mode === 'csv') return null;

  if (mode === 'reconnect') {
    return (
      <Notice
        tone="warning"
        className="connection-bar"
        actions={
          <>
            {primary('Reconnect', onReconnect)}
            {onOpenCsv && (
              <button type="button" className="btn" onClick={onOpenCsv}>
                Open CSV file
              </button>
            )}
            <button type="button" className="btn" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        }
      >
        Reconnect to load <strong>{sheetName}</strong>
        {onOpenCsv ? ', or open a CSV file instead.' : '.'}
      </Notice>
    );
  }

  if (sessionExpired) {
    return (
      <Notice
        tone="warning"
        role="status"
        className="connection-bar"
        actions={primary('Reconnect', onReconnect)}
      >
        Google sign-in couldn’t renew. Reconnect, then try again.
      </Notice>
    );
  }

  if (syncPaused) {
    return (
      <Notice
        tone="warning"
        role="status"
        className="connection-bar"
        actions={
          <button type="button" className="btn" onClick={onReload}>
            Reload now
          </button>
        }
      >
        Google sign-in lasts an hour, so changes made in the sheet since then aren’t loaded. Saving
        still works.
      </Notice>
    );
  }

  return null;
}
