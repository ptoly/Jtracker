// Runs the adapter against an in-memory stand-in for a picked file. Fixtures are fictional.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCsv } from './csv';
import { createCsvFileAdapter } from './csvFileAdapter';
import { StorageError } from './errors';

const TODAY = new Date(2026, 9, 14); // October 14, 2026

/** A FileSystemFileHandle over a string; `saves` counts writes. */
function fakeFile(text: string, name = 'jobs.csv') {
  const file = { text, saves: 0 };
  const handle = {
    name,
    async getFile() {
      return { text: async () => file.text };
    },
    async createWritable() {
      let pending = '';
      return {
        async write(data: string) {
          pending = data;
        },
        async close() {
          file.text = pending;
          file.saves += 1;
        },
      };
    },
  } as unknown as FileSystemFileHandle;
  return { file, adapter: createCsvFileAdapter({ handle, today: TODAY }) };
}

const CSV = [
  'Date,Company,Position,Status,Age,Followed Up,Notes,ID',
  '10/2,Acme Labs,Frontend Engineer,,12,,"Referred, by Pat",id-1',
  '9/22,Birch & Co,UI Developer,Rejected,22,,,id-2',
  '',
].join('\r\n');

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

describe('createCsvFileAdapter', () => {
  it('lists rows, reading dates without a year and a blank status as Applied', async () => {
    const { file, adapter } = fakeFile(CSV);
    const { applications, issues } = await adapter.list();
    expect(applications).toEqual([
      {
        id: 'id-1',
        dateApplied: '2026-10-02',
        company: 'Acme Labs',
        position: 'Frontend Engineer',
        status: 'Applied',
        notes: 'Referred, by Pat',
      },
      {
        id: 'id-2',
        dateApplied: '2026-09-22',
        company: 'Birch & Co',
        position: 'UI Developer',
        status: 'Rejected',
      },
    ]);
    expect(issues).toEqual([]);
    // Listing doesn't touch a file whose rows all have IDs.
    expect(file.saves).toBe(0);
  });

  it('adds a row with full dates, and drops the Age column on save', async () => {
    const { file, adapter } = fakeFile(CSV);
    const added = await adapter.add({
      dateApplied: '2026-10-14',
      company: 'Cedar, Inc',
      position: 'Web Developer',
      status: 'Applied',
    });
    expect(added).toMatchObject({ company: 'Cedar, Inc', dateApplied: '2026-10-14' });
    const rows = parseCsv(file.text);
    expect(rows[0]).toEqual([
      'Date',
      'Company',
      'Position',
      'Status',
      'Followed Up',
      'Notes',
      'ID',
    ]);
    expect(rows[3]).toEqual([
      '10/14/2026',
      'Cedar, Inc',
      'Web Developer',
      'Applied',
      '',
      '',
      added.id,
    ]);
    // The file keeps its own line ends.
    expect(file.text.endsWith('\r\n')).toBe(true);
  });

  it('updates and clears cells, and removes rows, by ID', async () => {
    const { file, adapter } = fakeFile(CSV);
    const updated = await adapter.update('id-1', {
      status: 'Followed Up',
      followedUpDate: '2026-10-13',
      notes: undefined,
    });
    expect(updated).toMatchObject({ status: 'Followed Up', followedUpDate: '2026-10-13' });
    expect(updated.notes).toBeUndefined();
    expect(parseCsv(file.text)[1]).toEqual([
      '10/2',
      'Acme Labs',
      'Frontend Engineer',
      'Followed Up',
      '10/13/2026',
      '',
      'id-1',
    ]);

    await adapter.remove('id-2');
    expect(parseCsv(file.text)).toHaveLength(2);
    await expect(adapter.remove('id-2')).rejects.toBeInstanceOf(StorageError);
  });

  it('gives rows without an ID one, and saves them', async () => {
    const { file, adapter } = fakeFile('Date,Company,Position,Status\n10/2,Acme,Engineer,\n');
    const { applications } = await adapter.list();
    expect(applications[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parseCsv(file.text)[0]).toEqual(['Date', 'Company', 'Position', 'Status', 'ID']);
    expect(file.text.endsWith('\n')).toBe(true);
  });

  it('renames a position on every row and keeps the list per file', async () => {
    const { adapter } = fakeFile(CSV);
    await adapter.updatePositions(() => ({ added: ['frontend engineer'], hidden: [] }));
    const result = await adapter.renamePosition('frontend engineer', 'Front-End Engineer');
    expect(result.changed).toBe(1);
    expect((await adapter.list()).applications[0]?.position).toBe('Front-End Engineer');
  });

  it('says what’s wrong with a file that isn’t a job list', async () => {
    const { adapter } = fakeFile('Name,Email\nPat,pat@example.com\n');
    await expect(adapter.list()).rejects.toMatchObject({ kind: 'sheet' });
  });
});
