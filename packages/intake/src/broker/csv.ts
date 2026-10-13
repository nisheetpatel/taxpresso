// A small CSV reader (RFC 4180: quoted fields, doubled quotes, CRLF or LF), so no parser
// dependency ships in the extension. Each row keeps its line number for warnings.

export interface CsvRow {
  /** 1-based line where the row starts. */
  line: number;
  cells: string[];
}

export type Delimiter = ',' | ';' | '\t';

/** The delimiter of a header line: the most frequent of , ; and tab outside quotes. */
export function sniffDelimiter(headerLine: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++;
  }
  return (Object.entries(counts) as [Delimiter, number][]).reduce((best, cur) =>
    cur[1] > best[1] ? cur : best,
  )[0];
}

/** The first line of a text, without its line break. */
export function firstLine(text: string): string {
  const end = text.search(/\r?\n/);
  return end < 0 ? text : text.slice(0, end);
}

export function parseCsv(text: string, delimiter: Delimiter): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endRow = () => {
    cells.push(cell);
    // Skip blank lines.
    if (cells.length > 1 || cells[0] !== '') rows.push({ line: rowLine, cells });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || cells.length) endRow();
  return rows;
}
