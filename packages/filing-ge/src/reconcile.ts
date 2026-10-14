// The check before the user transmits (SPEC.md section 10.4): the PDF of this year's declaration,
// as printed by GeTax or the online declaration, against the copy panel (10.5), the values the user
// should have typed. Rubric by rubric and person by person, in whole francs (the form takes whole
// francs: ge-2025-declaration-specimen p. 21, ge-2025-guide-declaration-pp p. 9).
//
// Pure: printed lines and the copy panel in, a list per page of the form out. What the PDF says is
// data: only rubric codes and amounts come in (the reader in @taxpresso/intake keeps no name and no
// label text), and nothing from the PDF is ever written anywhere.
//
// Four outcomes for a value the user types: it matches, it differs, it is only in the PDF, or it
// is only in Taxpresso. Lines the form works out itself (totals, carried totals, flat deductions,
// limits) are listed apart: Taxpresso checks that totals add up and that carried totals are the
// same on both pages, and never counts them as differences.
import type { FactStatus } from '@taxpresso/ledger';
import { PART_LABELS, type CopyRow, type Lang } from './copy-panel.js';
import {
  roundToFranc,
  weakestStatus,
  type FormColumn,
  type FormMap,
  type FormPart,
  type FormPerson,
  type FormRubric,
  type Gloss,
} from './form.js';

const GUIDE = 'ge-2025-guide-declaration-pp';

/**
 * One line printed on the declaration: a rubric code with its amounts, as the reader of a Geneva
 * declaration gives it (@taxpresso/intake, PriorItem). Amounts in centimes.
 */
export interface PrintedLine {
  /** The form page it is on, from the page code: "PG2", "A1", "C4"; "other" when unknown. */
  form: string;
  code: string;
  /** A letter after the code ("31.10 r"): a line the form map doesn't have. */
  suffix?: string;
  person: FormPerson;
  /** Page of the PDF. */
  page: number;
  occurrence: number;
  /** The cantonal (ICC) and federal (IFD) columns of the main pages and annex A; on PG4, wealth. */
  icc?: number;
  ifd?: number;
  /** Annex pages with other columns: the amounts left to right. */
  amounts?: number[];
  /** What was typed per person under a household rubric ("Contribuable A", "Enfant(s)", "Total"). */
  parts?: Partial<Record<FormPart | 'total', number>>;
}

/** A column compared: cantonal, federal, wealth, or a plain amount (a part, a "Montant" box). */
export type CheckColumn = 'icc' | 'ifd' | 'wealth' | 'amount';
const COLUMN_ORDER: readonly CheckColumn[] = ['icc', 'ifd', 'wealth', 'amount'];

export type CheckOutcome = 'match' | 'differs' | 'pdf_only' | 'taxpresso_only';

/** One column of one line: whole francs on each side, absent when that side has none. */
export interface CheckCell {
  column: CheckColumn;
  taxpresso?: number;
  pdf?: number;
}

export interface CheckLine {
  id: string;
  /** "31.40", "11.10-2" (the second line of a rubric that repeats), "31.10 r". */
  ref: string;
  code: string;
  /** The official French label from the form map; empty for a code the form map doesn't have. */
  label: string;
  gloss: string;
  person: FormPerson;
  part?: { id: FormPart; label: string; gloss: string };
  outcome: CheckOutcome;
  cells: CheckCell[];
  /** Taxpresso's value: its status, and whether it is final (not "Needs your OK", not an estimate). */
  status?: FactStatus;
  final?: boolean;
  /** Page of the PDF it is printed on. */
  pdfPage?: number;
  /** false: a code Taxpresso's form map doesn't have. */
  known: boolean;
}

/**
 * A line the form works out. adds_up / off: a total checked against the lines above it, or a
 * carried total against the page it comes from (`from`). shown: worked out by a rule (a flat
 * deduction, a limit): nothing to check it against yet.
 */
export interface ComputedLine {
  id: string;
  ref: string;
  code: string;
  label: string;
  gloss: string;
  person: FormPerson;
  cells: { column: CheckColumn; pdf: number; expected?: number }[];
  check: 'adds_up' | 'off' | 'shown';
  /** For a carried total: the page it comes from. */
  from?: string;
  pdfPage: number;
  source?: string;
}

