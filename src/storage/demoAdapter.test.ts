// Fixtures are fictional.
import { describe, expect, it } from 'vitest';
import { createDemoAdapter } from './demoAdapter';

const TODAY = new Date(2026, 9, 14);

/** A Storage over a Map, shared between adapters like a browser's localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

describe('createDemoAdapter', () => {
  it('seeds the sample data on the first visit and keeps changes for the next', async () => {
    const storage = memoryStorage();
    const first = createDemoAdapter({ today: TODAY, storage });
    expect(first.persistent).toBe(true);
    expect(first.source()).toBeNull();
    const { applications } = await first.list();
    expect(applications).toHaveLength(120);

    const added = await first.add({
      dateApplied: '2026-10-14',
      company: 'Heronfold Labs',
      position: 'Product Designer',
      status: 'Applied',
    });
    const target = applications[0];
    if (!target) throw new Error('no sample rows');
    await first.update(target.id, { notes: 'Called back' });
    await first.updatePositions(() => ({ added: ['Motion Designer'], hidden: [] }));

    // Another page load in the same browser.
    const second = createDemoAdapter({ today: TODAY, storage });
    const next = await second.list();
    expect(next.applications).toHaveLength(121);
    expect(next.applications).toContainEqual(added);
    expect(next.applications.find((app) => app.id === target.id)?.notes).toBe('Called back');
    expect(next.positions.added).toEqual(['Motion Designer']);

    await second.remove(added.id);
    expect((await createDemoAdapter({ today: TODAY, storage }).list()).applications).toHaveLength(
      120,
    );
  });

  it('resets to fresh sample data, and replaces everything on import', async () => {
    const storage = memoryStorage();
    const demo = createDemoAdapter({ today: TODAY, storage });
    await demo.replaceWith({
      name: 'jobs.csv',
      applications: [
        {
          id: 'x1',
          dateApplied: '2026-10-01',
          company: 'Heronfold Labs',
          position: 'UX Designer',
          status: 'Applied',
        },
      ],
      issues: [{ row: 3, problems: ['no company'] }],
    });
    expect(demo.source()).toBe('jobs.csv');
    expect((await demo.list()).applications).toHaveLength(1);
    expect((await demo.list()).issues).toHaveLength(1);

    await demo.reset();
    expect(demo.source()).toBeNull();
    const after = await demo.list();
    expect(after.applications).toHaveLength(120);
    expect(after.issues).toEqual([]);
  });

  it('works in memory when storage is blocked', async () => {
    const demo = createDemoAdapter({ today: TODAY, storage: null });
    expect(demo.persistent).toBe(false);
    const added = await demo.add({
      dateApplied: '2026-10-14',
      company: 'Heronfold Labs',
      position: 'Product Designer',
      status: 'Applied',
    });
    expect((await demo.list()).applications).toContainEqual(added);
  });

  it('reseeds when the stored data is unreadable', async () => {
    const storage = memoryStorage();
    storage.setItem('jtracker.demo', '{not json');
    expect((await createDemoAdapter({ today: TODAY, storage }).list()).applications).toHaveLength(
      120,
    );
  });
});
