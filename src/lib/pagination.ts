/** A page number, or a gap standing for the pages left out. */
export type PageItem = number | 'gap';

/** Seven slots at most, so the bar doesn't change width from page to page. */
const MAX_ITEMS = 7;

/**
 * Page numbers for a pagination bar: every page when there are 7 or fewer;
 * otherwise the first and last pages, the current page and its neighbours,
 * and a gap for each run left out ("1 … 4 5 6 … 10").
 */
export function pageItems(current: number, count: number): PageItem[] {
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);
  if (count <= MAX_ITEMS) return range(1, count);
  if (current <= 4) return [...range(1, 5), 'gap', count];
  if (current >= count - 3) return [1, 'gap', ...range(count - 4, count)];
  return [1, 'gap', current - 1, current, current + 1, 'gap', count];
}
