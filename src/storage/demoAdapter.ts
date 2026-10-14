import { normalize } from '../lib/applicationRules';
import { EMPTY_POSITION_LIST, renameInList } from '../lib/positions';
import type { Application } from '../types/application';
import { createSampleApplications } from './sampleData';
import type { PositionList, RowIssue, StorageAdapter } from './StorageAdapter';

const KEY = 'jtracker.demo';

/** What the demo keeps in the browser. */
interface DemoState {
  version: 1;
  /** The imported file's name; null while it's the sample data. */
  source: string | null;
  applications: Application[];
  positions: PositionList;
  /** Rows of an imported file that couldn't be fully read. */
  issues: RowIssue[];
}

export interface DemoAdapter extends StorageAdapter {
  /** False when the browser blocks storage: changes last until the page reloads. */
  readonly persistent: boolean;
  /** The imported file's name, or null while it's the sample data. */
  source(): string | null;
  /** Fresh sample data, dated from today, in place of everything. */
  reset(): Promise<void>;
  /** An imported CSV file's applications in place of everything (Import CSV). */
  replaceWith(data: {
    name: string;
    applications: Application[];
    issues: RowIssue[];
  }): Promise<void>;
}

/** localStorage, if this browser lets the page use it (private modes and settings can block it). */
export function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${KEY}.probe`;
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function sampleState(today: Date): DemoState {
  return {
    version: 1,
    source: null,
    applications: createSampleApplications(today).map((app) => ({
      ...app,
      id: crypto.randomUUID(),
    })),
    positions: EMPTY_POSITION_LIST,
    issues: [],
  };
}

function isDemoState(value: unknown): value is DemoState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<DemoState>;
  return (
    state.version === 1 &&
    Array.isArray(state.applications) &&
    typeof state.positions === 'object' &&
    state.positions !== null &&
    Array.isArray(state.issues)
  );
}

/**
 * The hosted demo's storage: sample data seeded into this browser on the
 * first visit, then every add, edit, delete and position change kept there
 * (localStorage). Nothing leaves the browser. Without storage it works the
 * same in memory, and says so (`persistent`).
 */
export function createDemoAdapter({
  today,
  storage = browserStorage(),
}: {
  today: Date;
  storage?: Storage | null;
}): DemoAdapter {
  function load(): DemoState | null {
    try {
      const value: unknown = JSON.parse(storage?.getItem(KEY) ?? 'null');
      return isDemoState(value) ? value : null;
    } catch {
      return null;
    }
  }

  let state = load() ?? sampleState(today);

  function save(next: DemoState) {
    state = next;
    try {
      storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Full or blocked since it was checked: keep going in memory.
    }
  }

  // First visit (or unreadable data): seed it.
  if (storage && !load()) save(state);

  function find(id: string): Application {
    const app = state.applications.find((item) => item.id === id);
    if (!app) throw new Error(`Application not found: ${id}`);
    return app;
  }

  return {
    persistent: storage !== null,

    source: () => state.source,

    async list() {
      return {
        applications: state.applications.map((app) => ({ ...app })),
        issues: state.issues,
        positions: state.positions,
      };
    },

    async add(input) {
      const app: Application = { ...input, id: crypto.randomUUID() };
      save({ ...state, applications: [...state.applications, app] });
      return { ...app };
    },

    async update(id, patch) {
      const existing = find(id);
      // An explicit undefined clears an optional field (see ApplicationPatch).
      const app = Object.fromEntries(
        Object.entries({ ...existing, ...patch, id }).filter(([, value]) => value !== undefined),
      ) as unknown as Application;
      save({
        ...state,
        applications: state.applications.map((item) => (item.id === id ? app : item)),
      });
      return { ...app };
    },

    async remove(id) {
      find(id);
      save({ ...state, applications: state.applications.filter((app) => app.id !== id) });
    },

    async updatePositions(change) {
      save({ ...state, positions: change(state.positions) });
      return state.positions;
    },

    async renamePosition(from, to) {
      const target = to.trim();
      let changed = 0;
      const applications = state.applications.map((app) => {
        if (normalize(app.position) !== normalize(from)) return app;
        changed += 1;
        return { ...app, position: target };
      });
      save({ ...state, applications, positions: renameInList(state.positions, from, target) });
      return { changed, positions: state.positions };
    },

    async reset() {
      save(sampleState(today));
    },

    async replaceWith({ name, applications, issues }) {
      save({ version: 1, source: name, applications, positions: EMPTY_POSITION_LIST, issues });
    },
  };
}
