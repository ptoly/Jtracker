import { describe, expect, it } from 'vitest';
import type { Application } from '../types/application';
import {
  addPosition,
  removedPositions,
  removePosition,
  renameInList,
  restorePosition,
  suggestedPositions,
} from './positions';

const app = (position: string): Application => ({
  id: position,
  dateApplied: '2026-10-01',
  company: 'Example Co',
  position,
  status: 'Applied',
});

const apps = [app('Designer'), app('sr. designer'), app('Engineer')];

describe('positions', () => {
  it('suggests positions in use plus added, minus removed, A→Z', () => {
    expect(
      suggestedPositions(apps, { added: ['Analyst', 'designer'], hidden: ['Engineer'] }),
    ).toEqual(['Analyst', 'Designer', 'sr. designer']);
  });

  it('lists only removed positions that are still in use', () => {
    expect(removedPositions(apps, { added: [], hidden: ['Engineer', 'Gone'] })).toEqual([
      'Engineer',
    ]);
  });

  it('adds, removes and restores without duplicates, ignoring case', () => {
    let list = addPosition({ added: [], hidden: ['Analyst'] }, ' Analyst ');
    expect(list).toEqual({ added: ['Analyst'], hidden: [] });
    list = addPosition(list, 'analyst');
    expect(list.added).toEqual(['Analyst']);
    list = removePosition(list, 'ANALYST');
    expect(list).toEqual({ added: [], hidden: ['ANALYST'] });
    expect(restorePosition(list, 'analyst')).toEqual({ added: [], hidden: [] });
  });

  it('renames in the list: an added name follows, neither name stays hidden', () => {
    expect(
      renameInList(
        { added: ['Sr. Designer'], hidden: ['Senior Designer'] },
        'sr. designer',
        'Senior Designer',
      ),
    ).toEqual({
      added: ['Senior Designer'],
      hidden: [],
    });
    expect(renameInList({ added: [], hidden: ['Old'] }, 'Old', 'New')).toEqual({
      added: [],
      hidden: [],
    });
  });
});
