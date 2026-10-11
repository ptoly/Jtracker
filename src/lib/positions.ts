import type { PositionList } from '../storage/StorageAdapter';
import type { Application } from '../types/application';
import { distinctPositions, normalize } from './applicationRules';

// The position suggestions are the positions in use, plus ones the user added,
// minus ones they removed. Removing only hides a suggestion: applications keep
// their text. Every change here is pure, so storage can apply it to a freshly
// read list.

export const EMPTY_POSITION_LIST: PositionList = { added: [], hidden: [] };

const sortByName = (names: string[]) =>
  [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

function includes(names: string[], name: string): boolean {
  return names.some((n) => normalize(n) === normalize(name));
}

function without(names: string[], name: string): string[] {
  return names.filter((n) => normalize(n) !== normalize(name));
}

/** Suggestions for the position field, A→Z. */
export function suggestedPositions(applications: Application[], list: PositionList): string[] {
  const inUse = distinctPositions(applications);
  const added = list.added.filter((name) => !includes(inUse, name));
  return sortByName([...inUse, ...added].filter((name) => !includes(list.hidden, name)));
}

/** Removed suggestions that still mean something: in use, so restoring brings them back. */
export function removedPositions(applications: Application[], list: PositionList): string[] {
  const inUse = distinctPositions(applications);
  return sortByName(list.hidden.filter((name) => includes(inUse, name)));
}

export function addPosition(list: PositionList, name: string): PositionList {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return {
    added: includes(list.added, trimmed) ? list.added : [...list.added, trimmed],
    hidden: without(list.hidden, trimmed),
  };
}

export function removePosition(list: PositionList, name: string): PositionList {
  return {
    added: without(list.added, name),
    hidden: includes(list.hidden, name) ? list.hidden : [...list.hidden, name.trim()],
  };
}

export function restorePosition(list: PositionList, name: string): PositionList {
  return { ...list, hidden: without(list.hidden, name) };
}

/**
 * The list after renaming `from` to `to`: an added name follows the rename,
 * and neither name stays hidden (renaming into a removed name brings it back).
 */
export function renameInList(list: PositionList, from: string, to: string): PositionList {
  const target = to.trim();
  let added = without(list.added, from);
  if (includes(list.added, from) && !includes(added, target)) added = [...added, target];
  return { added, hidden: without(without(list.hidden, from), target) };
}

/** How many applications use this position (case- and space-insensitive). */
export function usageCount(applications: Application[], name: string): number {
  return applications.filter((app) => normalize(app.position) === normalize(name)).length;
}
