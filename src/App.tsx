import { useState } from 'react';
import { ApplicationForm } from './components/ApplicationForm/ApplicationForm';
import { ApplicationsTable } from './components/ApplicationsTable/ApplicationsTable';
import { ConfirmDialog } from './components/ConfirmDialog/ConfirmDialog';
import { ConnectionBar } from './components/ConnectionBar/ConnectionBar';
import { Notice, SaveError } from './components/Notice/Notice';
import { useApplications } from './useApplications';

function pluralizeRows(count: number): string {
  return `${count} row${count === 1 ? '' : 's'}`;
}

export function App() {
  // Calculated once per page load so every derived value agrees, even across midnight.
  const [today] = useState(() => new Date());
  const data = useApplications();
  const { applications, connection, tab, idSetup } = data;

  return (
    <main className="app max-width">
      <h1 className="app__title size-h3">Job Tracker History</h1>

      <ConnectionBar
        key={`${connection?.spreadsheetId ?? 'sample'}-${tab}`}
        mode={data.mode}
        {...(connection && { sheetName: connection.name })}
        tab={tab}
        sessionExpired={data.sessionExpired}
        syncPaused={data.syncPaused}
        busy={data.connecting}
        onConnect={() => void data.connect()}
        onReconnect={() => void data.reconnect()}
        onDisconnect={data.disconnect}
        onReload={() => void data.reload()}
        onTabChange={data.changeTab}
        onPreload={data.preloadGoogle}
      />

      {data.connectError && (
        <SaveError
          className="app__notice"
          error={data.connectError.error}
          fallback="Couldn’t connect to Google."
          retrying={data.connecting}
          onRetry={() => void (data.mode === 'sample' ? data.connect() : data.reconnect())}
        />
      )}

      {data.loadError && (
        <SaveError
          className="app__notice"
          error={data.loadError.error}
          fallback="Couldn’t load the sheet."
          onRetry={() => void data.reload()}
        />
      )}

      {data.issues.length > 0 && (
        <Notice
          tone="warning"
          className="app__notice"
          onDismiss={data.dismissIssues}
          dismissLabel="Dismiss sheet problems"
        >
          {/* Collapsed, so a long list doesn't push the page down. */}
          <details className="notice__details">
            <summary className="notice__summary">
              {pluralizeRows(data.issues.length)} in {tab}{' '}
              {data.issues.length === 1 ? 'needs' : 'need'} a look
            </summary>
            <div className="notice__intro">
              They’re shown in the table as they are in the sheet.
            </div>
            <ul className="notice__list">
              {data.issues.map((issue) => (
                <li key={issue.row}>
                  Row {issue.row}: {issue.problems.join('; ')}
                </li>
              ))}
            </ul>
          </details>
        </Notice>
      )}

      {data.readOnly && !data.setupDialogOpen && (
        <Notice
          tone="warning"
          className="app__notice"
          actions={
            <button type="button" className="btn" onClick={data.reopenSetup}>
              Set up IDs
            </button>
          }
        >
          Read-only. Jtracker needs an ID in every row before it can add, edit or delete.
        </Notice>
      )}

      {data.ageError && (
        <SaveError
          className="app__notice"
          error={data.ageError.error}
          fallback={`Added ${data.ageError.failure.application.company}, but couldn’t set its Age formula.`}
          onRetry={() => void data.retryAge()}
        />
      )}

      {applications ? (
        <>
          <div className="app__top">
            <section className="app__form" aria-labelledby="add-application-heading">
              <div className="app__section-header">
                <h2 id="add-application-heading" className="size-h5">
                  New Job Application
                </h2>
                <p className="app__subtitle">Add new applications here</p>
              </div>
              {data.readOnly ? (
                <p>Adding is off until the sheet has IDs.</p>
              ) : (
                <ApplicationForm applications={applications} today={today} onAdd={data.add} />
              )}
            </section>
            <section className="app__stats" aria-labelledby="stats-heading">
              <div className="app__section-header app__stats-header">
                <h2 id="stats-heading" className="size-h5">
                  Stats
                </h2>
              </div>
              <div className="app__stats-placeholder" />
            </section>
          </div>
          <section className="card card--clip" aria-labelledby="applications-heading">
            <div className="card__header">
              <h2 id="applications-heading" className="size-h5">
                Applications
              </h2>
            </div>
            <ApplicationsTable
              applications={applications}
              today={today}
              onUpdate={data.update}
              onDelete={data.remove}
              readOnly={data.readOnly}
              onEditingChange={data.setTableBusy}
            />
          </section>
        </>
      ) : (
        data.mode !== 'reconnect' && !data.loadError && <p>Loading…</p>
      )}

      <ConfirmDialog
        open={data.setupDialogOpen}
        title="Set up IDs in your sheet?"
        confirmLabel="Add IDs"
        confirmTone="primary"
        onConfirm={data.setUpIds}
        onCancel={data.declineSetup}
      >
        {idSetup && (
          <>
            <p>
              {idSetup.addsColumn
                ? `Jtracker will add an ID column to ${tab}${idSetup.rowsWithoutId > 0 ? ` and fill IDs for ${pluralizeRows(idSetup.rowsWithoutId)}` : ''}.`
                : `Jtracker will fill IDs for ${pluralizeRows(idSetup.rowsWithoutId)} in the ID column of ${tab}.`}
            </p>
            <p>
              IDs let Jtracker find the right row when you edit or delete, even after you sort the
              sheet. Nothing else changes. Without them, the sheet is read-only here.
            </p>
          </>
        )}
      </ConfirmDialog>
    </main>
  );
}