/** A value Taxpresso can't compare: a box to tick, text, or amounts it can't tell apart. */
export interface ByEyeLine {
  id: string;
  ref: string;
  label: string;
  gloss: string;
  person: FormPerson;
  part?: { id: FormPart; label: string; gloss: string };
  reason: 'tick' | 'text' | 'columns';
  /** The value as typed, when it is text. */
  value?: string;
}

export interface CheckSection {
  /** The form page ("PG2", "A1"), or "other" for pages the PDF doesn't name. */
  page: string;
  title: string;
  gloss: string;
  lines: CheckLine[];
  computed: ComputedLine[];
  byEye: ByEyeLine[];
}

export interface DeclarationCheck {
  taxYear: number;
  formYear: number;
  provisional: boolean;
  sections: CheckSection[];
  counts: {
    match: number;
    differs: number;
    pdfOnly: number;
    taxpressoOnly: number;
    /** Differences of any kind: what the user fixes before transmitting. */
    toFix: number;
    computed: number;
    /** Totals that don't add up: shown, never counted as differences. */
    computedOff: number;
    byEye: number;
    /** Compared values that are not final in Taxpresso yet. */
    notFinal: number;
  };
  /** Nothing to fix and nothing left unsettled in Taxpresso. */
  clear: boolean;
}

/** A row of the copy panel, as the reconciliation needs it (CopyRow, or the extension's view of it). */
export type CheckRow = Pick<
  CopyRow,
  | 'key'
  | 'ref'
  | 'code'
  | 'label'
  | 'gloss'
  | 'person'
  | 'part'
  | 'columns'
  | 'role'
  | 'format'
  | 'centimes'
  | 'text'
  | 'tick'
  | 'status'
  | 'final'
>;

export interface ReconcileInput {
  form: FormMap;
  /** The copy panel (buildCopyPanel), sections in the form's order. */
  panel: {
    sections: readonly { page: string; groups: readonly { rows: readonly CheckRow[] }[] }[];
  };
  printed: readonly PrintedLine[];
  lang: Lang;
}

/**
 * Codes the guide names for the cantonal and federal columns of a rubric the form prints without
 * them: donations (73.00) are deducted within a limit, printed as 73.10 and 73.20.
 */
const COLUMN_CODES: Record<
  string,
  { of: string; column: 'icc' | 'ifd'; label: string; gloss: Gloss; source: string }
> = {
  '73.10': {
    of: '73.00',
    column: 'icc',
    label: 'Dons ICC',
    gloss: { en: 'Donations you can deduct, Geneva tax', fr: 'Dons déductibles, impôt cantonal' },
    source: `${GUIDE} p. 15`,
  },
  '73.20': {
    of: '73.00',
    column: 'ifd',
    label: 'Dons IFD',
    gloss: { en: 'Donations you can deduct, federal tax', fr: 'Dons déductibles, impôt fédéral' },
    source: `${GUIDE} p. 15`,
  },
};

const UNKNOWN: Gloss = {
  en: 'A line Taxpresso doesn’t fill: check it against your documents',
  fr: 'Une ligne que Taxpresso ne remplit pas : vérifiez-la sur vos documents',
};
const OTHER_PAGES: Gloss = { en: 'Other pages', fr: 'Autres pages' };

/** The securities list (annexe F) has no rubric codes of its own on its lines: not compared yet. */
const isSecuritiesPage = (page: string) => /^F\d*$/.test(page);

type Values = {
  cols: Partial<Record<CheckColumn, number>>;
  parts?: Partial<Record<FormPart | 'total', number>>;
};

/** The check columns a rubric's columns stand for. ICC et IFD is one amount for both. */
function checkColumns(columns: readonly FormColumn[]): CheckColumn[] | undefined {
  const out: CheckColumn[] = [];
  for (const c of columns) {
    if (c === 'icc_ifd') out.push('icc', 'ifd');
    else if (c === 'icc' || c === 'ifd' || c === 'wealth' || c === 'amount') out.push(c);
    else return undefined; // the état des titres' own columns
  }
  return out;
}

const francs = (centimes: number | undefined) =>
  centimes === undefined ? undefined : roundToFranc(centimes);

function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * A printed line's amounts by column, in whole francs; undefined when the amounts can't be told
 * apart. Main pages and annex A come with their ICC and IFD columns, PG4 is wealth only; other
 * annexes print their own columns left to right, laid out here on the rubric's columns (with the
 * parts first, when the rubric has some).
 */
