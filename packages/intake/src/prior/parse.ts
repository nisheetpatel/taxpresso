// Reads last year's Geneva declaration (SPEC.md section 5.4) from the text of its pages: the
// rubric lines of the official form ("31.40  Cotisations 3e pilier A  7'258  7'258"), the civil
// status and the commune. Keyed on the official rubric codes, which GeTax and the approved
// programs all print, not on one program's layout. Pure: text in, form data out.
//
// Identity data (names, birth dates, phone, AHV, taxpayer and reference numbers, the address) is
// read in memory only, to tell whether there is a taxpayer B and which commune the address is in.
// None of it is returned, and warnings are built from codes and page numbers only.
import { hasAmountShape, parseAmount } from './amount.js';
import { lineText, linesFromText } from './layout.js';
import { priorWarning } from './messages.js';
import type {
  Cell,
  CivilStatus,
  CommuneLookup,
  Line,
  PageInput,
  PriorDeclaration,
  PriorItem,
  PriorParts,
  PriorPerson,
  PriorWarning,
} from './types.js';

/** "31.40", not part of a date ("12.03.2025") or a longer number; maybe "r" after it. */
const CODE = /^\|?\s*(\d{2}\.\d{2})(?![.\d])(?:\s+([a-z])(?=\s|$))?\s*\|?\s*(.*)$/;
/** GeTax page codes: GAPP24-1 (main page 1 for 2024), GAPP24A1 (annex A, taxpayer A). */
const GAPP_MAIN = /\bGAPP(\d{2})-([1-4])\b/;
const GAPP_ANNEX = /\bGAPP(\d{2})([A-F]\d{0,2})\b/;
const PG = /\bPG\s?([1-4])\b/;
const PAGE_OF = /\bPage\s+(\d{1,3})\s*\/\s*(\d{1,3})\b/i;
const DATE = /\b\d{1,2}\.\d{1,2}\.(19|20)\d{2}\b/g;
const ANNEX_REF = /^([A-F])\s?(\d{0,2})$/;
const BOX = /^\d{1,2}(?:\.\d){1,2}$/;
/** Tick boxes: "Oui", "Non", a cross or a box glyph, alone or together. */
const MARK = /^(?:(?:oui|non|x|[☐-☒■□✓✔])\s*)+$/i;
/** A rubric code quoted in a label ("total moins 0.5% du code 92.20"): not an amount. */
const QUOTED_CODE = /^\d{2}\.\d{2}$/;
/** The rows of a small table under a code (71.00 medical costs: A, B, children, total). */
const TABLE_ROW = /^(contribuable|enfants?|total|icc|ifd|conjoint)\b/;
/** Which person a table row is for, from its heading ("Contribuable A", "Contr. B", "Enfant(s)"). */
const PART_ROW: [RegExp, keyof PriorParts][] = [
  [/^(contribuable|contr\.?)\s*a\b/, 'A'],
  [/^(contribuable|contr\.?)\s*b\b/, 'B'],
  [/^enfants?\b|^enfant\(s\)/, 'children'],
  [/^total\s*$/, 'total'],
];
/** Commune codes (code lieu): Geneva communes, cantons, countries (guide p. 59). */
const isPlaceCode = (n: number) =>
  (n >= 6601 && n <= 6645) || (n >= 9001 && n <= 9026) || (n >= 8100 && n <= 8999);

/**
 * Lines printed in one column only, for when the page gives no way to tell the columns apart
 * (ge-2025-guide-declaration-pp p. 15, 19 to 21, 30 and 31). The wealth page is cantonal only.
 */
const ICC_ONLY = new Set([
  '31.50',
  '41.50',
  '31.70',
  '41.70',
  '31.95',
  '41.95',
  '52.15',
  '59.10',
  '61.25',
  '61.30',
  '73.10',
]);
const IFD_ONLY = new Set([
  '31.20',
  '41.20',
  '31.71',
  '41.71',
  '31.90',
  '41.90',
  '59.12',
  '59.20',
  '61.20',
  '73.20',
]);

