import type { Application } from '../types/application';
import { parseIsoDate } from './dates';

export const DEFAULT_FOLLOW_UP_DAYS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/**
 * The only follow-up rule: status is Applied, it has never been followed up,
 * and at least `followUpDays` have passed since applying. Nothing else is ever due.
 */
export function isFollowUpDue(
  app: Application,
  followUpDays: number = DEFAULT_FOLLOW_UP_DAYS,
  today: Date = new Date(),
): boolean {
  return (
    app.status === 'Applied' &&
    app.followedUpDate === undefined &&
    ageInDays(app, today) >= followUpDays
  );
}