function printedValues(line: PrintedLine, rubric: FormRubric | undefined): Values | undefined {
  const parts = line.parts
    ? defined(Object.fromEntries(Object.entries(line.parts).map(([k, v]) => [k, francs(v)])))
    : undefined;
  const withParts = (cols: Values['cols']): Values => (parts ? { cols, parts } : { cols });
  if (line.form === 'PG4') return withParts(defined({ wealth: francs(line.icc) }));
  // A "Montant" box of the information the form asks on PG2 (98.12 and the other 98.xx): one
  // amount, printed under the ICC column (ge-2025-declaration-specimen p. 2).
  if (
    rubric?.columns.length === 1 &&
    rubric.columns[0] === 'amount' &&
    line.ifd === undefined &&
    line.icc !== undefined
  ) {
    return withParts({ amount: francs(line.icc)! });
  }
  if (line.icc !== undefined || line.ifd !== undefined) {
    return withParts(defined({ icc: francs(line.icc), ifd: francs(line.ifd) }));
  }
  const amounts = (line.amounts ?? []).map(roundToFranc);
  if (amounts.length === 0) return withParts({});
  if (!rubric) return undefined;
  const one = rubric.columns.map((c) => (c === 'icc_ifd' ? ['icc', 'ifd'] : [c]));
  const two = rubric.columns.flatMap((c) => (c === 'icc_ifd' ? [['icc'], ['ifd']] : [[c]]));
  for (const layout of [one, two]) {
    if (layout.some((cols) => cols.some((c) => !COLUMN_ORDER.includes(c as CheckColumn)))) {
      return undefined;
    }
    for (const partIds of rubric.parts ? [[], rubric.parts] : [[]]) {
      if (amounts.length !== partIds.length + layout.length) continue;
      const cols: Values['cols'] = {};
      layout.forEach((cs, i) => {
        for (const c of cs) cols[c as CheckColumn] = amounts[partIds.length + i];
      });
      const fromRow = Object.fromEntries(partIds.map((p, i) => [p, amounts[i]]));
      return partIds.length ? { cols, parts: { ...fromRow, ...parts } } : withParts(cols);
    }
  }
  return undefined;
}

/** The form map's rubric for a printed line: same page, code and person. */
function rubricFor(form: FormMap, line: PrintedLine): FormRubric | undefined {
  if (line.suffix) return undefined;
  const pick = (list: FormRubric[]) =>
    list.find((r) => r.person === line.person) ??
    list.find((r) => r.person === 'household') ??
    list[0];
  const onPage = form.rubrics.filter((r) => r.key === line.code && r.page === line.form);
  if (onPage.length) return pick(onPage);
  // A page the PDF doesn't name: the code alone, when only one page of the form has it.
  if (!form.pages.some((p) => p.id === line.form)) {
    const any = form.rubrics.filter((r) => r.key === line.code);
    if (new Set(any.map((r) => r.page)).size === 1) return pick(any);
  }
  return undefined;
}

/** Taxpresso's side of one printed line: a value to type, per column, in whole francs. */
interface Expected {
  page: string;
  rubric: FormRubric;
  ref: string;
  line?: number;
  part?: FormPart;
  cells: Map<CheckColumn, number>;
  rows: CheckRow[];
}

interface Printed {
  line: PrintedLine;
  page: string;
  rubric?: FormRubric;
  values?: Values;
}

const PART_ORDER: readonly (FormPart | undefined)[] = ['A', 'B', 'children', undefined];

function cellsEqual(e: Expected, values: Values | undefined): boolean {
  if (!values) return false;
  return [...e.cells].every(([c, v]) => values.cols[c] === v);
}

/** Annexe B's pages: the same codes for both taxpayers, one sheet each (specimen p. 7 to 10). */
const isAnnexB = (form: string) => /^B[1-4]$/.test(form);

/**
 * Whose each printed line of annexe B is. Its codes don't say (12.xx, 32.xx, 57.xx for A and B
 * alike), and the reader keeps no ticked box: with one self-employed taxpayer in the copy panel,
 * every sheet is theirs; with two, the first sheet of each code is A's and the second B's, unless
 * the amounts match the other way round better.
 */
