// Fixtures are fictional.
import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { applicationsToCsv, csvToApplications, NEW_FILE_HEADER } from './csvRows';

const TODAY = new Date(2026, 9, 14);

describe('applicationsToCsv', () => {
  it('writes the new-file columns with full dates', () => {
    const text = applicationsToCsv([
      {
        id: 'a1',
        dateApplied: '2026-10-02',
        company: 'Heronfold Labs',
        position: 'Product Designer',
        status: 'Followed Up',
        followedUpDate: '2026-10-09',
        notes: 'Portfolio review, then a call',
      },
    ]);
    expect(parseCsv(text)).toEqual([
      NEW_FILE_HEADER,
      [
        '10/2/2026',
        'Heronfold Labs',
        'Product Designer',
        'Followed Up',
        '10/9/2026',
        'Portfolio review, then a call',
        'a1',
      ],
    ]);
  });
});

describe('csvToApplications', () => {
  it('reads an export back, with fresh IDs', () => {
    const exported = applicationsToCsv([
      {
        id: 'a1',
        dateApplied: '2026-10-02',
        company: 'Heronfold Labs',
        position: 'Product Designer',
        status: 'Applied',
      },
    ]);
    const result = csvToApplications(exported, TODAY);
    if ('error' in result) throw new Error(result.error);
    expect(result.applications).toEqual([
      {
        id: expect.not.stringMatching(/^a1$/),
        dateApplied: '2026-10-02',
        company: 'Heronfold Labs',
        position: 'Product Designer',
        status: 'Applied',
      },
    ]);
    expect(result.issues).toEqual([]);
  });

  it('reads a Sheet download: no years, blank status, extra columns', () => {
    const result = csvToApplications(
      'Date,Company,Position,Status,Age,Notes\n10/2,Heronfold Labs,UX Designer,,12,\n',
      TODAY,
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.applications[0]).toMatchObject({ dateApplied: '2026-10-02', status: 'Applied' });
  });

  it('explains a file without the needed columns', () => {
    expect(csvToApplications('Name,Email\n', TODAY)).toEqual({
      error: expect.stringContaining('Date, Company, Position, Status'),
    });
  });
});
