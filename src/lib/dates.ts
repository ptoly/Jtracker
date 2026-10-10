/** Parse YYYY-MM-DD as a local calendar date (avoids the UTC off-by-one of `new Date(iso)`). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? NaN, (m ?? NaN) - 1, d ?? NaN);
}

/** Local calendar date as YYYY-MM-DD (the format stored and used by <input type="date">). */
export function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** m.d.yy, e.g. "10.9.26". */
export function formatShortDate(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${date.getMonth() + 1}.${date.getDate()}.${yy}`;
}

const spokenDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "October 9, 2026" — what screen readers hear instead of m.d.yy. */
export function formatSpokenDate(date: Date): string {
  return spokenDate.format(date);
}