/** Software approved in Geneva for personal declarations (ge-na-efiling-homologation). */
const SOFTWARE: [RegExp, string][] = [
  [/\bge\s?tax\b/i, 'GeTax'],
  [/\bdr\.?\s?tax\b/i, 'DrTax'],
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Amount {
  value: number;
  cell: Cell;
  /** Has a thousands apostrophe or centimes, so it can't be a box or a code. */
  shaped: boolean;
}

interface Segment {
  page: number;
  code: string;
  suffix?: string;
  annex?: string;
  box?: string;
  places: { code: number; cell: Cell }[];
  amounts: Amount[];
  /** Amounts on the lines under it (a small table): kept, and used for an empty column. */
  tail: Amount[];
  /** The table's rows headed by a person or "Total": the first amount of each. */
  parts: PriorParts;
}

interface Columns {
  /** Where the left and right amount columns end (or start, for left-aligned amounts). */
  left: number;
  right: number;
  edge: 'right' | 'x';
  /** true when the left column is the federal one (an IFD header left of the ICC one). */
  swapped: boolean;
}

interface PageScan {
  page: number;
  lines: Line[];
  form: string;
  year?: number;
  total?: number;
  segments: Segment[];
  swapped: boolean;
}

/** Which taxpayer a code belongs to by its number: 11.xx and 31.xx are A's, 21.xx and 41.xx B's. */
function codePerson(code: string): PriorPerson | undefined {
  const family = code.slice(0, 2);
  if (family === '11' || family === '31') return 'A';
  if (family === '21' || family === '41') return 'B';
  return undefined;
}

function rubricAt(cells: readonly Cell[], i: number) {
  const m = CODE.exec(cells[i]!.text);
  if (!m) return undefined;
  const rest = m[3] ?? '';
  const next = cells[i + 1]?.text ?? '';
  const after = cells[i + 2]?.text ?? '';
  const labelled =
    /\p{L}{2,}/u.test(rest) ||
    /^\p{L}{2,}/u.test(next) ||
    (/^[a-z]$/.test(next) && /\p{L}{2,}/u.test(after));
  if (!labelled && !(i === 0 && (rest !== '' || cells.length > 1))) return undefined;
  return { code: m[1]!, ...(m[2] ? { suffix: m[2] } : {}) };
}

function amountsOf(cell: Cell): Amount[] {
  const one = parseAmount(cell.text);
  if (one !== undefined) return [{ value: one, cell, shaped: hasAmountShape(cell.text) }];
  // Two amounts close together end up in one cell: "1'234 1'234".
  const parts = cell.text.split(' ');
  if (parts.length > 1 && parts.every((p) => hasAmountShape(p) && parseAmount(p) !== undefined)) {
    return parts.map((p) => ({ value: parseAmount(p)!, cell, shaped: true }));
  }
  return [];
}

const emptySegment = (page: number, code = ''): Segment => ({
  page,
  code,
  places: [],
  amounts: [],
  tail: [],
  parts: {},
});

/** Sorts one cell of a rubric line: suffix, tick box, annex, certificate box, commune, amount. */
function addCell(seg: Segment, cell: Cell, prev = ''): void {
  const text = cell.text.trim();
  if (QUOTED_CODE.test(text) && /\bcodes?\s*:?$/i.test(prev.trim())) return;
  if (!seg.suffix && seg.amounts.length === 0 && /^[a-z]$/.test(text)) {
    seg.suffix = text;
    return;
  }
  if (MARK.test(text)) return;
  const annex = ANNEX_REF.exec(text);
  if (annex) {
    seg.annex ??= `${annex[1]}${annex[2] ?? ''}`;
    return;
  }
  if (BOX.test(text)) {
    seg.box ??= text;
    return;
  }
  if (/^\d{4}$/.test(text) && isPlaceCode(Number(text))) {
    seg.places.push({ code: Number(text), cell });
    return;
  }
  // Anything else that isn't an amount is label text: read past, never kept.
  seg.amounts.push(...amountsOf(cell));
}

/** Splits a line into rubric segments; cells before the first code are not a rubric's. */
function segmentsOf(line: Line, page: number): Segment[] {
  const out: Segment[] = [];
  let seg: Segment | undefined;
  line.cells.forEach((cell, i) => {
    const rubric = rubricAt(line.cells, i);
    if (rubric) {
      seg = {
        ...emptySegment(page, rubric.code),
        ...(rubric.suffix ? { suffix: rubric.suffix } : {}),
      };
      out.push(seg);
    } else if (seg) {
      addCell(seg, cell, line.cells[i - 1]?.text);
    }
  });
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const spread = (values: number[]) => {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
};

/** The two amount columns of a set of lines, from lines that fill both. */
function columnsOf(segments: readonly Segment[], swapped: boolean): Columns | undefined {
  const pairs: [Cell, Cell][] = [];
  for (const s of segments) {
    const a = amountCandidates(s);
    if (a.length < 2) continue;
    const [p, q] = a.slice(-2) as [Amount, Amount];
    if (p.cell.right === undefined || q.cell.right === undefined || p.cell === q.cell) continue;
    pairs.push([p.cell, q.cell]);
  }
  if (!pairs.length) return undefined;
  const r1 = pairs.map((p) => p[0].right!);
  const r2 = pairs.map((p) => p[1].right!);
  const x1 = pairs.map((p) => p[0].x!);
  const x2 = pairs.map((p) => p[1].x!);
  const edge = spread(r1) + spread(r2) <= spread(x1) + spread(x2) ? 'right' : 'x';
  const left = median(edge === 'right' ? r1 : x1);
  const right = median(edge === 'right' ? r2 : x2);
  if (right - left < 10) return undefined;
  return { left, right, edge, swapped };
}

/** The amounts of a line, without a trailing salary certificate box ("8", "9", "11"). */
function amountCandidates(s: Segment): Amount[] {
  const a = s.amounts;
  const last = a.at(-1);
  if (a.length >= 3 && last && !last.shaped && Math.abs(last.value) <= 99_00) return a.slice(0, -1);
  return a;
}

function formOf(scan: { lines: Line[] }): { form?: string; year?: number } {
  for (const line of scan.lines) {
    const text = lineText(line);
    const main = GAPP_MAIN.exec(text);
    if (main) return { form: `PG${main[2]}`, year: 2000 + Number(main[1]) };
    const annex = GAPP_ANNEX.exec(text);
    if (annex) return { form: annex[2]!, year: 2000 + Number(annex[1]) };
  }
  for (const line of scan.lines) {
    const text = lineText(line);
    const pg = PG.exec(text);
    if (pg) {
      const year = /\b(20\d{2})\b/.exec(text.replace(DATE, ''));
      return { form: `PG${pg[1]}`, ...(year ? { year: Number(year[1]) } : {}) };
    }
  }
  return {};
}

/** A page's form from the codes on it, for programs that print no page code. */
function formFromCodes(codes: Set<string>, firstPage: boolean, text: string): string | undefined {
  const has = (...c: string[]) => c.some((x) => codes.has(x));
  if (has('99.00', '95.00')) return 'PG4';
  if (has('92.20', '92.40', '71.00', '73.10', '73.20')) return 'PG3';
  if (has('91.00') && has('11.00', '21.00', '13.00', '14.00')) return 'PG2';
  if ([...codes].some((c) => /^(11|31)\.\d[1-9]|^(11|31)\.[1-9]0/.test(c))) return 'A1';
  if ([...codes].some((c) => /^(21|41)\.\d[1-9]|^(21|41)\.[1-9]0/.test(c))) return 'A2';
  if (firstPage && /contribuable a/.test(fold(text)) && /etat civil/.test(fold(text))) return 'PG1';
  return undefined;
}

const CIVIL: [RegExp, CivilStatus][] = [
  [/^celibataire/, 'single'],
  // A dissolved partnership counts like a divorce (partenariat dissous).
  [/dissou/, 'divorced'],
  [/partenari|partenaire/, 'registered_partnership'],
  [/^marie/, 'married'],
  [/^separe/, 'separated'],
  [/^divorce/, 'divorced'],
  [/^veu[fv]/, 'widowed'],
];

const civilOf = (text: string): CivilStatus | undefined =>
  CIVIL.find(([re]) => re.test(fold(text).trim()))?.[1];

/** Taxpayers on the identity page: civil status of A and B, and whether B exists. */
function taxpayersOf(lines: Line[]): {
  a: CivilStatus | undefined;
  b: CivilStatus | undefined;
  hasB: boolean;
} {
  let a: CivilStatus | undefined;
  let b: CivilStatus | undefined;
  let hasB = false;
  for (const line of lines) {
    const cells = line.cells.map((c) => c.text);
    const at = cells.findIndex((c) =>
      /^etat civil/.test(fold(c).replace(/^etat-civil/, 'etat civil')),
    );
    if (at >= 0 && a === undefined) {
      const values = [cells[at]!.replace(/^\S+\s+civil\s*:?\s*/i, ''), ...cells.slice(at + 1)]
        .map(civilOf)
        .filter((v): v is CivilStatus => v !== undefined);
      a = values[0];
      b = values[1];
      if (values.length > 1) hasB = true;
    }
    // Birth dates: only counted, to tell whether there is a second taxpayer. Never kept.
    if (/naissance/.test(fold(lineText(line)))) {
      const dates = lineText(line).match(DATE) ?? [];
      if (dates.length > 1) hasB = true;
    }
  }
  return { a, b, hasB };
}

/** The commune of residence, from the identity page: its code, or the address's locality. */
function residenceOf(
  lines: Line[],
  page: number,
  lookup: CommuneLookup | undefined,
  warnings: PriorWarning[],
): PriorDeclaration['residence'] {
  if (!lookup) return undefined;
  const byCode = new Set<string>();
  const byName = new Set<string>();
  for (const line of lines) {
    const text = lineText(line);
    const folded = fold(text);
    if (/commune/.test(folded)) {
      for (const c of line.cells) {
        if (/^66[0-4]\d$/.test(c.text.trim())) {
          const slug = lookup.byCode(Number(c.text.trim()));
          if (slug) byCode.add(slug);
        }
      }
    }
    // The tax office's own address or a post box is not where the taxpayer lives.
    if (/case postale|administration fiscale|\bcp\b/.test(folded)) continue;
    const cells = line.cells.map((c) => c.text.trim());
    cells.forEach((cell, i) => {
      const inCell = /(?:^|[\s-])(12\d{2})\s+(\p{L}[\p{L}' .-]*\p{L}(?:\s\d{1,2})?)$/u.exec(cell);
      const split =
        /^12\d{2}$/.test(cell) && /^\p{L}/u.test(cells[i + 1] ?? '') ? cells[i + 1] : undefined;
      const place = inCell?.[2] ?? split;
      if (!place) return;
      const slug = lookup.byName(place);
      if (slug) byName.add(slug);
    });
  }
  const pick = byCode.size ? byCode : byName;
  if (pick.size === 1) {
    return { commune: [...pick][0]!, page, from: byCode.size ? 'code' : 'address' };
  }
  if (pick.size > 1) warnings.push(priorWarning('commune_unclear', {}, page));
  return undefined;
}

const toLines = (p: PageInput): Line[] => (typeof p === 'string' ? linesFromText(p) : p.lines);

export interface ParseOptions {
  /** Turns the residence (a code or the address's locality) into a commune id. */
  communes?: CommuneLookup;
}

/** Whether these pages are a Geneva declaration: its page codes, or enough of its rubric lines. */
export function detectPriorDeclaration(pages: readonly PageInput[]): boolean {
  let pageCodes = 0;
  const codes = new Set<string>();
  let lines = 0;
  let text = '';
  pages.forEach((p, i) => {
    for (const line of toLines(p)) {
      const t = lineText(line);
      if (GAPP_MAIN.test(t) || GAPP_ANNEX.test(t)) pageCodes++;
      for (const s of segmentsOf(line, i + 1)) {
        codes.add(s.code);
        lines++;
      }
      if (text.length < 20_000) text += `${fold(t)}\n`;
    }
  });
  if (pageCodes > 0) return lines >= 3;
  // Not the tax office's assessment, which prints the same codes.
  if (/avis de taxation|bordereau|decision de taxation/.test(text)) return false;
  const pg = pages.some((p) => toLines(p).some((l) => PG.test(lineText(l))));
  const recap = ['91.00', '99.00', '92.40', '31.00', '11.00'].filter((c) => codes.has(c)).length;
  return (pg && lines >= 5 && recap >= 1) || (lines >= 8 && codes.has('91.00') && recap >= 2);
}

/** Reads the declaration's pages (text with cells, or plain text). Never throws on odd input. */
export function parsePriorDeclaration(
  pages: readonly PageInput[],
  opts: ParseOptions = {},
): PriorDeclaration {
  const warnings: PriorWarning[] = [];
  const scans: PageScan[] = [];
  let previous: string | undefined;
  pages.forEach((p, i) => {
    const page = i + 1;
    const lines = toLines(p);
    const found = formOf({ lines });
    const segments: Segment[] = [];
    let last: Segment | undefined;
    let swapped = false;
    let icc: Cell | undefined;
    let ifd: Cell | undefined;
    let total: number | undefined;
    for (const line of lines) {
      const text = lineText(line);
      const of = PAGE_OF.exec(text);
      if (of) total = Number(of[2]);
      for (const c of line.cells) {
        const f = fold(c.text).trim();
        if (f === 'icc' || /^impot cantonal/.test(f)) icc ??= c;
        if (f === 'ifd' || /^impot federal/.test(f)) ifd ??= c;
      }
      const segs = segmentsOf(line, page);
      if (segs.length) {
        segments.push(...segs);
        last = segs.at(-1);
        continue;
      }
      // A line without a code: the rest of a label, or the rows of a small table under a code.
      if (!last) continue;
      const rest = emptySegment(page);
      line.cells.forEach((c, i) => addCell(rest, c, line.cells[i - 1]?.text));
      const amounts = rest.amounts.filter((a) => {
        const t = a.cell.text.trim();
        return !QUOTED_CODE.test(t) && (a.shaped || /^-?\d{1,3}$/.test(t));
      });
      if (!amounts.length) {
        // Text only: the label goes on, unless the line above already had its amounts.
        if (last.amounts.length) last = undefined;
        continue;
      }
      const heading = fold(line.cells[0]?.text ?? '').trim();
      const row = TABLE_ROW.test(heading);
      if (!row && !last.amounts.length && amountCandidates({ ...rest, amounts }).length <= 2) {
        last.amounts.push(...amounts);
        last.places.push(...rest.places);
        if (rest.annex) last.annex ??= rest.annex;
        if (rest.box) last.box ??= rest.box;
      } else {
        last.tail.push(...amounts);
        // "Contribuable A  1'200": what was typed for one person under a household rubric.
        const part = PART_ROW.find(([re]) => re.test(heading))?.[1];
        if (part && last.parts[part] === undefined) last.parts[part] = amounts[0]!.value;
      }
    }
    if (icc?.x !== undefined && ifd?.x !== undefined && ifd.x < icc.x) swapped = true;
    let form = found.form;
    if (!form) {
      const codes = new Set(segments.map((s) => s.code));
      form = formFromCodes(codes, page === 1, lines.map(lineText).join('\n'));
      // A page with rubric lines but no page code continues the annex before it.
      if (!form && segments.length && previous && /^[A-F]/.test(previous)) form = previous;
    }
    form ??= page === 1 ? 'PG1' : 'other';
    previous = form;
    scans.push({
      page,
      lines,
      form,
      ...(found.year ? { year: found.year } : {}),
      ...(total ? { total } : {}),
      segments,
      swapped,
    });
  });

  // Tax year: from the page codes, or a year printed on a main page.
  const years = scans.flatMap((s) => (s.year ? [s.year] : []));
  let taxYear: number | undefined;
  if (years.length) {
    const counts = new Map<number, number>();
    for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
    taxYear = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
    if (counts.size > 1) {
      warnings.push(priorWarning('years_differ', { years: [...counts.keys()].sort().join(', ') }));
    }
  } else {
    for (const s of scans) {
      if (taxYear) break;
      for (const line of s.lines) {
        const t = fold(lineText(line)).replace(DATE, '');
        const m =
          /(?:recapitulation|declaration|periode fiscale|annee fiscale|impots?)\D{0,40}?\b(20\d{2})\b/.exec(
            t,
          );
        if (m) {
          taxYear = Number(m[1]);
          break;
        }
      }
    }
  }
  if (!taxYear) warnings.push(priorWarning('no_year'));
  const total = scans.find((s) => s.total)?.total;
  if (total && total > pages.length) {
    warnings.push(priorWarning('pages_missing', { total, pages: pages.length }));
  }

  // Amount columns: each page's own, else those of pages of the same kind, else any page's.
  const icIfdForm = (f: string) => /^PG[23]$|^A\d*$/.test(f);
  const all = scans.filter((s) => icIfdForm(s.form));
  const kind = (f: string) => (f.startsWith('PG') ? 'main' : 'annex');
  const colsOf = (s: PageScan) =>
    columnsOf(s.segments, s.swapped) ??
    columnsOf(
      all.filter((o) => kind(o.form) === kind(s.form)).flatMap((o) => o.segments),
      s.swapped,
    ) ??
    columnsOf(
      all.flatMap((o) => o.segments),
      s.swapped,
    );

  const items: PriorItem[] = [];
  const seen = new Map<string, number>();
  for (const s of scans) {
    const columns = icIfdForm(s.form) ? colsOf(s) : undefined;
    for (const seg of s.segments) {
      const byCode = codePerson(seg.code);
      const person: PriorPerson =
        byCode ?? (s.form === 'A1' ? 'A' : s.form === 'A2' ? 'B' : 'household');
      // Annex A of each taxpayer, whatever the program calls the page.
      const form = /^A\d*$/.test(s.form) && byCode ? (byCode === 'A' ? 'A1' : 'A2') : s.form;
      const item: PriorItem = {
        code: seg.code,
        ...(seg.suffix ? { suffix: seg.suffix } : {}),
        form,
        person,
        ...(seg.annex ? { annex: seg.annex } : {}),
        page: s.page,
        occurrence: 1,
      };
      const amounts = amountCandidates(seg);
      const box =
        seg.box ??
        (seg.amounts.length > amounts.length ? seg.amounts.at(-1) : undefined)?.cell.text.trim();
      if (box) item.box = box;
      if (s.form === 'PG4') {
        if (amounts.length) item.icc = amounts[0]!.value;
        if (amounts.length > 1) item.amounts = amounts.map((a) => a.value);
      } else if (icIfdForm(s.form)) {
        assignColumns(item, amounts, columns, warnings, seg.tail);
      } else if (amounts.length) {
        item.amounts = amounts.map((a) => a.value);
      }
      if (seg.places.length) item.commune = seg.places[0]!.code;
      if (seg.tail.length) item.table = seg.tail.map((a) => a.value);
      if (Object.keys(seg.parts).length) item.parts = { ...seg.parts };
      const slot = `${item.form}|${item.code}|${item.suffix ?? ''}|${item.person}`;
      item.occurrence = (seen.get(slot) ?? 0) + 1;
      seen.set(slot, item.occurrence);
      items.push(item);
    }
  }

  // Identity page: civil status, whether there is a taxpayer B, the commune. Nothing else kept.
  const identity = scans.find((s) => s.form === 'PG1') ?? scans[0];
  const people = identity
    ? taxpayersOf(identity.lines)
    : { a: undefined, b: undefined, hasB: false };
  const residence = identity
    ? residenceOf(identity.lines, identity.page, opts.communes, warnings)
    : undefined;
  const bHasIncome = items.some(
    (i) => i.person === 'B' && ((i.icc ?? 0) !== 0 || (i.ifd ?? 0) !== 0),
  );
  const hasB = people.hasB || people.b !== undefined || bHasIncome;

  if (!scans.some((s) => /^PG[234]$/.test(s.form))) warnings.push(priorWarning('no_summary'));

  let software: string | undefined;
  for (const s of scans) {
    for (const line of s.lines) {
      const hit = SOFTWARE.find(([re]) => re.test(lineText(line)));
      if (hit) software ??= hit[1];
    }
  }

  return {
    ...(taxYear ? { taxYear } : {}),
    ...(software ? { software } : {}),
    pages: pages.length,
    forms: scans.map((s) => ({ page: s.page, form: s.form })),
    taxpayers: {
      a: people.a ? { civilStatus: people.a } : {},
      ...(hasB ? { b: people.b ? { civilStatus: people.b } : {} } : {}),
    },
    ...(residence ? { residence } : {}),
    items,
    warnings,
  };
}

/** Puts a line's amounts in the cantonal (ICC) and federal (IFD) columns. */
function assignColumns(
  item: PriorItem,
  amounts: Amount[],
  columns: Columns | undefined,
  warnings: PriorWarning[],
  tail: Amount[] = [],
): void {
  const set = (column: 'icc' | 'ifd', value: number) => {
    if (item[column] === undefined) item[column] = value;
  };
  const positioned =
    columns &&
    [...amounts, ...tail].every((a) => a.cell.right !== undefined && a.cell.x !== undefined);
  if (positioned) {
    const width = columns.right - columns.left;
    const tolerance = Math.max(15, width * 0.4);
    const columnOf = (a: Amount): 'icc' | 'ifd' | undefined => {
      const at = columns.edge === 'right' ? a.cell.right! : a.cell.x!;
      const dl = Math.abs(at - columns.left);
      const dr = Math.abs(at - columns.right);
      if (Math.min(dl, dr) > tolerance) {
        // Far from both columns: the salary certificate box at the end, or a number in the label.
        if (!a.shaped && at > columns.right && Math.abs(a.value) <= 99_00) {
          item.box ??= a.cell.text.trim();
        }
        return undefined;
      }
      return dl <= dr !== columns.swapped ? 'icc' : 'ifd';
    };
    for (const a of amounts) {
      const column = columnOf(a);
      if (column) set(column, a.value);
    }
    // A column the line left empty takes the last amount under it in that column: the total of
    // a small table ("total moins 0.5 % du code 92.20").
    const own = { icc: item.icc !== undefined, ifd: item.ifd !== undefined };
    for (const a of tail) {
      const column = columnOf(a);
      if (column && !own[column]) item[column] = a.value;
    }
    return;
  }
  if (amounts.length >= 2) {
    const [p, q] = amounts.slice(-2) as [Amount, Amount];
    set('icc', p.value);
    set('ifd', q.value);
    return;
  }
  if (amounts.length === 1) {
    const value = amounts[0]!.value;
    if (IFD_ONLY.has(item.code)) set('ifd', value);
    else {
      set('icc', value);
      if (!ICC_ONLY.has(item.code) && value !== 0) {
        warnings.push(priorWarning('column_guess', { code: item.code }, item.page));
      }
    }
  }
}
