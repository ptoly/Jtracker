import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { distinctPositions } from '../../lib/applicationRules';
import { toIsoDate } from '../../lib/dates';
import { ageInDays, DEFAULT_FOLLOW_UP_DAYS, isFollowUpDue } from '../../lib/derive';
import { pageItems } from '../../lib/pagination';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useTooltip } from '../Tooltip/useTooltip';
import type { Application, ApplicationPatch, Status } from '../../types/application';
import type { ApplicationPrefill } from '../ApplicationForm/ApplicationForm';
import { StatusOptions } from '../ApplicationFields/StatusOptions';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { DateText } from '../DateText/DateText';
import { IconButton } from '../IconButton/IconButton';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  XCloseIcon,
} from '../Icons/Icons';
import { NoteTip } from '../NoteTip/NoteTip';
import { SaveError } from '../Notice/Notice';
import { Select } from '../Select/Select';
import { EditRow } from './EditRow';

const PAGE_SIZE = 100;

/** How long typing must pause before the result count is announced. */
const SEARCH_ANNOUNCE_DELAY_MS = 500;

const TABS = [
  { key: 'all', label: 'View all' },
  { key: 'follow-up', label: 'Needs Follow Up' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'interviewed', label: 'Interviewed' },
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
  'Interviewed - Rejected',
  'Rejected',
] as const;

type StatusLabel = (typeof STATUS_ORDER)[number];

/**
 * The card view's sort choices: every column sort, both ways for the dates
 * and companies. The value is `${key} ${direction}`.
 */
const SORT_OPTIONS: { key: SortKey; direction: SortDirection; label: string }[] = [
  { key: 'date', direction: 'descending', label: 'Date applied, newest first' },
  { key: 'date', direction: 'ascending', label: 'Date applied, oldest first' },
  { key: 'company', direction: 'ascending', label: 'Company, A to Z' },
  { key: 'company', direction: 'descending', label: 'Company, Z to A' },
  { key: 'status', direction: 'ascending', label: 'Status' },
  { key: 'age', direction: 'descending', label: 'Age, longest first' },
  { key: 'age', direction: 'ascending', label: 'Age, shortest first' },
];

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

