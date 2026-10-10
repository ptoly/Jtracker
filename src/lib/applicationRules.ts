import type { Application } from '../types/application';

/** Case- and whitespace-insensitive comparison key. */
export const normalize = (value: string) => value.trim().toLowerCase();

/** Distinct positions, first-seen casing wins, sorted A→Z. */
export function distinctPositions(applications: Application[]): string[] {
  const byKey = new Map<string, string>();
  for (const { position } of applications) {
    const key = normalize(position);
    if (key && !byKey.has(key)) byKey.set(key, position.trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** The existing casing when `typed` matches a known position case-insensitively, else `typed` trimmed. */
export function canonicalPosition(typed: string, positions: string[]): string {
  const trimmed = typed.trim();
  return positions.find((p) => normalize(p) === normalize(trimmed)) ?? trimmed;
}

/** Most recent application with the same company and position, if any. */
export function findDuplicate(
  applications: Application[],
  company: string,
  position: string,
): Application | undefined {
  if (!company.trim() || !position.trim()) return undefined;
  return applications
    .filter(
      (app) =>
        normalize(app.company) === normalize(company) &&
        normalize(app.position) === normalize(position),
    )
    .sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))[0];
}

export type RequiredField = 'dateApplied' | 'company' | 'position';
export type FieldErrors = { [K in RequiredField]?: string | undefined };

/** Validation order, which is also the order focus checks for the first invalid field. */
export const REQUIRED_FIELDS: readonly RequiredField[] = ['dateApplied', 'company', 'position'];

export function validateRequired(values: Record<RequiredField, string>): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.dateApplied) errors.dateApplied = 'Enter the date you applied.';
  if (!values.company.trim()) errors.company = 'Enter a company.';
  if (!values.position.trim()) errors.position = 'Enter a position.';
  return errors;
}
