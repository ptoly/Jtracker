import { describe, expect, it } from 'vitest';
import { ageInDays, isFollowUpDue } from '../lib/derive';
import { createSampleApplications } from './sampleData';

const TODAY = new Date(2026, 9, 14);
const apps = createSampleApplications(TODAY).map((app, i) => ({ ...app, id: `s${i}` }));

describe('createSampleApplications', () => {
  it('is the same every time; only the dates follow today', () => {
    const later = createSampleApplications(new Date(2026, 11, 1));
    expect(createSampleApplications(TODAY)).toEqual(createSampleApplications(TODAY));
    expect(later.map((app) => app.company)).toEqual(apps.map((app) => app.company));
  });

  it('has about 120 rows over about 90 days', () => {
    expect(apps).toHaveLength(120);
    const ages = apps.map((app) => ageInDays(app, TODAY) ?? -1);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ages)).toBeLessThanOrEqual(90);
  });

  it('shows off the alert, follow-ups, notes and the status mix', () => {
    const perCompany = new Map<string, number>();
    for (const app of apps) perCompany.set(app.company, (perCompany.get(app.company) ?? 0) + 1);
    const repeats = [...perCompany.values()].filter((n) => n > 1);
    expect(repeats.length).toBeGreaterThanOrEqual(4);
    expect(repeats.length).toBeLessThanOrEqual(5);
    expect(repeats.every((n) => n >= 2 && n <= 3)).toBe(true);

    const due = apps.filter((app) => isFollowUpDue(app, undefined, TODAY)).length;
    expect(due).toBeGreaterThanOrEqual(15);
    expect(due).toBeLessThanOrEqual(20);

    const notes = apps.filter((app) => app.notes).length;
    expect(notes).toBeGreaterThanOrEqual(15);
    expect(notes).toBeLessThanOrEqual(25);

    const statuses = new Set(apps.map((app) => app.status));
    expect(statuses).toEqual(
      new Set([
        'Applied',
        'Followed Up',
        'Interviewed',
        'Interviewed - Rejected',
        'Rejected',
        'Filled',
      ]),
    );
    // Follow-ups never come before applying or after today.
    for (const app of apps) {
      if (app.followedUpDate) {
        expect(app.followedUpDate >= app.dateApplied).toBe(true);
        expect(app.followedUpDate <= '2026-10-14').toBe(true);
      }
    }
  });
});
