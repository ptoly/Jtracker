import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { distinctPositions } from '../../lib/applicationRules';
import { toIsoDate } from '../../lib/dates';
import { ageInDays, DEFAULT_FOLLOW_UP_DAYS, isFollowUpDue } from '../../lib/derive';
import type { Application, ApplicationPatch, Status } from '../../types/application';
import { StatusOptions } from '../ApplicationFields/StatusOptions';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { DateText } from '../DateText/DateText';
import { IconButton } from '../IconButton/IconButton';
import { PencilIcon, SearchIcon, TrashIcon } from '../Icons/Icons';
import { SaveError } from '../Notice/Notice';
import { EditRow } from './EditRow';

const PAGE_SIZE = 100;

/** How long typing must pause before the result count is announced. */
const SEARCH_ANNOUNCE_DELAY_MS = 500;

const TABS = [
  { key: 'all', label: 'View all' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'interviewed', label: 'Interviewed' },
  { key: 'follow-up', label: 'Needs Follow Up' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type SortKey = 'date' | 'company' | 'status' | 'age';
type SortDirection = 'ascending' | 'descending';

/** Pipeline order for the Status column, with the calculated action state first. */
const STATUS_ORDER = [
  'Follow Up Due',
  'Applied',
  'Followed Up',
  'Interviewed',
  'Filled',
  'Rejected',
] as const;

type StatusLabel = (typeof STATUS_ORDER)[number];

/** Direction applied the first time a column is sorted. */
const INITIAL_DIRECTION: Record<SortKey, SortDirection> = {
  date: 'descending',
  company: 'ascending',
  status: 'ascending',
  age: 'descending',
};

interface Row {
  app: Application;
  due: boolean;
  /** Badge text: the stored status, or "Follow Up Due" when calculated as due; null when unrecognized. */
  statusLabel: StatusLabel | null;
  /** Days since applied while status is Applied (and the date is readable); otherwise null. */
  age: number | null;
}

export interface ApplicationsTableProps {
  applications: Application[];
  followUpDays?: number;
  /** Reference date for age, follow-up-due and year display. Calculate once and pass down. */
  today: Date;
  /** Persists a change (status dropdown or edit row) and resolves to the saved application. */
  onUpdate: (id: string, patch: ApplicationPatch) => Promise<Application>;
  /** Permanently removes an application (after the user confirms). */
  onDelete: (id: string) => Promise<void>;
  /** Shows the data without status, edit or delete controls (e.g. a sheet that can't be written yet). */
  readOnly?: boolean;
  /** True while a row is open for editing or a delete is being confirmed, so the owner can hold off reloading. */
  onEditingChange?: (editing: boolean) => void;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function toRow(app: Application, followUpDays: number, today: Date): Row {
  const due = isFollowUpDue(app, followUpDays, today);
  return {
    app,
    due,
    statusLabel: due ? 'Follow Up Due' : app.status || null,
    age: app.status === 'Applied' ? ageInDays(app, today) : null,
  };
}

function matchesTab(row: Row, tab: TabKey): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'rejected':
      return row.app.status === 'Rejected';
    case 'interviewed':
      return row.app.status === 'Interviewed';
    case 'follow-up':
      return row.due;
  }
}

function matchesQuery(row: Row, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { company, position, notes = '' } = row.app;
  return [company, position, notes].some((field) => field.toLowerCase().includes(needle));
}

function filterRows(
  applications: Application[],
  followUpDays: number,
  today: Date,
  tab: TabKey,
  query: string,
): Row[] {
  return applications
    .map((app) => toRow(app, followUpDays, today))
    .filter((row) => matchesTab(row, tab) && matchesQuery(row, query));
}

function sortValue(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case 'date':
      return row.app.dateApplied;
    case 'company':
      return row.app.company;
    case 'status':
      return row.statusLabel && STATUS_ORDER.indexOf(row.statusLabel);
    case 'age':
      return row.age;
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/** Blanks always sort last, whatever the direction; ties fall back to newest first. */
function compareRows(a: Row, b: Row, key: SortKey, direction: SortDirection): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  if (av === null || bv === null) {
    if (av !== bv) return av === null ? 1 : -1;
  } else {
    const result = compareValues(av, bv);
    if (result !== 0) return direction === 'ascending' ? result : -result;
  }
  return (
    b.app.dateApplied.localeCompare(a.app.dateApplied) ||
    compareValues(a.app.company, b.app.company)
  );
}

export function ApplicationsTable({
  applications,
  followUpDays = DEFAULT_FOLLOW_UP_DAYS,
  today,
  onUpdate,
  onDelete,
  readOnly = false,
  onEditingChange,
}: ApplicationsTableProps) {
  const baseId = useId();
  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;
  const regionId = `${baseId}-region`;
  const searchId = `${baseId}-search`;
  const editButtonId = (id: string) => `${baseId}-edit-${id}`;
  const deleteButtonId = (id: string) => `${baseId}-delete-${id}`;
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());

  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'descending',
  });
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Rows shown, in order, while the user works on them (edit or status change),
  // so a row doesn't jump or vanish under the cursor. Cleared by the next
  // sort/filter/page interaction, a save or cancel, or a new application.
  const [pinned, setPinned] = useState<{ ids: string[]; total: number } | null>(null);
  // Live region text. Empty until something happens, so nothing is announced on load.
  // The counter keys the text so a repeated message is still a DOM change and re-announces.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const announceTimer = useRef<number | undefined>(undefined);
  const [deleting, setDeleting] = useState<Application | null>(null);
  // A failed status change, kept so Retry can send it again.
  const [statusError, setStatusError] = useState<{
    app: Application;
    status: Status;
    error: unknown;
  } | null>(null);
  const [retryingStatus, setRetryingStatus] = useState(false);
  // Element ids to try, in order, for focus once the next render lands
  // (after an edit closes, a delete, or a cancelled delete).
  const pendingFocus = useRef<string[] | null>(null);

  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  // A row deleted elsewhere (e.g. in the sheet, then reloaded) is no longer being edited.
  const editing = editingId !== null && applications.some((app) => app.id === editingId);
  const busy = editing || deleting !== null;
  useEffect(() => {
    onEditingChange?.(busy);
  }, [busy, onEditingChange]);

  // Move focus to the first candidate that exists after this render, falling
  // back to the table region (or the panel, if the view is now empty).
  useEffect(() => {
    const candidates = pendingFocus.current;
    if (candidates === null) return;
    pendingFocus.current = null;
    for (const id of [...candidates, regionId, panelId]) {
      const element = document.getElementById(id);
      if (element) {
        element.focus();
        return;
      }
    }
  });

  const positions = distinctPositions(applications);
  const rows = filterRows(applications, followUpDays, today, tab, query).sort((a, b) =>
    compareRows(a, b, sort.key, sort.direction),
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const activePin = pinned && pinned.total === applications.length ? pinned : null;
  const byId = new Map(applications.map((app) => [app.id, app]));
  const pageRows = activePin
    ? activePin.ids.flatMap((id) => {
        const app = byId.get(id);
        return app ? [toRow(app, followUpDays, today)] : [];
      })
    : rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function announce(text: string) {
    window.clearTimeout(announceTimer.current);
    setAnnouncement((prev) => ({ text, count: prev.count + 1 }));
  }

  /** Announces the result count for a filter, immediately or once `delay` passes without another call. */
  function announceCount(nextTab: TabKey, nextQuery: string, delay = 0) {
    window.clearTimeout(announceTimer.current);
    const count = filterRows(applications, followUpDays, today, nextTab, nextQuery).length;
    const message = pluralize(count, 'application');
    if (delay === 0) announce(message);
    else announceTimer.current = window.setTimeout(() => announce(message), delay);
  }

  function pinCurrentRows() {
    setPinned(
      (prev) => prev ?? { ids: pageRows.map((row) => row.app.id), total: applications.length },
    );
  }

  function selectTab(key: TabKey) {
    setTab(key);
    setPage(1);
    setPinned(null);
    announceCount(key, query);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const key = TABS[next]?.key;
    if (!key) return;
    selectTab(key);
    tabRefs.current.get(key)?.focus();
  }

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: INITIAL_DIRECTION[key] },
    );
    setPage(1);
    setPinned(null);
  }

  function goToPage(next: number) {
    setPage(next);
    setPinned(null);
  }

  async function changeStatus(app: Application, status: Status) {
    pinCurrentRows();
    const patch: ApplicationPatch = { status };
    if (status === 'Followed Up' && !app.followedUpDate) {
      patch.followedUpDate = toIsoDate(today);
    }
    try {
      await onUpdate(app.id, patch);
      setStatusError(null);
      announce('Status updated');
    } catch (error) {
      // The select stays on the saved status: the table only changes once a save succeeds.
      setStatusError({ app, status, error });
    }
  }

  async function retryStatus() {
    if (!statusError || retryingStatus) return;
    setRetryingStatus(true);
    await changeStatus(statusError.app, statusError.status);
    setRetryingStatus(false);
  }

  function startEdit(id: string) {
    pinCurrentRows();
    setEditingId(id);
  }

  function closeEdit(id: string) {
    setEditingId(null);
    setPinned(null);
    pendingFocus.current = [editButtonId(id)];
  }

  async function confirmDelete(app: Application) {
    // Focus lands on the next row's trash button, else the previous row's.
    const index = pageRows.findIndex((row) => row.app.id === app.id);
    const neighbours = [pageRows[index + 1], pageRows[index - 1]].flatMap((row) =>
      row ? [deleteButtonId(row.app.id)] : [],
    );
    await onDelete(app.id);
    pendingFocus.current = neighbours;
    setDeleting(null);
    announce(`Deleted ${app.company}`);
  }

  function cancelDelete(app: Application) {
    pendingFocus.current = [deleteButtonId(app.id)];
    setDeleting(null);
  }

  async function saveEdit(id: string, patch: ApplicationPatch) {
    const updated = await onUpdate(id, patch);
    // Where the row lands once sorting and filters apply again.
    const nextRows = filterRows(
      applications.map((app) => (app.id === id ? updated : app)),
      followUpDays,
      today,
      tab,
      query,
    ).sort((a, b) => compareRows(a, b, sort.key, sort.direction));
    const index = nextRows.findIndex((row) => row.app.id === id);
    const landingPage = Math.floor(index / PAGE_SIZE) + 1;
    if (index === -1) announce('Saved, no longer in this view');
    else if (landingPage !== currentPage) announce(`Saved, moved to page ${landingPage}`);
    else announce('Saved');
    closeEdit(id);
  }

  function sortHeader(
    key: SortKey,
    label: string,
    { className, buttonLabel }: { className?: string; buttonLabel?: string } = {},
  ) {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        className={className}
        // The header keeps its visible text as its name, even when the button is renamed.
        {...(buttonLabel && { 'aria-label': label })}
        {...(active && { 'aria-sort': sort.direction })}
      >
        <button
          type="button"
          className="applications-table__sort"
          disabled={editing}
          {...(buttonLabel && { 'aria-label': buttonLabel })}
          onClick={() => handleSort(key)}
        >
          {label}
          <span className="applications-table__sort-icon" aria-hidden="true" />
        </button>
      </th>
    );
  }

  function notApplicable(text: string) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{text}</span>
      </>
    );
  }

  const emptyMessage =
    applications.length === 0
      ? 'No applications yet.'
      : query.trim()
        ? `No applications match “${query.trim()}”.`
        : 'No applications in this view.';

  return (
    <div className="applications-table">
      <div className="applications-table__controls">
        <div role="tablist" aria-label="Filter applications" className="applications-table__tabs">
          {TABS.map(({ key, label }, index) => {
            const selected = key === tab;
            return (
              <button
                key={key}
                ref={(el) => {
                  if (el) tabRefs.current.set(key, el);
                  else tabRefs.current.delete(key);
                }}
                type="button"
                role="tab"
                id={tabId(key)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className="applications-table__tab"
                disabled={editing}
                onClick={() => selectTab(key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="applications-table__search">
          <SearchIcon className="applications-table__search-icon" />
          <label htmlFor={searchId} className="sr-only">
            Search company, position and notes
          </label>
          <input
            id={searchId}
            type="search"
            className="applications-table__search-input"
            placeholder="Search"
            value={query}
            disabled={editing}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              setPinned(null);
              announceCount(tab, event.target.value, SEARCH_ANNOUNCE_DELAY_MS);
            }}
          />
        </div>
      </div>

      {statusError && (
        <div className="applications-table__notice">
          <SaveError
            error={statusError.error}
            fallback={`Couldn’t change ${statusError.app.company} to ${statusError.status}.`}
            retrying={retryingStatus}
            onRetry={() => void retryStatus()}
          />
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement.text && <span key={announcement.count}>{announcement.text}</span>}
      </p>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(tab)}
        className="applications-table__panel"
        {...(pageRows.length === 0 && { tabIndex: 0 })}
      >
        {pageRows.length === 0 ? (
          <p className="applications-table__empty">{emptyMessage}</p>
        ) : (
          <>
            {/* Focusable so keyboard users can scroll the table sideways on narrow screens. */}
            <div
              id={regionId}
              className="applications-table__scroll"
              role="region"
              aria-label="Applications"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
            >
              <table className="applications-table__table">
                <thead>
                  <tr>
                    {sortHeader('date', 'Date')}
                    {sortHeader('company', 'Company / Position', {
                      buttonLabel: 'Sort by company',
                    })}
                    {sortHeader('status', 'Status')}
                    {sortHeader('age', 'Age', {
                      className: 'applications-table__cell applications-table__cell--numeric',
                    })}
                    <th scope="col">Followed Up</th>
                    <th scope="col">Notes</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(({ app, due, age }) => {
                    const ageCell =
                      age === null ? notApplicable('Not applicable') : pluralize(age, 'day');
                    if (app.id === editingId) {
                      return (
                        <EditRow
                          key={app.id}
                          app={app}
                          positions={positions}
                          today={today}
                          age={ageCell}
                          onSave={(patch) => saveEdit(app.id, patch)}
                          onCancel={() => {
                            closeEdit(app.id);
                            announce('Edit cancelled');
                          }}
                        />
                      );
                    }
                    return (
                      <tr key={app.id} className="applications-table__row">
                        <td className="no-wrap">
                          {app.dateApplied ? (
                            <DateText iso={app.dateApplied} />
                          ) : (
                            (app.unparsed?.dateApplied ?? notApplicable('No date'))
                          )}
                        </td>
                        <td>
                          <span className="applications-table__company">{app.company}</span>
                          <span className="applications-table__position">{app.position}</span>
                        </td>
                        <td>
                          <div className="applications-table__status">
                            <select
                              className="applications-table__select"
                              aria-label={`Status, ${app.company}, ${app.position}`}
                              value={app.status}
                              disabled={readOnly}
                              onChange={(event) =>
                                void changeStatus(app, event.target.value as Status)
                              }
                            >
                              <StatusOptions app={app} />
                            </select>
                            {due && (
                              <span className="applications-table__badge applications-table__badge--follow-up-due">
                                <span
                                  className="applications-table__badge-dot"
                                  aria-hidden="true"
                                />
                                Follow Up Due
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="applications-table__cell applications-table__cell--numeric">
                          {ageCell}
                        </td>
                        <td className="no-wrap">
                          {app.followedUpDate ? (
                            <DateText iso={app.followedUpDate} />
                          ) : (
                            (app.unparsed?.followedUpDate ?? notApplicable('Not followed up'))
                          )}
                        </td>
                        <td className="applications-table__notes" title={app.notes}>
                          {app.notes}
                        </td>
                        <td>
                          <div className="applications-table__row-icons">
                            <IconButton
                              id={deleteButtonId(app.id)}
                              label={`Delete ${app.company} application`}
                              tooltip="Delete"
                              icon={<TrashIcon />}
                              variant="danger"
                              disabled={editing || readOnly}
                              onClick={() => setDeleting(app)}
                            />
                            <IconButton
                              id={editButtonId(app.id)}
                              label={`Edit ${app.company} application`}
                              tooltip="Edit"
                              icon={<PencilIcon />}
                              disabled={editing || readOnly}
                              onClick={() => startEdit(app.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <nav className="applications-table__pagination" aria-label="Pagination">
              <span className="applications-table__page">
                Page {currentPage} of {pageCount}
              </span>
              <div className="applications-table__page-buttons">
                <button
                  type="button"
                  className="btn"
                  disabled={editing || currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={editing || currentPage === pageCount}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete application?"
        confirmLabel="Delete"
        onConfirm={() => (deleting ? confirmDelete(deleting) : Promise.resolve())}
        onCancel={() => deleting && cancelDelete(deleting)}
      >
        {deleting && (
          <p>
            {deleting.company}, {deleting.position}, will be permanently deleted. This can’t be
            undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
