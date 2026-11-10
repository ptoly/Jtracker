import { describe, expect, it } from 'vitest';
import { freshDateApplied } from './dates';

describe('freshDateApplied: the add form’s date when you press Add', () => {
  it('the old default (the tab left open overnight) becomes today’s', () => {
    expect(freshDateApplied('2026-11-09', '2026-11-09', '2026-11-10')).toBe('2026-11-10');
  });

  it('a date you chose stays, even an earlier one', () => {
    expect(freshDateApplied('2026-11-05', '2026-11-09', '2026-11-10')).toBe('2026-11-05');
  });

  it('on the same day nothing changes', () => {
    expect(freshDateApplied('2026-11-10', '2026-11-10', '2026-11-10')).toBe('2026-11-10');
  });

  it('never moves a date backwards', () => {
    expect(freshDateApplied('2026-11-10', '2026-11-10', '2026-11-09')).toBe('2026-11-10');
  });
});
