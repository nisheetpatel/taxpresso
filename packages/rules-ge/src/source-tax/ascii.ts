// Reads a cantonal source-tax tariff file (tarjjkt.txt) in the ESTV record format, and packs its
// progressive tariffs into the compact form stored under data/ge/<year>/source-tax/.
// Layout: ch-na-is-recordformat-salaires (record 00 p. 2, record 06 p. 3, records 11 to 13 pp. 3
// and 4, record 99 p. 5, tariff codes p. 6 and 7, monthly incomes p. 8, minimum tax p. 8).
// scripts/source-tax-tables.mjs reads and packs with it; at runtime only expandTariff runs. No
// imports: Node runs this file directly (type stripping). Every structural surprise throws, so a
// changed format never slips through.

export interface TariffRow {
  /** Monthly income from which the row applies, in centimes (field 6). */
  from: number;
  /** Tariff step in centimes (field 7). */
  step: number;
  children: number;
  /** Minimum tax in centimes (field 10). */
  minimum: number;
  /** Tax rate in hundredths of a percent (field 11): 4052 = 40.52 %. */
  rateBp: number;
}

export interface TariffFile {
  canton: string;
  /** Creation date of the file, YYYY-MM-DD (record 00, field 4). */
  created: string;
  /** First day of validity, YYYY-MM-DD (records 06, field 5). */
  validFrom: string;
  /** Records in the file, including the first and the last (record 99, field 4). */
  records: number;
  /** Progressive tariffs (record 06) by code, e.g. "A0N", rows in increasing income order. */
  tariffs: Record<string, TariffRow[]>;
}

/**
 * Monthly incomes as [first income, step between rows, number of rows] runs, one rate per row, and
 * where the table ends (the top row's income plus its step: amounts from there on aren't covered).
 */
export interface CompactTariff {
  bands: [number, number, number][];
  rates: number[];
  top: number;
}

const date = (s: string, what: string): string => {
  if (!/^\d{8}$/.test(s)) throw new Error(`${what}: not a date (${s})`);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

const digits = (s: string, what: string): number => {
  if (!/^\d+$/.test(s)) throw new Error(`${what}: not a number (${JSON.stringify(s)})`);
  return Number(s);
};

/** Parses a whole file. Line endings CRLF or LF; the last line may lack one. */
export function parseTariffFile(text: string): TariffFile {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const first = lines[0];
  const last = lines.at(-1);
  if (!first?.startsWith('00') || !last?.startsWith('99')) {
    throw new Error('The file must start with record 00 and end with record 99.');
  }
  const canton = first.slice(2, 4);
  const created = date(first.slice(19, 27), 'record 00 creation date');
  if (last.slice(17, 19) !== canton) throw new Error('Record 99: canton differs from record 00.');
  const records = digits(last.slice(19, 27), 'record 99 count');
  if (records !== lines.length) {
    throw new Error(`Record 99 announces ${records} records, the file has ${lines.length}.`);
  }

  const tariffs: Record<string, TariffRow[]> = {};
  let validFrom: string | undefined;
  lines.slice(1, -1).forEach((line, i) => {
    const kind = line.slice(0, 2);
    const where = `line ${i + 2}`;
    if (kind === '11' || kind === '12' || kind === '13') return; // fixed categories, not used
    if (kind !== '06') throw new Error(`${where}: unknown record ${kind}`);
    if (line.length < 59) throw new Error(`${where}: record 06 too short`);
    if (line.slice(2, 4) !== '01') {
      throw new Error(`${where}: transaction ${line.slice(2, 4)}, only 01 (new) is read`);
    }
    if (line.slice(4, 6) !== canton) throw new Error(`${where}: another canton`);
    const code = line.slice(6, 16).trim();
    if (!/^[A-Z][0-9][NY]$/.test(code)) throw new Error(`${where}: unexpected code ${code}`);
    const from = date(line.slice(16, 24), `${where} validity`);
    if (validFrom !== undefined && from !== validFrom) {
      throw new Error(`${where}: validity ${from} differs from ${validFrom}`);
    }
    validFrom = from;
    (tariffs[code] ??= []).push({
      from: digits(line.slice(24, 33), `${where} income`),
      step: digits(line.slice(33, 42), `${where} step`),
      children: digits(line.slice(43, 45), `${where} children`),
      minimum: digits(line.slice(45, 54), `${where} minimum`),
      rateBp: digits(line.slice(54, 59), `${where} rate`),
    });
  });
  if (!validFrom) throw new Error('No tariff records (06) in the file.');
  return { canton, created, validFrom, records, tariffs };
}

/**
 * Checks one progressive tariff and packs it. Rows must start at 0, follow each other without gap
 * or overlap (a row reaches either the next row's income or 5 centimes below it, as the readable
 * tables print "0 - 2'449.95" then "2'450 - 2'499.95"), have no minimum tax and rates that never
 * decrease. Anything else throws.
 */
export function compactTariff(code: string, rows: readonly TariffRow[]): CompactTariff {
  if (rows.length < 2) throw new Error(`${code}: not a progressive tariff`);
  if (rows[0]!.from !== 0) throw new Error(`${code}: does not start at 0`);
  const children = Number(code[1]);
  rows.forEach((r, i) => {
    if (r.minimum !== 0) throw new Error(`${code}: a minimum tax, which this reader doesn't apply`);
    if (r.children !== children) throw new Error(`${code}: row ${i} has ${r.children} children`);
    const next = rows[i + 1];
    if (!next) return;
    if (next.from <= r.from) throw new Error(`${code}: incomes not increasing at row ${i}`);
    if (r.from + r.step !== next.from && r.from + r.step + 5 !== next.from) {
      throw new Error(`${code}: gap or overlap after row ${i}`);
    }
    if (next.rateBp < r.rateBp) throw new Error(`${code}: rate decreases at row ${i + 1}`);
  });
  // A row joins the current run when it sits where the run's step puts it; otherwise it starts a
  // new run whose step is the distance to the next row.
  const bands: [number, number, number][] = [];
  rows.forEach((r, i) => {
    const band = bands.at(-1);
    if (band && band[0] + band[1] * band[2] === r.from) band[2]++;
    else bands.push([r.from, (rows[i + 1]?.from ?? r.from + 1) - r.from, 1]);
  });
  const last = rows.at(-1)!;
  const packed = { bands, rates: rows.map((r) => r.rateBp), top: last.from + last.step };
  const back = expandTariff(packed);
  if (back.from.length !== rows.length || back.from.some((f, i) => f !== rows[i]!.from)) {
    throw new Error(`${code}: packing does not give the rows back`);
  }
  return packed;
}

/** The monthly income where each row starts, in centimes, and its rate. */
export function expandTariff(t: CompactTariff): { from: number[]; rates: number[]; top: number } {
  const from: number[] = [];
  for (const [start, step, count] of t.bands) {
    for (let k = 0; k < count; k++) from.push(start + k * step);
  }
  if (from.length !== t.rates.length) throw new Error('Bands and rates differ in length.');
  if (!(t.top > from.at(-1)!)) throw new Error('The table ends before its last row.');
  return { from, rates: t.rates, top: t.top };
}
