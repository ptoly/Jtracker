import { Notice } from '../Notice/Notice';

export type ConnectionMode = 'sample' | 'reconnect' | 'sheet' | 'csv' | 'csv-reconnect';

export interface ConnectionBarProps {
  /**
   * sample: no sheet or file chosen. reconnect: a sheet is remembered but there's no
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
  /** Renewing the Google sign-in failed; saving needs Reconnect. */
  sessionExpired?: boolean;
  /** The hour-long sign-in ran out while away, so changes in the sheet weren't loaded. */
  syncPaused?: boolean;
  /** Sign-in or the Picker is open. */
  busy?: boolean;
  onConnect: () => void;
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
    return (
      <Notice
        tone="warning"
        className="connection-bar"
        actions={
          onOpenCsv ? (
            <>
              {primary('Open CSV file', onOpenCsv)}
              <button type="button" className="btn" onClick={onConnect} {...preload}>
                Connect Google Sheet
              </button>
            </>
          ) : (
            primary('Connect Google Sheet', onConnect)
          )
        }
      >
        {onOpenCsv
          ? 'Sample data. Open your CSV file or connect a Google Sheet to use your own.'
          : 'Sample data. Connect your Google Sheet to use your own.'}
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