function annexBPersons(
  printed: readonly PrintedLine[],
  panel: ReconcileInput['panel'],
  form: FormMap,
): PrintedLine[] {
  const rows = panel.sections
    .filter((s) => isAnnexB(s.page))
    .flatMap((s) => s.groups.flatMap((g) => g.rows.map((r) => ({ page: s.page, row: r }))));
  const people = [...new Set(rows.map((r) => r.row.person))].filter(
    (p): p is 'A' | 'B' => p === 'A' || p === 'B',
  );
  // A page the PDF doesn't name, with a code only annexe B has.
  const onlyB = (code: string) => {
    const pages = form.rubrics.filter((r) => r.key === code).map((r) => r.page);
    return pages.length > 0 && pages.every(isAnnexB);
  };
  const onB = (l: PrintedLine) =>
    l.person === 'household' &&
    (isAnnexB(l.form) || (!form.pages.some((p) => p.id === l.form) && onlyB(l.code)));
  if (!printed.some(onB) || people.length === 0) return [...printed];
  if (people.length === 1) {
    return printed.map((l) => (onB(l) ? { ...l, person: people[0]! } : l));
  }
  // Two sheets: score both orders by the amounts that match, A first when it's a tie.
  const expected = (person: 'A' | 'B', code: string) =>
    rows
      .filter((r) => r.row.person === person && r.row.code === code)
      .map((r) => roundToFranc(r.row.centimes ?? 0));
  const score = (first: 'A' | 'B') =>
    printed.filter(onB).filter((l) => {
      const who = l.occurrence === 1 ? first : first === 'A' ? 'B' : 'A';
      const amounts = [l.icc, l.ifd, ...(l.amounts ?? [])].filter((v) => v !== undefined);
      const want = expected(who, l.code);
      return amounts.some((v) => want.includes(roundToFranc(v)));
    }).length;
  const first = score('B') > score('A') ? 'B' : 'A';
  const second = first === 'A' ? 'B' : 'A';
  return printed.map((l) =>
    onB(l) ? { ...l, person: l.occurrence === 1 ? first : second, occurrence: 1 } : l,
  );
}

