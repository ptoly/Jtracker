import type { Application, Status } from '../types/application';

export const DEFAULT_FOLLOW_UP_DAYS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Statuses still waiting on the employer, where a nudge makes sense. */
const AWAITING_RESPONSE: readonly Status[] = ['Applied', 'Followed Up'];

/** Parse YYYY-MM-DD as a local calendar date (avoids the UTC off-by-one of `new Date(iso)`). */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? NaN, (m ?? NaN) - 1, d ?? NaN);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(fromIso: string, today: Date): number {
  const diff = startOfDay(today).getTime() - parseIsoDate(fromIso).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Whole days since the application was submitted. */
export function ageInDays(app: Application, today: Date = new Date()): number {
  return daysBetween(app.dateApplied, today);
}

/** Whole days since the last outbound contact (follow-up if any, else the application). */
export function daysSinceLastContact(app: Application, today: Date = new Date()): number {
  return daysBetween(app.followedUpDate ?? app.dateApplied, today);
}

/**
 * True when the application is still awaiting a response and at least
 * `followUpDays` have passed since the last contact.
 */
export function isFollowUpDue(
  app: Application,
  followUpDays: number = DEFAULT_FOLLOW_UP_DAYS,
  today: Date = new Date(),
): boolean {
  return AWAITING_RESPONSE.includes(app.status) && daysSinceLastContact(app, today) >= followUpDays;
}
