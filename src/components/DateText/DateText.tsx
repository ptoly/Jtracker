import { formatShortDate, formatSpokenDate, parseIsoDate } from '../../lib/dates';

/** Shows m.d.yy; screen readers get "October 9, 2026" instead of "10 point 9 point 26". */
export function DateText({ iso }: { iso: string }) {
  const date = parseIsoDate(iso);
  return (
    <time dateTime={iso}>
      <span aria-hidden="true">{formatShortDate(date)}</span>
      <span className="sr-only">{formatSpokenDate(date)}</span>
    </time>
  );
}
