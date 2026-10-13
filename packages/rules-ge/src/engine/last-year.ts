// This year against last year, rubric by rubric: the engine's figures next to the lines read from
// last year's declaration (../2026/keys-prior.ts). Comparison only: last year's figures never
// feed this year's calculation. Amounts in centimes, deductions as positive amounts the way the
// form prints them.
import type { Fact } from '@taxpresso/ledger';
import { PRIOR_MAIN_LINES_2026, priorLines, type PriorLine } from '../2026/keys-prior.js';
import type { Item, Line, TaxResult, Text } from './types.js';

export interface YearPair {
  icc?: number;
  ifd?: number;
}

export interface LastYearRow {
  form: string;
  code: string;
  person: 'A' | 'B' | 'household';
  label: Text;
  official: string;
  lastYear: YearPair;
  thisYear: YearPair;
  /** This year less last year, per column, when both are known. */
  change: YearPair;
  /** Last year's line still to be checked by the user ("extracted"). */
  lastYearNeedsOk: boolean;
  /** This year's figure is an estimate or rests on values that still need the user's OK. */
  thisYearProvisional: boolean;
}

const abs = (n: number) => Math.abs(n);
const total = (items: readonly Item[]) => items.reduce((s, i) => s + i.amount, 0);

/** This year's figure for a line of the form, from the engine's result, per column. */
function thisYear(r: TaxResult, form: string, code: string): { value: YearPair; lines: Line[] } {
  const icc = r.icc;
  const ifd = r.ifd;
  const pick = (items: readonly Item[] | undefined, test: (i: Item) => boolean) =>
    (items ?? []).filter(test);
  const sum = (test: (i: Item) => boolean, wealth = false) => {
    const a = wealth ? pick(icc?.wealth.items, test) : pick(icc?.items, test);
    const b = wealth ? [] : pick(ifd?.items, test);
    return {
      value: {
        ...(icc ? { icc: abs(total(a)) } : {}),
        ...(!wealth && ifd ? { ifd: abs(total(b)) } : {}),
      },
      lines: [...a, ...b],
    };
  };
  const of =
    (...codes: string[]) =>
    (i: Item) =>
      codes.includes(i.code);
  const start = (prefix: string) => (i: Item) => i.code.startsWith(prefix);
  const one = (l?: Line, m?: Line) => ({
    value: { ...(l ? { icc: abs(l.amount) } : {}), ...(m ? { ifd: abs(m.amount) } : {}) },
    lines: [l, m].filter((x): x is Line => Boolean(x)),
  });
  if (form === 'PG4') {
    if (code === '91.00') return one(icc?.wealth.grossWealth);
    if (code === '99.00') return one(icc?.wealth.taxableWealth);
    if (code === '14.00') return sum(of('14.00'), true);
    if (code === '16.00') return sum(of('16.40', '16.70'), true);
    if (code === '55.00') return sum(of('55.10'), true);
    return { value: {}, lines: [] };
  }
  switch (code) {
    case '11.00':
      return sum(of('11.10', '11.50'));
    case '21.00':
      return sum(of('21.10', '21.50'));
    case '12.00':
      return sum(of('12.01', '22.01'));
    case '13.00':
      return sum(of('13.10', '13.20', '13.40'));
    case '17.00':
      return sum(of('17.10'));
    case '14.00':
      return sum(of('14.00'));
    case '16.00':
      return sum(of('16.30'));
    case '91.00':
      return one(icc?.grossIncome, ifd?.grossIncome);
    case '31.00':
      return sum(start('31.'));
    case '41.00':
      return sum(start('41.'));
    case '52.00':
      return {
        value: {
          ...(icc ? { icc: abs(total(pick(icc.items, of('52.15', '52.21')))) } : {}),
          ...(ifd ? { ifd: abs(total(pick(ifd.items, of('52.00')))) } : {}),
        },
        lines: [...pick(icc?.items, of('52.15', '52.21')), ...pick(ifd?.items, of('52.00'))],
      };
    case '53.00':
      return sum(of('53.10'));
    case '55.00':
      return sum(of('55.10'));
    case '59.00':
      return sum(start('59.'));
    case '73.10':
      return { value: icc ? { icc: abs(total(pick(icc.items, of('73.00')))) } : {}, lines: [] };
    case '73.20':
      return { value: ifd ? { ifd: abs(total(pick(ifd.items, of('73.00')))) } : {}, lines: [] };
    case '95.00':
      return one(icc?.totalIncome, ifd?.totalIncome);
    case '99.00':
      return one(icc?.taxableIncome, ifd?.taxableIncome);
    default:
      // A detail line of annex A (31.10, 41.40...) or of page 3 (71.00, 74.00).
      return sum(of(code));
  }
}

/** Taxable income (99.00, PG3) is compared too, when last year's declaration printed it. */
const SUMMARY = [
  {
    section: 'income' as const,
    form: 'PG3' as const,
    code: '99.00',
    person: 'household' as const,
    label: { en: 'Taxable income', fr: 'Revenu imposable' },
    official: 'Revenu imposable',
    source: 'ge-2025-declaration-specimen p. 3',
  },
];

/**
 * The main lines of last year's declaration next to this year's figures. Only the lines last year's
 * declaration has; nothing when it was not read.
 */
export function compareWithLastYear(r: TaxResult, facts: readonly Fact[]): LastYearRow[] {
  const prior = priorLines(facts);
  if (!prior.length) return [];
  const rows: LastYearRow[] = [];
  for (const main of [...PRIOR_MAIN_LINES_2026, ...SUMMARY]) {
    const lines = prior.filter(
      (l: PriorLine) => l.form === main.form && l.code === main.code && !l.suffix,
    );
    if (!lines.length) continue;
    const last: YearPair = {};
    for (const l of lines) {
      if (l.icc !== undefined) last.icc = (last.icc ?? 0) + abs(l.icc);
      if (l.ifd !== undefined) last.ifd = (last.ifd ?? 0) + abs(l.ifd);
    }
    const now = thisYear(r, main.form, main.code);
    const change: YearPair = {};
    if (last.icc !== undefined && now.value.icc !== undefined)
      change.icc = now.value.icc - last.icc;
    if (last.ifd !== undefined && now.value.ifd !== undefined)
      change.ifd = now.value.ifd - last.ifd;
    rows.push({
      form: main.form,
      code: main.code,
      person: main.person,
      label: main.label,
      official: main.official,
      lastYear: last,
      thisYear: now.value,
      change,
      lastYearNeedsOk: lines.some((l) => l.status === 'extracted'),
      thisYearProvisional: now.lines.some((l) => l.needsOk || l.estimates?.length || l.incomplete),
    });
  }
  return rows;
}
