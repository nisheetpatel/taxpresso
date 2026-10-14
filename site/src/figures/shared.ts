// What the canton reference pages (/<lang>/<canton>/) show, in one shape for every canton: the
// communes with their multipliers, the canton's own multiplier and the main deductions, each figure
// from a cited constant of the canton's rules package (packages/rules-<canton>) or of the federal
// one (packages/rules-ch), with its citation looked up in docs/sources/manifest.json by cite(). One
// module per canton (./<canton>.ts) reads its package into this shape; ../canton-data.ts loads the
// ones whose canton is in cantons.ts. No figure is typed here or there: what a package doesn't hold
// is left out, never guessed (CLAUDE.md, SPEC.md section 7b). The words are in ../canton-pages.ts.

import type { Cited } from '../../../packages/rules-ch/src/core/cited.ts';
import { IFD_2026 } from '../../../packages/rules-ch/src/ifd/2026-amounts.ts';
import { type Citation, cite, type Figure, TAX_YEAR } from '../geneva-data.ts';

export { TAX_YEAR };

/** The year before the page's: its communal multipliers are shown next to the year's. */
export const PREVIOUS_YEAR = TAX_YEAR - 1;

/** The deductions a canton page can show, in the order it shows them. */
export const DEDUCTION_IDS = [
  'professional',
  'commute',
  'meals',
  'pillar3a',
  'insurance',
  'debtInterest',
  'childcare',
  'training',
  'twoEarner',
  'party',
  'donations',
  'medical',
  'child',
  'childTaxReduction',
] as const;
export type DeductionId = (typeof DEDUCTION_IDS)[number];

/** The sentences a limit is written with; each language has them all (../canton-pages.ts). */
export const LIMIT_TEXTS = [
  'shareMinMax',
  'baseShareMax',
  'flat',
  'perYear',
  'meals',
  'mealsYear',
  'pillar3a',
  'family',
  'couple',
  'flatCouple',
  'noPension',
  'noPensionMore',
  'noPensionShare',
  'premiums',
  'savings',
  'savingsCouple',
  'life',
  'health',
  'atMost',
  'perPersonMax',
  'perChildMax',
  'debtInterest',
  'twoEarnerMax',
  'twoEarnerShare',
  'twoEarnerBoth',
  'twoEarnerFixed',
  'donations',
  'medical',
  'child',
  'childAge',
  'childAway',
  'childSchool',
  'childOlder',
  'childThird',
  'taxReduction',
] as const;
export type LimitText = (typeof LIMIT_TEXTS)[number];

/** One limit: its sentence, the figures that fill it, and where they are written. */
export interface Limit {
  text: LimitText;
  figures: Record<string, Figure>;
  sources: Citation[];
}

/** A deduction: the canton's limits next to the federal ones. */
export interface Deduction {
  id: DeductionId;
  /** The canton's own term, as its form or guide prints it; null when the package has none. */
  term: string | null;
  cantonal: Limit[];
  federal: Limit[];
}

/** How the communal tax is worked out, which decides the words around the table. */
export type How = 'percent' | 'multiple' | 'units' | 'shares';

/**
 * Church columns, named in each language: a rate on the same base as the commune's; a rate in
 * percent of the taxable income (Basel-Landschaft); a parish's coefficient on the income tax, which
 * has another on the wealth tax (Fribourg).
 */
export const CHURCHES = [
  'reformed',
  'catholic',
  'christCatholic',
  'reformedOfIncome',
  'christCatholicOfIncome',
  'catholicOnIncome',
  'reformedOnIncome',
] as const;
export type Church = (typeof CHURCHES)[number];

/** A column's heading: the canton's own term, as printed, or a church named in the page's language. */
export type ColumnLabel = { term: string } | { church: Church };

export interface Column {
  label: ColumnLabel;
  year: number;
}

export interface CommuneRow {
  name: string;
  /** One list per column: several values where the commune's parts differ, none where not given. */
  cells: readonly (readonly Figure[])[];
}

export interface CommuneTable {
  columns: readonly Column[];
  rows: readonly CommuneRow[];
  /** The table of each year shown. */
  sources: readonly { year: number; sources: Citation[] }[];
}

/** The canton's own multiplier in one year: one value, or one on income and one on wealth. */
export interface CantonRate {
  year: number;
  text: 'value' | 'incomeWealth';
  figures: Record<string, Figure>;
  sources: Citation[];
}

