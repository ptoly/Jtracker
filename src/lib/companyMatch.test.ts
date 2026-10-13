import { describe, expect, it } from 'vitest';
import type { Application } from '../types/application';
import { companyKey, findCompanyMatches } from './companyMatch';

const app = (company: string, dateApplied = '2026-10-01'): Application => ({
  id: `${company}-${dateApplied}`,
  dateApplied,
  company,
  position: 'Engineer',
  status: 'Applied',
});

describe('companyKey', () => {
  it('trims, lowercases and drops suffixes', () => {
    expect(companyKey('  Acme, Inc. ')).toBe('acme');
    expect(companyKey('Acme LLC')).toBe('acme');
    expect(companyKey('Tinderleaf Co.')).toBe('tinderleaf');
    expect(companyKey('Northwind Corp Ltd')).toBe('northwind');
  });

  it('keeps a name that is only a suffix', () => {
    expect(companyKey('Company')).toBe('company');
  });
});

describe('findCompanyMatches', () => {
  const apps = [
    app('Copperwick Labs', '2026-09-01'),
    app('copperwick labs inc', '2026-10-01'),
    app('Kestrel Harbor Labs'),
    app('Acme'),
  ];

  it('needs two characters', () => {
    expect(findCompanyMatches(apps, 'c')).toEqual([]);
    expect(findCompanyMatches(apps, 'co')).toHaveLength(1);
  });

  it('groups a company across spellings, newest first', () => {
    const [match] = findCompanyMatches(apps, ' COPPERWICK Labs, LLC ');
    expect(match?.company).toBe('copperwick labs inc');
    expect(match?.applications.map((a) => a.dateApplied)).toEqual(['2026-10-01', '2026-09-01']);
  });

  it('matches the start of any word', () => {
    expect(findCompanyMatches(apps, 'labs').map((m) => m.company)).toEqual([
      'copperwick labs inc',
      'Kestrel Harbor Labs',
    ]);
    expect(findCompanyMatches(apps, 'arbor')).toEqual([]);
  });
});
