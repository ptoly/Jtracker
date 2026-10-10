import type { Application, NewApplication } from '../types/application';
import type { StorageAdapter } from './StorageAdapter';
import { createSampleApplications } from './sampleData';

/** In-memory adapter seeded with fictional data. State resets on reload. */
export function createSampleAdapter(
  seed: NewApplication[] = createSampleApplications(),
): StorageAdapter {
  let nextId = 1;
  const makeId = () => `sample-${nextId++}`;
  let items: Application[] = seed.map((app) => ({ ...app, id: makeId() }));

  return {
    async list() {
      return items.map((app) => ({ ...app }));
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
  };
}

export const sampleAdapter: StorageAdapter = createSampleAdapter();