/** Checks the printed declaration against the copy panel. */
export function reconcileDeclaration({
  form,
  panel,
  printed: printedLines,
  lang,
}: ReconcileInput): DeclarationCheck {
  const printed = annexBPersons(printedLines, panel, form);
  const rubricIndex = new Map(form.rubrics.map((r, i) => [r, i]));
  const findRubric = (page: string, key: string, person: FormPerson) =>
    form.rubrics.find((r) => r.page === page && r.key === key && r.person === person) ??
    form.rubrics.find((r) => r.page === page && r.key === key);
  const partOf = (id: FormPart) => ({
    id,
    label: PART_LABELS[id].label,
    gloss: PART_LABELS[id].gloss[lang],
  });

  // --- Taxpresso's side: the copy panel's values to type, one entry per printed line and part.
  const expected = new Map<string, Expected>();
  const expectedComputed = new Map<string, Map<CheckColumn, number>>();
  const byEye: (ByEyeLine & { page: string; order: number })[] = [];
  for (const section of panel.sections) {
    for (const row of section.groups.flatMap((g) => g.rows)) {
      const rubric = findRubric(section.page, row.key, row.person);
      if (!rubric || isSecuritiesPage(section.page)) continue;
      const columns = checkColumns(row.columns.map((c) => c.id));
      const money =
        (row.format === 'money' || row.format === 'money_cents') && row.centimes !== undefined;
      if (row.role !== 'input') {
        if (!money || !columns) continue;
        const k = `${section.page}|${rubric.key}|${rubric.person}`;
        const cells = expectedComputed.get(k) ?? new Map<CheckColumn, number>();
        for (const c of columns) cells.set(c, (cells.get(c) ?? 0) + roundToFranc(row.centimes!));
        expectedComputed.set(k, cells);
        continue;
      }
      if (!money || !columns) {
        byEye.push({
          id: `${section.page}|${row.ref}|${row.part?.id ?? '-'}`,
          page: section.page,
          order: rubricIndex.get(rubric) ?? 0,
          ref: row.ref,
          label: row.label,
          gloss: row.gloss,
          person: row.person,
          ...(row.part ? { part: row.part } : {}),
          reason: row.format === 'tick' ? 'tick' : 'text',
          ...(row.format !== 'tick' && row.text !== undefined ? { value: row.text } : {}),
        });
        continue;
      }
      const lineNo = rubric.repeats ? Number(/-(\d+)$/.exec(row.ref)?.[1] ?? 1) : undefined;
      // A part is typed as one amount; a household amount on a rubric with parts is their total.
      const cellColumns: CheckColumn[] = row.part || rubric.parts ? ['amount'] : columns;
      const k = [section.page, rubric.key, rubric.person, row.part?.id ?? '-', row.ref].join('|');
      const entry = expected.get(k) ?? {
        page: section.page,
        rubric,
        ref: row.ref,
        ...(lineNo !== undefined ? { line: lineNo } : {}),
        ...(row.part ? { part: row.part.id } : {}),
        cells: new Map<CheckColumn, number>(),
        rows: [],
      };
      for (const c of cellColumns)
        entry.cells.set(c, (entry.cells.get(c) ?? 0) + roundToFranc(row.centimes!));
      entry.rows.push(row);
      expected.set(k, entry);
    }
  }

  // --- The PDF's side: each printed line with its rubric, outside the identity page.
  const lines: Printed[] = printed
    .filter((l) => l.form !== 'PG1')
    .map((line) => {
      const rubric = rubricFor(form, line);
      const page = rubric?.page ?? line.form;
      const values = printedValues(line, rubric);
      return { line, page, ...(rubric ? { rubric } : {}), ...(values ? { values } : {}) };
    })
    .filter((p) => !isSecuritiesPage(p.page));

  const out = new Map<string, CheckSection>();
  const sectionOf = (page: string) => {
    const formPage = form.pages.find((p) => p.id === page);
    const key = formPage ? page : 'other';
    let s = out.get(key);
    if (!s) {
      s = {
        page: key,
        title: formPage?.title ?? '',
        gloss: formPage?.gloss[lang] ?? OTHER_PAGES[lang],
        lines: [],
        computed: [],
        byEye: [],
      };
      out.set(key, s);
    }
    return s;
  };
  const sortKey = new Map<string, string>();
  const keyOf = (rubric: FormRubric | undefined, code: string, part?: FormPart, line = 0) =>
    [
      String(rubric ? rubricIndex.get(rubric)! : 99_999).padStart(5, '0'),
      code,
      String(PART_ORDER.indexOf(part)),
      String(line).padStart(3, '0'),
    ].join('|');

  const addLine = (page: string, l: CheckLine, sort: string) => {
    sectionOf(page).lines.push(l);
    sortKey.set(l.id, sort);
  };
  const isZero = (cells: CheckCell[]) => cells.every((c) => !c.taxpresso && !c.pdf);
  const taxpressoSide = (e: Expected) => {
    const status = weakestStatus(e.rows.map((r) => r.status));
    return { status, final: e.rows.every((r) => r.final) };
  };
  const common = (e: Expected) => ({
    ref: e.ref,
    code: e.rubric.code ?? e.rubric.key,
    label: e.rubric.label,
    gloss: e.rubric.gloss[lang],
    person: e.rubric.person,
    ...(e.part ? { part: partOf(e.part) } : {}),
    known: true,
  });
  const cellsOf = (
    e: Expected | undefined,
    values: Partial<Record<CheckColumn, number>> | undefined,
  ) => {
    const columns = new Set<CheckColumn>([
      ...(e ? [...e.cells.keys()] : []),
      ...(Object.keys(values ?? {}) as CheckColumn[]),
    ]);
    return COLUMN_ORDER.filter((c) => columns.has(c)).map((column) =>
      defined({ column, taxpresso: e?.cells.get(column), pdf: values?.[column] }),
    ) as CheckCell[];
  };
  const outcomeOf = (cells: CheckCell[]): CheckOutcome =>
    cells.every((c) => (c.taxpresso ?? 0) === (c.pdf ?? 0) && (c.pdf !== undefined || !c.taxpresso))
      ? 'match'
      : 'differs';

  const used = new Set<Printed>();
  const groups = new Map<
    string,
    { rubric: FormRubric; page: string; expected: Expected[]; printed: Printed[] }
  >();
  const groupOf = (page: string, rubric: FormRubric) => {
    const k = `${page}|${rubric.key}|${rubric.person}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { rubric, page, expected: [], printed: [] }));
    return g;
  };
  for (const e of expected.values()) groupOf(e.page, e.rubric).expected.push(e);
  for (const p of lines) {
    if (p.rubric && p.rubric.role === 'input' && !COLUMN_CODES[p.line.code]) {
      groupOf(p.page, p.rubric).printed.push(p);
    }
  }

  const byEyeAdd = (e: Expected, reason: ByEyeLine['reason']) =>
    byEye.push({
      id: `${e.page}|${e.ref}|${e.part ?? '-'}`,
      page: e.page,
      order: rubricIndex.get(e.rubric) ?? 0,
      ref: e.ref,
      label: e.rubric.label,
      gloss: e.rubric.gloss[lang],
      person: e.rubric.person,
      ...(e.part ? { part: partOf(e.part) } : {}),
      reason,
    });

  for (const g of groups.values()) {
    const printedLines = [...g.printed].sort(
      (a, b) => a.line.page - b.line.page || a.line.occurrence - b.line.occurrence,
    );
    printedLines.forEach((p) => used.add(p));
    const withParts = g.rubric.parts ? g.expected : [];
    const plain = g.rubric.parts ? [] : g.expected;

    // Rubrics typed per person (Contr. A, Contr. B, Enfant(s)): each part against the PDF's row.
    if (g.rubric.parts) {
      const p = printedLines[0];
      const shown = new Set<FormPart | 'total'>();
      for (const e of withParts) {
        const id = `${g.page}|${e.ref}|${e.part ?? 'total'}`;
        const sort = keyOf(g.rubric, g.rubric.key, e.part);
        const amount = e.cells.get('amount') ?? 0;
        if (!p) {
          if (amount === 0) continue;
          addLine(
            g.page,
            {
              id,
              ...common(e),
              outcome: 'taxpresso_only',
              cells: [{ column: 'amount', taxpresso: amount }],
              ...taxpressoSide(e),
            },
            sort,
          );
          continue;
        }
        const parts = p.values?.parts;
        const pdf = e.part
          ? parts?.[e.part]
          : (parts?.total ??
            (parts && Object.keys(parts).length
              ? Object.values(parts).reduce((a, b) => a + b, 0)
              : undefined));
        if (pdf === undefined) {
          // Printed, but without amounts per person Taxpresso can tell apart.
          if (amount !== 0) byEyeAdd(e, 'columns');
          continue;
        }
        shown.add(e.part ?? 'total');
        const cells: CheckCell[] = [defined({ column: 'amount' as const, taxpresso: amount, pdf })];
        addLine(
          g.page,
          {
            id,
            ...common(e),
            outcome: outcomeOf(cells),
            cells,
            pdfPage: p.line.page,
            ...taxpressoSide(e),
          },
          sort,
        );
      }
      // Parts the PDF has and Taxpresso doesn't.
      const typedParts = Object.entries(p?.values?.parts ?? {}).filter(([k]) => k !== 'total') as [
        FormPart,
        number,
      ][];
      if (p && !withParts.some((e) => !e.part)) {
        for (const [part, value] of typedParts) {
          if (shown.has(part) || value === 0) continue;
          addLine(
            g.page,
            {
              id: `${g.page}|${g.rubric.key}|${part}`,
              ref: g.rubric.code ?? g.rubric.key,
              code: g.rubric.code ?? g.rubric.key,
              label: g.rubric.label,
              gloss: g.rubric.gloss[lang],
              person: g.rubric.person,
              part: partOf(part),
              outcome: 'pdf_only',
              cells: [{ column: 'amount', pdf: value }],
              pdfPage: p.line.page,
              known: true,
            },
            keyOf(g.rubric, g.rubric.key, part),
          );
        }
      }
      // The rubric's own columns (the limited or summed amount) are the form's work.
      if (p) computedFrom(p);
      continue;
    }

    // Other rubrics: pair Taxpresso's lines with the PDF's, same amounts first, then in order.
    const sortedExpected = [...plain].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    const pairs = new Map<Expected, Printed>();
    const free = new Set(printedLines);
    for (const e of sortedExpected) {
      const same = [...free].find((p) => cellsEqual(e, p.values));
      if (same) {
        pairs.set(e, same);
        free.delete(same);
      }
    }
    for (const e of sortedExpected) {
      if (pairs.has(e)) continue;
      const next = [...free][0];
      if (next) {
        pairs.set(e, next);
        free.delete(next);
      }
    }
    for (const e of sortedExpected) {
      const p = pairs.get(e);
      const id = `${g.page}|${e.ref}`;
      const sort = keyOf(g.rubric, g.rubric.key, undefined, e.line ?? 0);
      if (!p) {
        const cells = cellsOf(e, undefined);
        if (isZero(cells)) continue;
        addLine(
          g.page,
          { id, ...common(e), outcome: 'taxpresso_only', cells, ...taxpressoSide(e) },
          sort,
        );
        continue;
      }
      if (!p.values) {
        byEyeAdd(e, 'columns');
        continue;
      }
      const cells = cellsOf(e, p.values.cols);
      addLine(
        g.page,
        {
          id,
          ...common(e),
          outcome: outcomeOf(cells),
          cells,
          pdfPage: p.line.page,
          ...taxpressoSide(e),
        },
        sort,
      );
    }
    let extra = 0;
    for (const p of free) {
      const cells = cellsOf(undefined, p.values?.cols);
      if (isZero(cells)) continue;
      extra++;
      const n = sortedExpected.length + extra;
      const ref = g.rubric.repeats
        ? `${g.rubric.code ?? g.rubric.key}-${n}`
        : (g.rubric.code ?? g.rubric.key);
      addLine(
        g.page,
        {
          id: `${g.page}|${g.rubric.key}|pdf${p.line.page}-${p.line.occurrence}`,
          ref,
          code: g.rubric.code ?? g.rubric.key,
          label: g.rubric.label,
          gloss: g.rubric.gloss[lang],
          person: g.rubric.person,
          outcome: 'pdf_only',
          cells,
          pdfPage: p.line.page,
          known: true,
        },
        keyOf(g.rubric, g.rubric.key, undefined, n),
      );
    }
  }

  // Printed lines with no input rubric: lines the form works out, or codes Taxpresso doesn't know.
  function computedFrom(p: Printed) {
    const alias = COLUMN_CODES[p.line.code];
    const rubric = p.rubric ?? (alias ? form.rubrics.find((r) => r.key === alias.of) : undefined);
    if (!rubric || !p.values) return;
    const cols = (Object.keys(p.values.cols) as CheckColumn[]).filter(
      (c) => p.values!.cols[c] !== undefined,
    );
    if (!cols.length) return;
    const page = rubric.page === p.page || !alias ? p.page : rubric.page;
    const code = alias ? p.line.code : (rubric.code ?? rubric.key);
    let check: ComputedLine['check'] = 'shown';
    let expectedCols: Partial<Record<CheckColumn, number>> = {};
    let from: string | undefined;
    if (!alias && rubric.role === 'total') {
      expectedCols = totalOf(p, rubric);
    } else if (!alias && rubric.role === 'report') {
      const source = carriedFrom(p);
      if (source) {
        expectedCols = source.values!.cols;
        from = source.page;
      }
    }
    const fromTaxpresso = expectedComputed.get(`${page}|${rubric.key}|${rubric.person}`);
    if (fromTaxpresso) expectedCols = Object.fromEntries(fromTaxpresso);
    const cells = COLUMN_ORDER.filter((c) => cols.includes(c)).map((column) =>
      defined({ column, pdf: p.values!.cols[column]!, expected: expectedCols[column] }),
    );
    if (cells.some((c) => c.expected !== undefined)) {
      check = cells.every((c) => c.expected === undefined || c.expected === c.pdf)
        ? 'adds_up'
        : 'off';
    }
    const id = `${page}|${code}|${p.line.person}|computed${p.line.page}-${p.line.occurrence}`;
    sectionOf(page).computed.push({
      id,
      ref: code,
      code,
      label: alias?.label ?? rubric.label,
      gloss: alias?.gloss[lang] ?? rubric.gloss[lang],
      person: p.line.person,
      cells,
      check,
      ...(from ? { from } : {}),
      pdfPage: p.line.page,
      ...(alias ? { source: alias.source } : {}),
    });
    sortKey.set(id, keyOf(rubric, code));
  }

  /** What a total should be from the PDF's own lines above it in its section; {} when unknowable. */
  function totalOf(p: Printed, total: FormRubric): Partial<Record<CheckColumn, number>> {
    const i = rubricIndex.get(total)!;
    const same = (r: FormRubric) => r.page === total.page && r.section === total.section;
    const before = form.rubrics.slice(0, i).filter(same);
    const lastTotal = before.map((r) => r.role).lastIndexOf('total');
    const start = lastTotal >= 0 ? before[lastTotal] : undefined;
    const components = before
      .slice(lastTotal + 1)
      .filter(
        (r) => r.role !== 'total' && (total.person === 'household' || r.person === total.person),
      );
    const linesOf = (r: FormRubric) =>
      lines.filter(
        (l) =>
          l.rubric === r &&
          l.page === p.page &&
          (total.person === 'household' || l.line.person === total.person),
      );
    const signed =
      components.some((r) => r.nature === 'deduction') &&
      (start !== undefined || components.some((r) => r.nature === 'income'));
    const result: Partial<Record<CheckColumn, number>> = {};
    for (const column of Object.keys(p.values!.cols) as CheckColumn[]) {
      let sum = 0;
      let seen = false;
      if (start) {
        const s = linesOf(start);
        if (s.length !== 1 || !s[0]!.values) return {};
        const v = s[0]!.values.cols[column];
        if (v === undefined) continue;
        sum = v;
        seen = true;
      }
      for (const r of components) {
        for (const l of linesOf(r)) {
          if (!l.values) return {};
          const v = l.values.cols[column];
          if (v === undefined) continue;
          sum += signed && r.nature === 'deduction' ? -v : v;
          seen = true;
        }
      }
      if (seen) result[column] = sum;
    }
    return result;
  }

  /** The annex total a summary page carries: the same code, for the same person, on another page. */
  function carriedFrom(p: Printed): Printed | undefined {
    const columns = Object.keys(p.values?.cols ?? {});
    const candidates = lines.filter(
      (o) =>
        o !== p &&
        o.line.code === p.line.code &&
        !o.line.suffix &&
        o.line.person === p.line.person &&
        o.page !== p.page &&
        o.rubric?.role !== 'report' &&
        o.values !== undefined &&
        columns.some((c) => o.values!.cols[c as CheckColumn] !== undefined),
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  for (const p of lines) {
    if (used.has(p)) continue;
    const alias = COLUMN_CODES[p.line.code];
    if (alias || (p.rubric && p.rubric.role !== 'input')) {
      computedFrom(p);
      continue;
    }
    // A code Taxpresso's form map doesn't have (or a lettered line): only in the PDF.
    const cells = cellsOf(
      undefined,
      p.values?.cols ??
        (p.line.amounts?.length ? { amount: roundToFranc(p.line.amounts.at(-1)!) } : undefined),
    );
    if (isZero(cells)) continue;
    const ref = `${p.line.code}${p.line.suffix ? ` ${p.line.suffix}` : ''}`;
    addLine(
      p.page,
      {
        id: `${p.page}|${ref}|${p.line.person}|pdf${p.line.page}-${p.line.occurrence}`,
        ref,
        code: p.line.code,
        label: p.rubric?.label ?? '',
        gloss: p.rubric?.gloss[lang] ?? UNKNOWN[lang],
        person: p.line.person,
        outcome: 'pdf_only',
        cells,
        pdfPage: p.line.page,
        known: p.rubric !== undefined,
      },
      keyOf(p.rubric, p.line.code + (p.line.suffix ?? ''), undefined, p.line.occurrence),
    );
  }

  for (const b of byEye) {
    const { page, order, ...line } = b;
    sectionOf(page).byEye.push(line);
    sortKey.set(line.id, keyOf(form.rubrics[order], line.ref, line.part?.id));
  }

  const pageOrder = (page: string) => {
    const i = form.pages.findIndex((p) => p.id === page);
    return i < 0 ? form.pages.length : i;
  };
  const by = (a: { id: string }, b: { id: string }) =>
    (sortKey.get(a.id) ?? '').localeCompare(sortKey.get(b.id) ?? '');
  const sections = [...out.values()]
    .sort((a, b) => pageOrder(a.page) - pageOrder(b.page))
    .map((s) => ({
      ...s,
      lines: s.lines.sort(by),
      computed: s.computed.sort(by),
      byEye: s.byEye.sort(by),
    }));

  const all = sections.flatMap((s) => s.lines);
  const count = (o: CheckOutcome) => all.filter((l) => l.outcome === o).length;
  const computed = sections.flatMap((s) => s.computed);
  const counts = {
    match: count('match'),
    differs: count('differs'),
    pdfOnly: count('pdf_only'),
    taxpressoOnly: count('taxpresso_only'),
    toFix: count('differs') + count('pdf_only') + count('taxpresso_only'),
    computed: computed.length,
    computedOff: computed.filter((c) => c.check === 'off').length,
    byEye: sections.reduce((n, s) => n + s.byEye.length, 0),
    notFinal: all.filter((l) => l.final === false).length,
  };
  return {
    taxYear: form.taxYear,
    formYear: form.formYear,
    provisional: form.provisional,
    sections,
    counts,
    clear: counts.toFix === 0 && counts.notFinal === 0,
  };
}