export interface ApplicationsTableHandle {
  /**
   * Back to the whole table, newest first, on page 1: clears the search, picks
   * View all, and sorts by date applied (e.g. after adding an application, so
   * it shows in the top row). Leaves a row being edited alone.
   */
  showLatest: () => void;
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
  /** Position suggestions for the edit row. Defaults to the positions in `applications`. */
  positions?: string[];
  /**
   * Offered when a search finds nothing: starts a new application for the
   * search term, as its position when it names a known one (any case; the
   * saved spelling is passed), otherwise as its company.
   */
  onAddForSearch?: (fill: ApplicationPrefill) => void;
  ref?: Ref<ApplicationsTableHandle>;
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
      // Both rejections, whether or not it got to an interview.
      return row.app.status === 'Rejected' || row.app.status === 'Interviewed - Rejected';
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
  positions: suggestions,
  onAddForSearch,
  ref,
}: ApplicationsTableProps) {
  const baseId = useId();
  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;
  const regionId = `${baseId}-region`;
  const searchId = `${baseId}-search`;
  const sortSelectId = `${baseId}-sort`;
  const showSelectId = `${baseId}-show`;
  const editButtonId = (id: string) => `${baseId}-edit-${id}`;
  const deleteButtonId = (id: string) => `${baseId}-delete-${id}`;
  const dueId = (id: string) => `${baseId}-due-${id}`;
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());
  // Up to 1032px (phones and tablets, 13" iPad upright) the table becomes a
  // list of cards: its columns need about 1150px.
  const cards = useMediaQuery('(width < 1033px)');

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
  // The date column's "Sorts by date applied" tip; off while a row is edited.
  const sortTip = useTooltip(editing);
  const busy = editing || deleting !== null;

  useImperativeHandle(ref, () => ({
    showLatest() {
      if (editing) return;
      setQuery('');
      setTab('all');
      setSort({ key: 'date', direction: 'descending' });
      setPage(1);
      setPinned(null);
    },
  }));
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

  const positions = suggestions ?? distinctPositions(applications);

  // A search that finds nothing offers to add it: as a position when it names
  // a known one, otherwise as a company.
  const term = query.trim();
  const knownPosition = positions.find((p) => p.toLowerCase() === term.toLowerCase());
  const searchPrefill: ApplicationPrefill | null = !term
    ? null
    : knownPosition
      ? { position: knownPosition }
      : { company: term };
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
  /** Typing (announced once it pauses) and clearing (announced at once) both land here. */
  function changeQuery(value: string, delay = SEARCH_ANNOUNCE_DELAY_MS) {
    setQuery(value);
    setPage(1);
    setPinned(null);
    announceCount(tab, value, delay);
  }

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

  /** The card view's Sort by select: a key and direction in one choice. */
  function chooseSort(value: string) {
    const option = SORT_OPTIONS.find((o) => `${o.key} ${o.direction}` === value);
    if (!option) return;
    setSort({ key: option.key, direction: option.direction });
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
    {
      className,
      content = label,
      tip,
    }: { className?: string; content?: ReactNode; tip?: { id: string; text: string } } = {},
  ) {
    const active = sort.key === key;
    const button = (
      <button
        type="button"
        className="applications-table__sort"
        disabled={editing}
        onClick={() => handleSort(key)}
        {...(tip && {
          'aria-describedby': tip.id,
          onFocus: sortTip.onFocus,
          onBlur: sortTip.onBlur,
        })}
      >
        {content}
        <span className="applications-table__sort-icon" aria-hidden="true" />
      </button>
    );
    return (
      <th scope="col" className={className} {...(active && { 'aria-sort': sort.direction })}>
        {tip ? (
          // The tip is the button's description too, so screen readers get it.
          <span className="tooltip" {...sortTip.hoverProps}>
            {button}
            <span
              id={tip.id}
              className="tooltip__bubble tooltip__bubble--below tooltip__bubble--start"
              data-open={sortTip.open ? '' : undefined}
            >
              {tip.text}
            </span>
          </span>
        ) : (
          button
        )}
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

  function appliedDate(app: Application) {
    return app.dateApplied ? (
      <DateText iso={app.dateApplied} />
    ) : (
      (app.unparsed?.dateApplied ?? notApplicable('No date'))
    );
  }

  function followedUpDate(app: Application) {
    return app.followedUpDate ? (
      <DateText iso={app.followedUpDate} />
    ) : (
      (app.unparsed?.followedUpDate ?? notApplicable('Not yet'))
    );
  }

  /** The status select (with its dot) and, when due, "Follow Up Due" in words. */
  function statusControl(app: Application, due: boolean) {
    return (
      <div className="applications-table__status">
        <Select
          className="select--fit"
          aria-label={`Status, ${app.company}, ${app.position}`}
          {...(due && { 'aria-describedby': dueId(app.id) })}
          dot={due ? 'warning' : app.status === 'Followed Up' ? 'success' : undefined}
          value={app.status}
          disabled={readOnly}
          onChange={(event) => void changeStatus(app, event.target.value as Status)}
        >
          <StatusOptions app={app} />
        </Select>
        {due && (
          <span id={dueId(app.id)} className="applications-table__due">
            Follow Up Due
          </span>
        )}
      </div>
    );
  }

  function rowActions(app: Application) {
    return (
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
    );
  }

  function editRow(app: Application, age: ReactNode, layout: 'row' | 'card') {
    return (
      <EditRow
        key={app.id}
        app={app}
        positions={positions}
        today={today}
        age={age}
        layout={layout}
        onSave={(patch) => saveEdit(app.id, patch)}
        onCancel={() => {
          closeEdit(app.id);
          announce('Edit cancelled');
        }}
      />
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
      {/* Search on the left, filter tabs on the right, on a raised bar
          (stacked on narrow screens, with Show and Sort by selects for the tabs). */}
      <div className="applications-table__controls">
        <div className="applications-table__search">
          <label htmlFor={searchId} className="sr-only">
            Search company, position and notes
          </label>
          <div className="clearable">
            <SearchIcon className="applications-table__search-icon" />
            <input
              id={searchId}
              type="search"
              className="control clearable__input applications-table__search-input"
              placeholder="Search"
              value={query}
              disabled={editing}
              onChange={(event) => changeQuery(event.target.value)}
              // Escape clears it in every browser (the keyboard's way to the ✕).
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  changeQuery('', 0);
                }
              }}
            />
            {/* Whenever there's text, except while a row is being edited (the box is off then).
                Out of the tab order, like the add form's. */}
            {query && !editing && (
              <span className="clearable__clear">
                <IconButton
                  label="Clear search"
                  tooltip="Clear"
                  icon={<XCloseIcon />}
                  tabIndex={-1}
                  onClick={() => {
                    changeQuery('', 0);
                    document.getElementById(searchId)?.focus();
                  }}
                />
              </span>
            )}
          </div>
        </div>

        {cards ? (
          // Narrow screens: the tabs don't fit, so they become a "Show" select, and
          // the cards (which have no column headers) get "Sort by".
          <div className="applications-table__pickers">
            <div className="applications-table__picker">
              <label htmlFor={showSelectId}>Show</label>
              <Select
                id={showSelectId}
                value={tab}
                disabled={editing}
                onChange={(event) => {
                  const key = TABS.find((t) => t.key === event.target.value)?.key;
                  if (key) selectTab(key);
                }}
              >
                {TABS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label} ({filterRows(applications, followUpDays, today, key, query).length})
                  </option>
                ))}
              </Select>
            </div>
            <div className="applications-table__picker">
              <label htmlFor={sortSelectId}>Sort by</label>
              <Select
                id={sortSelectId}
                value={`${sort.key} ${sort.direction}`}
                disabled={editing}
                onChange={(event) => chooseSort(event.target.value)}
              >
                {/* A table sort with no card equivalent (e.g. status, descending) shows as the closest. */}
                {!SORT_OPTIONS.some(
                  (o) => o.key === sort.key && o.direction === sort.direction,
                ) && (
                  <option value={`${sort.key} ${sort.direction}`} hidden>
                    {SORT_OPTIONS.find((o) => o.key === sort.key)?.label}
                  </option>
                )}
                {SORT_OPTIONS.map((o) => (
                  <option key={`${o.key} ${o.direction}`} value={`${o.key} ${o.direction}`}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div role="tablist" aria-label="Filter applications" className="tabs">
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
                  className="tabs__tab"
                  disabled={editing}
                  onClick={() => selectTab(key)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {label}
                  <span className="tabs__count">
                    {filterRows(applications, followUpDays, today, key, query).length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
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
        id={panelId}
        // A tab panel only beside the tabs; on narrow screens the Show select filters it.
        {...(!cards && { role: 'tabpanel', 'aria-labelledby': tabId(tab) })}
        className="applications-table__panel"
        {...(pageRows.length === 0 && { tabIndex: 0 })}
      >
        {pageRows.length === 0 ? (
          <div className="applications-table__empty">
            <p>{emptyMessage}</p>
            {onAddForSearch && searchPrefill && (
              <button type="button" className="btn" onClick={() => onAddForSearch(searchPrefill)}>
                {'position' in searchPrefill
                  ? `Add a “${searchPrefill.position}” application`
                  : `Add application for “${searchPrefill.company}”`}
              </button>
            )}
          </div>
        ) : (
          <>
            {cards ? (
              <>
                {/* Narrow screens: one card per application, in the order of the columns.
                  Focusable from script only, as the fallback when the focused card goes away. */}
                <ul
                  id={regionId}
                  tabIndex={-1}
                  className="applications-table__cards"
                  aria-label="Applications"
                >
                  {pageRows.map(({ app, due, age }) => {
                    if (app.id === editingId) {
                      return editRow(
                        app,
                        age === null ? notApplicable('Not applicable') : age,
                        'card',
                      );
                    }
                    return (
                      <li key={app.id} className="applications-table__card">
                        <div className="applications-table__lines">
                          <h3 className="applications-table__card-title">{app.company}</h3>
                          <span className="item-meta">{app.position}</span>
                        </div>
                        {statusControl(app, due)}
                        <dl className="applications-table__facts">
                          <div>
                            <dt>Applied</dt>
                            <dd>{appliedDate(app)}</dd>
                          </div>
                          <div>
                            <dt>Followed up</dt>
                            <dd>{followedUpDate(app)}</dd>
                          </div>
                          <div>
                            <dt>Age</dt>
                            <dd>
                              {age === null
                                ? notApplicable('Not applicable')
                                : pluralize(age, 'day')}
                            </dd>
                          </div>
                        </dl>
                        {app.notes && (
                          <div className="applications-table__card-notes">{app.notes}</div>
                        )}
                        {rowActions(app)}
                      </li>
                    );
                  })}
                </ul>
              </>
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
                        {/* The buttons keep their visible text as their names (WCAG 2.5.3);
                            aria-sort on the header says which column is sorted, and how.
                            Dates sort by date applied, Company / Position by company. */}
                        {sortHeader('date', 'Date Applied / Date Follow Up', {
                          // Two dates, one sort: say which.
                          tip: { id: `${baseId}-date-sort-tip`, text: 'Sorts by date applied' },
                          content: (
                            <span className="applications-table__lines">
                              <span>Date Applied</span>
                              <span className="sr-only"> / </span>
                              <span>Date Follow Up</span>
                            </span>
                          ),
                        })}
                        {sortHeader('company', 'Company / Position', {
                          className: 'applications-table__company',
                        })}
                        {sortHeader('status', 'Status')}
                        {sortHeader('age', 'Age (Days)', {
                          className: 'applications-table__cell applications-table__cell--numeric',
                          content: (
                            <span className="applications-table__lines">
                              <span>Age</span>
                              <span className="sr-only"> </span>
                              <span>(Days)</span>
                            </span>
                          ),
                        })}
                        <th scope="col" className="applications-table__notes-header">
                          Notes
                        </th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(({ app, due, age }) => {
                        const ageCell = age === null ? notApplicable('Not applicable') : age;
                        if (app.id === editingId) return editRow(app, ageCell, 'row');
                        return (
                          <tr key={app.id} className="applications-table__row">
                            <td className="no-wrap">
                              {/* Two lines; each says which date it is to screen readers. */}
                              <span className="applications-table__lines">
                                <span>
                                  <span className="sr-only">Applied: </span>
                                  {appliedDate(app)}
                                </span>
                                <span className="item-meta">
                                  <span className="sr-only">Followed up: </span>
                                  {followedUpDate(app)}
                                </span>
                              </span>
                            </td>
                            <td className="applications-table__company">
                              <span className="applications-table__lines">
                                <span className="item-name">{app.company}</span>
                                <span className="item-meta">{app.position}</span>
                              </span>
                            </td>
                            <td>{statusControl(app, due)}</td>
                            <td className="applications-table__cell applications-table__cell--numeric">
                              {ageCell}
                            </td>
                            <td className="applications-table__notes">
                              {app.notes && <NoteTip text={app.notes} />}
                            </td>
                            <td>{rowActions(app)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <nav className="applications-table__pagination" aria-label="Pagination">
              <button
                type="button"
                className="btn btn--compact"
                disabled={editing || currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ArrowLeftIcon />
                Previous
              </button>
              <ol className="applications-table__pages">
                {pageItems(currentPage, pageCount).map((item, index) =>
                  item === 'gap' ? (
                    // Pages left out; the numbers either side say which.
                    <li key={`gap-${index}`} className="applications-table__gap" aria-hidden="true">
                      …
                    </li>
                  ) : (
                    <li key={item}>
                      <button
                        type="button"
                        className="quiet-button applications-table__page"
                        aria-label={`Page ${item}`}
                        {...(item === currentPage && { 'aria-current': 'page' as const })}
                        disabled={editing}
                        onClick={() => goToPage(item)}
                      >
                        {item}
                      </button>
                    </li>
                  ),
                )}
              </ol>
              <button
                type="button"
                className="btn btn--compact"
                disabled={editing || currentPage === pageCount}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
                <ArrowRightIcon />
              </button>
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
