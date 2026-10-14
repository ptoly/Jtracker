import { useRef, useState } from 'react';
import {
  ApplicationForm,
  type ApplicationFormHandle,
  type ApplicationPrefill,
} from './components/ApplicationForm/ApplicationForm';
import {
  ApplicationsTable,
  type ApplicationsTableHandle,
} from './components/ApplicationsTable/ApplicationsTable';
import { ConfirmDialog } from './components/ConfirmDialog/ConfirmDialog';
import { ConnectionBar } from './components/ConnectionBar/ConnectionBar';
import { SheetActions } from './components/ConnectionBar/SheetActions';
import { Notice, SaveError } from './components/Notice/Notice';
import { PositionsDialog } from './components/PositionsDialog/PositionsDialog';
import { ScrollTop } from './components/ScrollTop/ScrollTop';
import { isFollowUpDue } from './lib/derive';
import { suggestedPositions } from './lib/positions';
import type { Application } from './types/application';
import { useApplications } from './useApplications';
import logoUrl from './assets/jtracker-logo.svg';

function pluralizeRows(count: number): string {
  return `${count} row${count === 1 ? '' : 's'}`;
}

/**
 * The page title's summary, e.g. "296 applications", "155 need follow-up",
 * "1 interview". Counted the same way as the table's tabs.
 */
function searchSummary(applications: Application[], today: Date): string[] {
  const due = applications.filter((app) => isFollowUpDue(app, undefined, today)).length;
  const interviews = applications.filter((app) => app.status === 'Interviewed').length;
  return [
    `${applications.length} application${applications.length === 1 ? '' : 's'}`,
    `${due} ${due === 1 ? 'needs' : 'need'} follow-up`,
    `${interviews} interview${interviews === 1 ? '' : 's'}`,
  ];
}

export function App() {
  // Calculated once per page load so every derived value agrees, even across midnight.
  const [today] = useState(() => new Date());
  const data = useApplications();
  const { applications, connection, tab, idSetup } = data;
  const [positionsOpen, setPositionsOpen] = useState(false);
  const formRef = useRef<ApplicationFormHandle>(null);
  const tableRef = useRef<ApplicationsTableHandle>(null);

  const positions = applications ? suggestedPositions(applications, data.positions) : [];

  // The add form's title, inside its card.
  const addHeader = (
    <div className="app__section-header">
      <div>
        <h2 id="add-application-heading" className="size-h4">
          Check/Add Job Application
        </h2>
        <p className="app__subtitle">
          Enter the company name. If you’ve applied there before, your past application(s) appear.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner max-width">
          <a href="/" className="site-header__home">
            <img
              src={logoUrl}
              width={140}
              height={40}
              alt="Jtracker"
              className="site-header__logo"
            />
          </a>
        </div>
      </header>

      <main className="app max-width">
        {/* The page title on the left, the add form on the right; stacked when narrow. */}
        <div className="app__intro">
          <div className="app__page-header has-divider">
            {/* Focusable from script: "Back to top" lands here. */}
            <h1 id="page-top" tabIndex={-1}>
              Your job search
            </h1>
            {applications && (
              <p className="app__subtitle">
                {searchSummary(applications, today).map((part, index) => (
                  <span key={part}>
                    {/* A dot between the counts on screen; a comma for screen readers. */}
                    {index > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                      </>
                    )}
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>

          {applications && (
            <section aria-labelledby="add-application-heading">
              {data.readOnly ? (
                <div className="card">
                  <div className="card__body">
                    {addHeader}
                    <p>Adding is off until the sheet has IDs.</p>
                  </div>
                </div>
              ) : (
                <ApplicationForm
                  ref={formRef}
                  applications={applications}
                  positions={positions}
                  today={today}
                  header={addHeader}
                  onAdd={async (input) => {
                    await data.add(input);
                    // Show the whole table, newest first, so the new row is on top.
                    tableRef.current?.showLatest();
                  }}
                  onManagePositions={() => setPositionsOpen(true)}
                />
              )}
            </section>
          )}
        </div>

        <ConnectionBar
          mode={data.mode}
          {...(connection && { sheetName: connection.name })}
          sessionExpired={data.sessionExpired}
          syncPaused={data.syncPaused}
          busy={data.connecting}
          onConnect={() => void data.connect()}
          onReconnect={() => void data.reconnect()}
          onDisconnect={data.disconnect}
          onReload={() => void data.reload()}
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
            <section aria-labelledby="applications-heading">
              <div className="app__section-header has-divider">
                <div>
                  <h2 id="applications-heading">Applications History</h2>
                  <p className="app__subtitle">
                    {connection ? (
                      <>
                        Connected to <strong className="app__sheet-name">{connection.name}</strong>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, tab </span>
                        {tab}
                      </>
                    ) : (
                      'Sample data'
                    )}
                  </p>
                </div>
                {data.mode === 'sheet' && (
                  <SheetActions
                    tab={tab}
                    onReload={() => void data.reload()}
                    onDisconnect={data.disconnect}
                    onTabChange={data.changeTab}
                  />
                )}
              </div>

              {data.issues.length > 0 && (
                <Notice
                  tone="warning"
                  className="app__notice"
                  onDismiss={data.dismissIssues}
                  dismissLabel="Dismiss sheet problems"
                >
                  {/* Collapsed, so a long list doesn't push the page down. */}
                  <details className="notice__details">
                    <summary>
                      {pluralizeRows(data.issues.length)} in {tab}{' '}
                      {data.issues.length === 1 ? 'needs' : 'need'} a look
                    </summary>
                    <div className="notice__intro">
                      They’re shown in the table as they are in the sheet.
                    </div>
                    <ul className="bullets notice__list">
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

              <ApplicationsTable
                ref={tableRef}
                applications={applications}
                today={today}
                onUpdate={data.update}
                onDelete={data.remove}
                readOnly={data.readOnly}
                onEditingChange={data.setTableBusy}
                positions={positions}
                {...(!data.readOnly && {
                  onAddForSearch: (fill: ApplicationPrefill) => formRef.current?.prefill(fill),
                })}
              />
            </section>
          </>
        ) : (
          data.mode !== 'reconnect' && !data.loadError && <p>Loading…</p>
        )}

        {applications && (
          <PositionsDialog
            open={positionsOpen}
            onClose={() => setPositionsOpen(false)}
            applications={applications}
            positions={data.positions}
            onUpdate={data.updatePositions}
            onRename={data.renamePosition}
            readOnly={data.readOnly}
          />
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

      <ScrollTop targetId="page-top" />
    </>
  );
}
