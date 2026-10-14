// Pure CSV text ⇄ cells (RFC 4180). No file access.

/**
 * Cells from CSV text: commas between cells, double quotes around a cell
 * that holds a comma, quote or line break ("" inside is one quote). Takes
 * \r\n or \n line ends and drops a leading byte-order mark. A final line end
 * doesn't add an empty row.
 */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** One cell as CSV: quoted only when it has to be. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) || value !== value.trim()
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** CSV text from cells, each row ended with `eol` (Google Sheets downloads use \r\n). */
export function toCsv(rows: string[][], eol = '\r\n'): string {
  return rows.map((row) => row.map(csvCell).join(',') + eol).join('');
}
