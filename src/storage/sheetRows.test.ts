// Fixtures are fictional.
import { describe, expect, it } from 'vitest';
import {
  cellInput,
  columnLetter,
  isWritableId,
  issuesOf,
  matchHeaders,
  newRowCells,
  parseSheet,
  parseSheetDate,
  parseStatus,
  quoteTab,
  rowFromRange,
  rowsWithId,
  serialToIsoDate,
  type Cell,
  type ParsedSheet,
} from './sheetRows';

function parsed(values: Cell[][]): ParsedSheet {
  const result = parseSheet(values);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('columnLetter', () => {
  it('converts zero-based indexes to letters', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual([
      'A',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });
});

describe('dates', () => {
  it('converts serial numbers, dropping the time of day', () => {
    expect(serialToIsoDate(46304)).toBe('2026-10-09');
    expect(serialToIsoDate(46304.75)).toBe('2026-10-09');
    expect(serialToIsoDate(1)).toBe('1899-12-31');
  });

  it('reads text dates', () => {
    expect(parseSheetDate('2026-10-09')).toBe('2026-10-09');
    expect(parseSheetDate('2026-1-9')).toBe('2026-01-09');
    expect(parseSheetDate('10/9/2026')).toBe('2026-10-09');
    expect(parseSheetDate('10/9/26')).toBe('2026-10-09');
    expect(parseSheetDate(' 10.9.26 ')).toBe('2026-10-09');
  });

  it('returns empty for blanks and null for unreadable dates', () => {
    expect(parseSheetDate(undefined)).toBe('');
    expect(parseSheetDate('  ')).toBe('');
    expect(parseSheetDate('next Tuesday')).toBeNull();
    expect(parseSheetDate('2/30/2026')).toBeNull();
    expect(parseSheetDate('10/9.26')).toBeNull();
    expect(parseSheetDate(0)).toBeNull();
  });

  it('reads M/D with no year as the latest such date on or before today', () => {
    const today = new Date(2026, 9, 14); // October 14, 2026
    expect(parseSheetDate('10/2', today)).toBe('2026-10-02');
    expect(parseSheetDate('10/14', today)).toBe('2026-10-14');
    expect(parseSheetDate('12/30', today)).toBe('2025-12-30');
    expect(parseSheetDate('2/30', today)).toBeNull();
    // Without today, a yearless date isn't guessed.
    expect(parseSheetDate('10/2')).toBeNull();
  });
});

describe('parseStatus', () => {
  it('reads an empty status as Applied and Passed as Filled', () => {
    expect(parseStatus(undefined)).toBe('Applied');
    expect(parseStatus('  ')).toBe('Applied');
    expect(parseStatus('Passed')).toBe('Filled');
    expect(parseStatus('followed up')).toBe('Followed Up');
    expect(parseStatus('Interviewed - Rejected')).toBe('Interviewed - Rejected');
    expect(parseStatus('interviewed – rejected')).toBe('Interviewed - Rejected');
    expect(parseStatus('Interviewed-Rejected')).toBe('Interviewed - Rejected');
    expect(parseStatus('Ghosted')).toBeNull();
  });
});

describe('matchHeaders', () => {
  it('matches trimmed, case-insensitive names and ignores unknown columns', () => {
    const result = matchHeaders([
      ' date ',
      'Contact',
      'COMPANY',
      'position',
      'Status',
      'Age',
      'id',
    ]);
    expect(result).toEqual({
      columns: { dateApplied: 0, company: 2, position: 3, status: 4, age: 5, id: 6 },
    });
  });

  it('names missing required columns', () => {
    expect(matchHeaders(['Date', 'Company'])).toEqual({
      error: 'The header row (row 1) needs these columns: Position, Status.',
    });
  });

  it('rejects duplicate columns', () => {
    const result = matchHeaders(['Date', 'Company', 'Position', 'Status', 'Notes', 'notes']);
    expect(result).toEqual({ error: 'The header row has more than one Notes column.' });
  });
});

describe('parseSheet', () => {
  const header = ['Date', 'Company', 'Position', 'Status', 'Followed Up', 'Notes', 'Age', 'ID'];

  it('reads rows into applications', () => {
    const sheet = parsed([
      header,
      [46304, 'Example Co', 'Designer', 'applied', '', '', 2, 'id-1'],
      ['10/1/26', 'Sample Labs', 'Engineer', 'Followed Up', 46304, 'Referred', 9, 'id-2'],
    ]);
    expect(sheet.rows.map((row) => row.application)).toEqual([
      {
        id: 'id-1',
        dateApplied: '2026-10-09',
        company: 'Example Co',
        position: 'Designer',
        status: 'Applied',
      },
      {
        id: 'id-2',
        dateApplied: '2026-10-01',
        company: 'Sample Labs',
        position: 'Engineer',
        status: 'Followed Up',
        followedUpDate: '2026-10-09',
        notes: 'Referred',
      },
    ]);
    expect(issuesOf(sheet)).toEqual([]);
  });

  it('keeps rows with problems and lists them', () => {
    const sheet = parsed([
      header,
      ['soon', 'Example Co', 'Designer', 'Ghosted', 'yes', '', '', 'id-1'],
      [46304, '', 'Designer', '', '', '', '', 'id-2'],
    ]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]?.application).toMatchObject({
      dateApplied: '',
      status: '',
      unparsed: { dateApplied: 'soon', status: 'Ghosted', followedUpDate: 'yes' },
    });
    expect(issuesOf(sheet)).toEqual([
      {
        row: 2,
        problems: [
          'date “soon” not recognized',
          'status “Ghosted” not recognized',
          'followed-up date “yes” not recognized',
        ],
      },
      { row: 3, problems: ['no company'] },
    ]);
  });

  it('skips rows with nothing in Jtracker’s columns, even with an Age formula result', () => {
    const sheet = parsed([
      header,
      [],
      ['', '', '', '', '', '', 46304, ''],
      [46304, 'A', 'B', 'Applied'],
    ]);
    expect(sheet.rows.map((row) => row.rowNumber)).toEqual([4]);
  });

  it('gives rows without an ID, or with a shared ID, ids that can’t be written', () => {
    const sheet = parsed([
      header,
      [46304, 'A', 'B', 'Applied'],
      [46304, 'C', 'D', 'Applied', '', '', '', 'same'],
      [46304, 'E', 'F', 'Applied', '', '', '', 'same'],
    ]);
    const ids = sheet.rows.map((row) => row.application.id);
    expect(ids).toEqual(['#row-2', '#row-3', '#row-4']);
    expect(ids.some(isWritableId)).toBe(false);
    expect(rowsWithId(sheet, 'same').map((row) => row.rowNumber)).toEqual([3, 4]);
    expect(issuesOf(sheet).map((issue) => issue.row)).toEqual([3, 4]);
  });

  it('reports a missing header row', () => {
    expect(parseSheet([])).toHaveProperty('error');
    expect(parseSheet([['', '']])).toHaveProperty('error');
  });
});

describe('writing', () => {
  it('keeps text as text and dates as dates', () => {
    expect(cellInput('notes', '=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(cellInput('company', '3/4')).toBe(`'3/4`);
    expect(cellInput('dateApplied', '2026-10-09')).toBe('2026-10-09');
    expect(cellInput('notes', undefined)).toBe('');
  });

  it('places a new row’s cells by column, leaving others blank', () => {
    const columns = { status: 0, dateApplied: 1, company: 2, position: 3, age: 4, id: 6 };
    const cells = newRowCells(
      { dateApplied: '2026-10-09', company: 'Example Co', position: 'Designer', status: 'Applied' },
      'new-id',
      columns,
    );
    expect(cells).toEqual([
      "'Applied",
      '2026-10-09',
      "'Example Co",
      "'Designer",
      '',
      '',
      "'new-id",
    ]);
  });

  it('reads the row from an append range', () => {
    expect(rowFromRange("'Sheet1'!A31:H31")).toBe(31);
    expect(rowFromRange('Sheet1!AB7')).toBe(7);
  });

  it('quotes tab names', () => {
    expect(quoteTab("Jo's jobs")).toBe("'Jo''s jobs'");
  });
});
