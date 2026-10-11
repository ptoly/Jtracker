import { useId, useState, type FormEvent } from 'react';
import { Notice } from '../Notice/Notice';

export type ConnectionMode = 'sample' | 'reconnect' | 'sheet';

export interface ConnectionBarProps {
  /** sample: no sheet chosen. reconnect: a sheet is remembered but there's no sign-in yet. */
  mode: ConnectionMode;
  sheetName?: string;
  tab: string;
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
  onTabChange: (tab: string) => void;
  /** Loads Google's scripts before a click, so the sign-in popup isn't blocked. */
  onPreload?: () => void;
}

/** Which data the app shows, and the controls to connect, reconnect or disconnect a Google Sheet. */
export function ConnectionBar({
  mode,
  sheetName = 'Google Sheet',
  tab,
  sessionExpired = false,
  syncPaused = false,
  busy = false,
  onConnect,
  onReconnect,
  onDisconnect,
  onReload,
  onTabChange,
  onPreload,
}: ConnectionBarProps) {
  const tabInputId = useId();
  const [tabDraft, setTabDraft] = useState(tab);
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

  const disconnect = (
    <button type="button" className="btn" onClick={onDisconnect}>
      Disconnect
    </button>
  );

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
            {disconnect}
          </>
        }
      >
        Reconnect to load <strong>{sheetName}</strong>.
      </Notice>
    );
  }

  function saveTab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = tabDraft.trim();
    if (next && next !== tab) onTabChange(next);
    else setTabDraft(tab);
  }

  return (
    <div className="connection-bar">
      {sessionExpired ? (
        <Notice tone="warning" role="status" actions={primary('Reconnect', onReconnect)}>
          Google sign-in couldn’t renew. Reconnect, then try again.
        </Notice>
      ) : (
        syncPaused && (
          <Notice
            tone="warning"
            role="status"
            actions={
              <button type="button" className="btn" onClick={onReload}>
                Reload now
              </button>
            }
          >
            Google sign-in lasts an hour, so changes made in the sheet since then aren’t loaded.
            Saving still works.
          </Notice>
        )
      )}
      <div className="connection-bar__row">
        <div className="connection-bar__status">
          Connected to <strong className="connection-bar__name">{sheetName}</strong>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, tab </span>
          {tab}
        </div>
        <div className="connection-bar__actions">
          <button type="button" className="btn" onClick={onReload}>
            Reload from sheet
          </button>
          {disconnect}
        </div>
      </div>
      <details className="connection-bar__settings">
        <summary className="connection-bar__summary">Sheet settings</summary>
        <form className="connection-bar__form" onSubmit={saveTab}>
          <div className="connection-bar__field">
            <label htmlFor={tabInputId} className="connection-bar__label">
              Sheet tab name
            </label>
            <input
              id={tabInputId}
              type="text"
              className="connection-bar__input"
              autoComplete="off"
              spellCheck={false}
              value={tabDraft}
              onChange={(event) => setTabDraft(event.target.value)}
            />
          </div>
          <button type="submit" className="btn">
            Save tab
          </button>
        </form>
      </details>
    </div>
  );
}
