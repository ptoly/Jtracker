import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Application } from '../../types/application';
import { ageInDays, DEFAULT_FOLLOW_UP_DAYS, isFollowUpDue } from '../../lib/derive';
import { DateText } from '../DateText/DateText';

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
  /** Badge text: the stored status, or "Follow Up Due" when calculated as due. */
  statusLabel: StatusLabel;
  /** Days since applied while status is Applied; otherwise null. */
  age: number | null;
}

export interface ApplicationsTableProps {
  applications: Application[];
  followUpDays?: number;
  /** Reference date for age, follow-up-due and year display. Calculate once and pass down. */
  today: Date;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function toModifier(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function toRow(app: Application, followUpDays: number, today: Date): Row {
  const due = isFollowUpDue(app, followUpDays, today);
  return {
    app,
    due,
    statusLabel: due ? 'Follow Up Due' : app.status,
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
      return STATUS_ORDER.indexOf(row.statusLabel);
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
}: ApplicationsTableProps) {
  const baseId = useId();
  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;
  const searchId = `${baseId}-search`;
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());

  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'descending',
  });
  const [page, setPage] = useState(1);
  // Live region text. Empty until the user filters, so nothing is announced on load.
  const [announcement, setAnnouncement] = useState('');
  const announceTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  const rows = filterRows(applications, followUpDays, today, tab, query).sort((a, b) =>
    compareRows(a, b, sort.key, sort.direction),
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /** Announces the result count for a filter, immediately or once `delay` passes without another call. */
  function announceCount(nextTab: TabKey, nextQuery: string, delay = 0) {
    window.clearTimeout(announceTimer.current);
    const count = filterRows(applications, followUpDays, today, nextTab, nextQuery).length;
    const message = pluralize(count, 'application');
    if (delay === 0) setAnnouncement(message);
    else announceTimer.current = window.setTimeout(() => setAnnouncement(message), delay);
  }

  function selectTab(key: TabKey) {
    setTab(key);
    setPage(1);
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
  }

  function sortHeader(key: SortKey, label: string, className?: string) {
    const active = sort.key === key;
    return (
      <th scope="col" className={className} {...(active && { 'aria-sort': sort.direction })}>
        <button type="button" className="applications-table__sort" onClick={() => handleSort(key)}>
          {label}
          <span
            className={`applications-table__sort-icon${active ? ` applications-table__sort-icon--${sort.direction}` : ''}`}
            aria-hidden="true"
          />
        </button>
      </th>
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
                onClick={() => selectTab(key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="applications-table__search">
          <label htmlFor={searchId} className="sr-only">
            Search company, position and notes
          </label>
          <svg
            className="applications-table__search-icon"
            viewBox="0 0 20 20"
            width="20"
            height="20"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M17.5 17.5l-3.625-3.625M15.833 9.167a6.667 6.667 0 11-13.333 0 6.667 6.667 0 0113.333 0z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.67"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            id={searchId}
            type="search"
            className="applications-table__search-input"
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              announceCount(tab, event.target.value, SEARCH_ANNOUNCE_DELAY_MS);
            }}
          />
        </div>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(tab)}
        className="applications-table__panel"
        {...(rows.length === 0 && { tabIndex: 0 })}
      >
        {rows.length === 0 ? (
          <p className="applications-table__empty">{emptyMessage}</p>
        ) : (
          <>
            {/* Focusable so keyboard users can scroll the table sideways on narrow screens. */}
            <div
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
                    {sortHeader('company', 'Company')}
                    <th scope="col">Position</th>
                    {sortHeader('status', 'Status')}
                    {sortHeader('age', 'Age', 'applications-table__cell--numeric')}
                    <th scope="col">Followed Up</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(({ app, statusLabel, age }) => (
                    <tr key={app.id}>
                      <td className="applications-table__cell--nowrap">
                        <DateText iso={app.dateApplied} />
                      </td>
                      <td className="applications-table__company">{app.company}</td>
                      <td>{app.position}</td>
                      <td>
                        {/* Applied is the default state, so it gets no badge; screen readers still hear it. */}
                        {statusLabel === 'Applied' ? (
                          <span className="sr-only">Applied</span>
                        ) : (
                          <span
                            className={`applications-table__badge applications-table__badge--${toModifier(statusLabel)}`}
                          >
                            <span className="applications-table__badge-dot" aria-hidden="true" />
                            {statusLabel}
                          </span>
                        )}
                      </td>
                      <td className="applications-table__cell--numeric">
                        {age === null ? (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Not applicable</span>
                          </>
                        ) : (
                          pluralize(age, 'day')
                        )}
                      </td>
                      <td className="applications-table__cell--nowrap">
                        {app.followedUpDate ? (
                          <DateText iso={app.followedUpDate} />
                        ) : (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Not followed up</span>
                          </>
                        )}
                      </td>
                      <td className="applications-table__notes" title={app.notes}>
                        {app.notes}
                      </td>
                    </tr>
                  ))}
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
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