/** A church rate that is the same in every commune of the canton. */
export interface WideRate {
  church: Church;
  year: number;
  figure: Figure;
  sources: Citation[];
}

export interface CantonFigures {
  code: string;
  /** The canton's official language: its communes are sorted by its alphabet. */
  lang: 'de' | 'fr' | 'it';
  how: How;
  /** The communal multiplier, as the canton calls it: "Steuerfuss", "coefficient communal". */
  term: string;
  /** The tax the multiplier applies to: "einfache Staatssteuer", "impôt cantonal de base". */
  base: string;
  /** The cantonal and communal tax, as the canton calls it: "Staats- und Gemeindesteuern". */
  tax: string;
  /** The canton's own multiplier, by year; null where the canton has none (Basel-Stadt). */
  canton: { term: string; rates: CantonRate[] } | null;
  wide: WideRate[];
  communes: CommuneTable;
  deductions: Deduction[];
}

// ---------------------------------------------------------------------------------------------
// Helpers for the canton modules

export const chf = (centimes: number): Figure => ({ chf: centimes });
/** A share in basis points, or in hundredths of a percent, which is the same (7850 = 78.5 %). */
export const pct = (bp: number): Figure => ({ pct: bp });
/** A whole percent (95 = 95 %). */
export const percent = (whole: number): Figure => ({ pct: whole * 100 });
export const units = (tenThousandths: number): Figure => ({ units: tenThousandths });

/** A limit from a cited constant (or several): its sentence and figures. */
export const limit = (
  text: LimitText,
  figures: Record<string, Figure>,
  ...sources: string[]
): Limit => ({ text, figures, sources: cite(...sources) });

/** The distinct values of a list, in order, without the ones not given. */
export const distinct = (values: readonly (number | null)[], as: (n: number) => Figure) =>
  [...new Set(values.filter((v): v is number => v !== null))].map(as);

/** Lower case, accents and punctuation folded, to match a commune's name from one year to the next. */
export const fold = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A column of the communes table: its heading, its year, and what it shows for a commune. */
export interface ColumnSpec<T> {
  label: ColumnLabel;
  year: number;
  cell: (commune: T) => readonly Figure[];
}

/**
 * The communes table: every commune of any year shown (a commune merged away, or new, has no value
 * in the other year), sorted by the canton's alphabet; columns nobody has a value in are left out.
 */
