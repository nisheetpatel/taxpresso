// Dates in exports, to ISO yyyy-mm-dd. Formats are told apart per file: a file that writes
// 31/12/2026 is day first; one that writes 12/31/2026 is month first. Never guessed per value.

export type DateFormat = 'ymd' | 'ymd-dash' | 'dmy' | 'mdy' | 'dmy-dot' | 'dmy-dash' | 'd-mon-y';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1) return undefined;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > days) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** The date part of an IBKR dateTime: "20260325;202000", "2026-03-25, 20:20:00", "20260325". */
export function datePart(value: string): string {
  const v = value.trim();
  const sep = v.search(/[;, ]|(?<=\d)T(?=\d)/);
  if (sep > 0) return v.slice(0, sep);
  return /^\d{14}$/.test(v) ? v.slice(0, 8) : v;
}

export function parseDate(value: string, format: DateFormat): string | undefined {
  const v = datePart(value);
  let m: RegExpMatchArray | null;
  switch (format) {
    case 'ymd':
      m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
      return m ? iso(+m[1]!, +m[2]!, +m[3]!) : undefined;
    case 'ymd-dash':
      m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? iso(+m[1]!, +m[2]!, +m[3]!) : undefined;
    case 'dmy':
      m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      return m ? iso(year(m[3]!), +m[2]!, +m[1]!) : undefined;
    case 'mdy':
      m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      return m ? iso(year(m[3]!), +m[1]!, +m[2]!) : undefined;
    case 'dmy-dot':
      m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
      return m ? iso(year(m[3]!), +m[2]!, +m[1]!) : undefined;
    case 'dmy-dash':
      m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      return m ? iso(+m[3]!, +m[2]!, +m[1]!) : undefined;
    case 'd-mon-y': {
      m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
      const month = m ? MONTHS.indexOf(m[2]!.toLowerCase()) + 1 : 0;
      return m && month ? iso(year(m[3]!), month, +m[1]!) : undefined;
    }
  }
}

/**
 * The one format that reads every sample. Slash dates are day first or month first: a day above
 * 12 decides; if nothing decides, the format is unknown (undefined) rather than guessed.
 */
export function detectDateFormat(samples: readonly string[]): DateFormat | undefined {
  const values = samples.map(datePart).filter((v) => v !== '');
  if (!values.length) return undefined;
  const candidates: DateFormat[] = ['ymd', 'ymd-dash', 'dmy-dot', 'dmy-dash', 'd-mon-y'];
  for (const f of candidates) {
    if (values.every((v) => parseDate(v, f) !== undefined)) return f;
  }
  const dmy = values.every((v) => parseDate(v, 'dmy') !== undefined);
  const mdy = values.every((v) => parseDate(v, 'mdy') !== undefined);
  if (dmy && !mdy) return 'dmy';
  if (mdy && !dmy) return 'mdy';
  return undefined;
}
