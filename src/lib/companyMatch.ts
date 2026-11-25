import type { Application } from '../types/application';

/** Legal-form words that don't tell companies apart ("Acme Inc" is "Acme LLC"). */
const SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'llp',
  'ltd',
  'limited',
  'co',
  'corp',
  'corporation',
  'company',
  'plc',
  'gmbh',
]);

/** Shortest query that is checked; one letter would match half the list. */
export const MIN_COMPANY_QUERY = 2;

/**
 * Comparison key for a company name: trimmed, lowercased, commas and periods
 * dropped, spaces collapsed, and trailing suffixes like Inc / LLC / Ltd
 * removed (unless that would leave nothing).
 */
export function companyKey(name: string): string {
  const words = name.toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1] ?? '')) words.pop();
  return words.join(' ');
}

export interface CompanyMatch {
  /** The company as most recently entered. */
  company: string;
  /** Its applications, newest first. */
  applications: Application[];
}

/**
 * Companies applied to before whose name, or any word in it, starts with
 * `query` ("cop" and "labs" both find "Copperwick Labs"). Each company
 * appears once, with all of its applications; nothing until the query has
 * MIN_COMPANY_QUERY characters.
 */
export function findCompanyMatches(applications: Application[], query: string): CompanyMatch[] {
  const needle = companyKey(query);
  if (needle.length < MIN_COMPANY_QUERY) return [];

  const byKey = new Map<string, Application[]>();
  for (const app of applications) {
    const key = companyKey(app.company);
    if (!key.startsWith(needle) && !key.includes(` ${needle}`)) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), app]);
  }

  return [...byKey.values()].map((apps) => {
    const newestFirst = [...apps].sort((a, b) => b.dateApplied.localeCompare(a.dateApplied));
    return { company: newestFirst[0]?.company.trim() ?? '', applications: newestFirst };
  });
}

/** "Applied to <Company> before:", or "Skipped <Company> before:" when every role there was skipped. */
export function matchTitle({ company, applications }: CompanyMatch): string {
  const allSkipped = applications.every((app) => app.status === 'Skipped');
  return allSkipped ? `Skipped ${company} before:` : `Applied to ${company} before:`;
}

/**
 * The line the add form announces: "Applied to <Company> before: N applications",
 * plus ", N skipped" for roles passed on there.
 */
export function matchSummary(match: CompanyMatch): string {
  const skipped = match.applications.filter((app) => app.status === 'Skipped').length;
  const applied = match.applications.length - skipped;
  if (applied === 0) return `${matchTitle(match)} ${skipped} role${skipped === 1 ? '' : 's'}`;
  const summary = `${matchTitle(match)} ${applied} application${applied === 1 ? '' : 's'}`;
  return skipped > 0 ? `${summary}, ${skipped} skipped` : summary;
}