export function communeTable<T>(spec: {
  lang: CantonFigures['lang'];
  years: readonly { year: number; table: Cited<readonly T[]> }[];
  key: (commune: T) => string;
  name: (commune: T) => string;
  columns: readonly ColumnSpec<T>[];
}): CommuneTable {
  const byYear = new Map(
    spec.years.map((y) => [y.year, new Map(y.table.value.map((c) => [spec.key(c), c]))]),
  );
  const names = new Map<string, string>();
  for (const y of [...spec.years].sort((a, b) => a.year - b.year))
    for (const c of y.table.value) names.set(spec.key(c), spec.name(c));
  const collator = new Intl.Collator(spec.lang, { sensitivity: 'base', numeric: true });
  const rows = [...names]
    .map(([key, name]) => ({
      name,
      cells: spec.columns.map((col) => {
        const c = byYear.get(col.year)?.get(key);
        return c ? col.cell(c) : [];
      }),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
  const keep = spec.columns.map((_, i) => rows.some((r) => r.cells[i]!.length > 0));
  const columns = spec.columns.filter((_, i) => keep[i]);
  const years = new Set(columns.map((c) => c.year));
  return {
    columns: columns.map(({ label, year }) => ({ label, year })),
    rows: rows.map((r) => ({ name: r.name, cells: r.cells.filter((_, i) => keep[i]) })),
    sources: spec.years
      .filter((y) => years.has(y.year))
      .sort((a, b) => b.year - a.year)
      .map((y) => ({ year: y.year, sources: cite(y.table.source) })),
  };
}

// The limits most cantons write the same way, from their cited constants.

type Shape<T> = Pick<Cited<T>, 'value' | 'source'>;

/** A share of the net salary, between a minimum and a maximum. */
export const shareMinMax = (c: Shape<{ rateBp: number; min: number; max: number }>) =>
  limit(
    'shareMinMax',
    { rate: pct(c.value.rateBp), min: chf(c.value.min), max: chf(c.value.max) },
    c.source,
  );

/** One amount in one sentence: "at most {max}", "{amount} per child". */
export const one = (text: LimitText, c: Shape<number>, key = 'max') =>
  limit(text, { [key]: chf(c.value) }, c.source);

export const meals = (c: Shape<{ perDay: number; perYear: number }>) =>
  limit('meals', { perDay: chf(c.value.perDay), perYear: chf(c.value.perYear) }, c.source);

export const pillar3a = (
  c: Shape<{ withFund: number; withoutFundMax: number; withoutFundShareBp: number }>,
) =>
  limit(
    'pillar3a',
    {
      withFund: chf(c.value.withFund),
      share: pct(c.value.withoutFundShareBp),
      withoutFund: chf(c.value.withoutFundMax),
    },
    c.source,
  );

/** Married couples and everyone else, in one sentence. */
export const couple = (text: LimitText, c: Shape<{ married: number; other: number }>) =>
  limit(text, { married: chf(c.value.married), other: chf(c.value.other) }, c.source);

export const family = (c: Shape<{ married: number; other: number; perChild: number }>) =>
  limit(
    'family',
    {
      married: chf(c.value.married),
      other: chf(c.value.other),
      perChild: chf(c.value.perChild),
    },
    c.source,
  );

export const debtInterest = (c: Shape<number>) => one('debtInterest', c, 'extra');

export const donations = (c: Shape<{ min: number; shareBp: number }>) =>
  limit('donations', { min: chf(c.value.min), share: pct(c.value.shareBp) }, c.source);

export const medical = (c: Shape<number>) => limit('medical', { share: pct(c.value) }, c.source);

/** The canton's multiplier of one year, from its cited constant. */
export const cantonRate = (year: number, rate: Cited<number>, as: (n: number) => Figure) => ({
  year,
  text: 'value' as const,
  figures: { rate: as(rate.value) },
  sources: cite(rate.source),
});

// ---------------------------------------------------------------------------------------------
// The federal direct tax (IFD) of the page's year, next to every canton's (packages/rules-ch)

const F = IFD_2026;

export const FEDERAL: Partial<Record<DeductionId, Limit[]>> = {
  professional: [shareMinMax(F.professionalFlat)],
  commute: [one('perYear', F.commuteMax)],
  meals: [meals(F.meals)],
  pillar3a: [pillar3a(F.pillar3a)],
  insurance: [
    family(F.insurance),
    limit(
      'noPension',
      { married: chf(F.insurance.value.marriedNone), other: chf(F.insurance.value.otherNone) },
      F.insurance.source,
    ),
  ],
  debtInterest: [debtInterest(F.debtInterestExtra)],
  childcare: [one('perChildMax', F.childcareMax)],
  training: [one('atMost', F.trainingMax)],
  twoEarner: [
    limit(
      'twoEarnerShare',
      {
        share: pct(F.twoEarner.value.shareBp),
        min: chf(F.twoEarner.value.min),
        max: chf(F.twoEarner.value.max),
      },
      F.twoEarner.source,
    ),
  ],
  party: [one('atMost', F.partyMax)],
  donations: [donations(F.donations)],
  medical: [medical(F.medicalThresholdBp)],
  child: [one('child', F.child, 'amount')],
  childTaxReduction: [one('taxReduction', F.childTaxReduction, 'amount')],
};

/** A canton's deduction, with the federal limits of the same deduction next to it. */
export const deduction = (id: DeductionId, term: string | null, cantonal: Limit[]): Deduction => ({
  id,
  term,
  cantonal,
  federal: FEDERAL[id] ?? [],
});

/** Same sentence, same figures: the canton takes the federal limit over (pillar 3a). */
const sameLimit = (a: Limit, b: Limit) =>
  a.text === b.text && JSON.stringify(a.figures) === JSON.stringify(b.figures);

/**
 * The lines of a deduction as the page shows them: the canton's, then the federal ones; one line
 * for both taxes where the canton's limits are the federal ones.
 */
export function deductionLines(
  d: Deduction,
): { tax: 'cantonal' | 'federal' | 'both'; limit: Limit }[] {
  const same =
    d.cantonal.length > 0 &&
    d.cantonal.length === d.federal.length &&
    d.cantonal.every((l, i) => sameLimit(l, d.federal[i]!));
  if (same)
    return d.cantonal.map((l, i) => ({
      tax: 'both',
      limit: { ...l, sources: [...l.sources, ...d.federal[i]!.sources] },
    }));
  return [
    ...d.cantonal.map((limit) => ({ tax: 'cantonal' as const, limit })),
    ...d.federal.map((limit) => ({ tax: 'federal' as const, limit })),
  ];
}
