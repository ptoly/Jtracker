import { normalize } from '../lib/applicationRules';
import { EMPTY_POSITION_LIST, renameInList } from '../lib/positions';
import type { Application, NewApplication } from '../types/application';
import type { PositionList, StorageAdapter } from './StorageAdapter';
import { createSampleApplications } from './sampleData';

/**
 * In-memory adapter seeded with fictional data; state resets on reload.
 * The app's demo keeps its data in the browser instead (demoAdapter); this
 * one is for an empty list (no demo in the build) and for tests.
 */
export function createSampleAdapter(
  seed: NewApplication[] = createSampleApplications(),
): StorageAdapter {
  let nextId = 1;
  const makeId = () => `sample-${nextId++}`;
  let items: Application[] = seed.map((app) => ({ ...app, id: makeId() }));
  let positions: PositionList = EMPTY_POSITION_LIST;

  return {
    async list() {
      return { applications: items.map((app) => ({ ...app })), issues: [], positions };
    },

    async add(input) {
      const app: Application = { ...input, id: makeId() };
      items = [...items, app];
      return { ...app };
    },

    async update(id, patch) {
      const existing = items.find((app) => app.id === id);
      if (!existing) throw new Error(`Application not found: ${id}`);
      // An explicit undefined clears an optional field (see ApplicationPatch).
      const app = Object.fromEntries(
        Object.entries({ ...existing, ...patch, id }).filter(([, value]) => value !== undefined),
      ) as unknown as Application;
      items = items.map((item) => (item.id === id ? app : item));
      return { ...app };
    },

    async remove(id) {
      if (!items.some((app) => app.id === id)) throw new Error(`Application not found: ${id}`);
      items = items.filter((app) => app.id !== id);
    },

    async updatePositions(change) {
      positions = change(positions);
      return positions;
    },

    async renamePosition(from, to) {
      const target = to.trim();
      let changed = 0;
      items = items.map((app) => {
        if (normalize(app.position) !== normalize(from)) return app;
        changed += 1;
        return { ...app, position: target };
      });
      positions = renameInList(positions, from, target);
      return { changed, positions };
    },
  };
}
