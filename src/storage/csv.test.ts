import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads plain and quoted cells, with \\r\\n or \\n line ends', () => {
    expect(parseCsv('a,b\r\n1,"x, ""y"""\n')).toEqual([
      ['a', 'b'],
      ['1', 'x, "y"'],
    ]);
  });

  it('keeps line breaks inside quotes and empty cells', () => {
    expect(parseCsv('a,,c\n"one\ntwo",,\n')).toEqual([
      ['a', '', 'c'],
      ['one\ntwo', '', ''],
    ]);
  });

  it('drops a byte-order mark and reads a last line without a line end', () => {
    expect(parseCsv('﻿Date,Company\n10/2,Acme')).toEqual([
      ['Date', 'Company'],
      ['10/2', 'Acme'],
    ]);
  });
});

describe('toCsv', () => {
  it('quotes only cells that need it, and round-trips', () => {
    const rows = [
      ['Date', 'Notes'],
      ['10/2/2026', 'Said "hi", then left\nfor lunch'],
      ['', ' padded '],
    ];
    const text = toCsv(rows);
    expect(text).toBe(
      'Date,Notes\r\n10/2/2026,"Said ""hi"", then left\nfor lunch"\r\n," padded "\r\n',
    );
    expect(parseCsv(text)).toEqual(rows);
  });
});
