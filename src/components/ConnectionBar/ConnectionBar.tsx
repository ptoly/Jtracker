import { Notice } from '../Notice/Notice';

export type ConnectionMode = 'sample' | 'reconnect' | 'sheet';

export interface ConnectionBarProps {
  /** sample: no sheet chosen. reconnect: a sheet is remembered but there's no sign-in yet. */
  mode: ConnectionMode;
  sheetName?: string;
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
 * Reconnect, or a sign-in that ran out. Renders nothing while a sheet is
 * connected and signed in; the sheet's own controls are in SheetActions.
 */
export function ConnectionBar({
  mode,
  sheetName = 'Google Sheet',
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
        actions={primary('Connect Google Sheet', onConnect)}
      >
        Sample data. Connect your Google Sheet to use your own.
      </Notice>
    );
  }

  if (mode === 'reconnect') {
    return (
      <Notice
        tone="warning"
        className="connection-bar"
        actions={
          <>
            {primary('Reconnect', onReconnect)}
            <button type="button" className="btn" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        }
      >
        Reconnect to load <strong>{sheetName}</strong>.
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
