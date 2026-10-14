// The values to type on the Basel-Landschaft return, from Basel-Landschaft's engine, laid out by the
// shared copy panel: every value finds its line, a value both taxes share is typed once into each
// column, and the canton's filing side answers the generic views. Synthetic households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type BaselLandCantonal } from '@taxpresso/rules-bl';
import { describe, expect, it } from 'vitest';
import {
  BL_COPY_LABELS,
  baselLandFormItems,
  baselLandLineOf,
  filing,
  FORM_BL_2026,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Muster family of Allschwil: two salaries, two children, a crèche, savings. */
const MUSTER: HouseholdInput<BaselLandCantonal> = {
  taxYear: 2026,
  commune: 'Allschwil',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(95_000), socialContributions: chf(6_080), pensionFund: chf(5_200) },
      ],
      pillar3a: chf(7_258),
      commuteCost: chf(1_032),
      commuteMode: { by: 'public_transport' },
      mealDays: 200,
    },
    {
      id: 'p2',
      employments: [
        { gross: chf(42_000), socialContributions: chf(2_690), pensionFund: chf(1_500) },
      ],
      commuteMode: { by: 'bike' },
    },
  ],
  children: [
    { custody: 'full', under14: true },
    { custody: 'full', under14: true },
  ],
  household: { healthPremiums: chf(11_400), childcare: chf(8_000) },
  movable: [{ owner: 'p1', value: chf(240_000), income: chf(120) }],
  cantonal: { church: { p1: 'none', p2: 'none' } },
};

function panel(input: HouseholdInput<BaselLandCantonal>) {
  const result = rules.computeReturn(input);
  const items = baselLandFormItems(result);
  const built = buildCopyPanel({ form: FORM_BL_2026, items, lang: 'en', labels: BL_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  return { result, items, built, rows, row };
}

const copies = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);
/** Each row with its columns ("icc+ifd" for one value in both) and what to type. */
const cols = (rs: readonly CopyRow[]) =>
  rs.map((r) => [r.columns.map((c) => c.id).join('+'), r.copy]);

describe('the values to type on the Basel-Landschaft return', () => {
  it('places every value the engine gives, in the form’s order', () => {
    const { result, built, row } = panel(MUSTER);
    expect(result.icc && result.ifd).toBeTruthy();
    expect(built.unplaced).toEqual([]);
    // The income in one column; the subtotal carried to both; 499 in both.
    expect(copies(row('S2', '100'))).toEqual(['83720']);
    expect(copies(row('S2', '399'))).toEqual([String(result.icc!.grossIncome.amount / 100)]);
    expect(cols(row('S2', '399-uebertrag'))).toEqual([
      ['icc+ifd', String(result.icc!.grossIncome.amount / 100)],
    ]);
    // A deduction both taxes take alike: one value, typed into each column.
    expect(cols(row('S3', '610'))).toEqual([['icc+ifd', '7258']]);
    // Different amounts in the two columns: the state's flat maximum, the federal paid premiums.
    expect(cols(row('S3', '620'))).toEqual([
      ['icc', '4000'],
      ['ifd', '3700'],
    ]);
    // Federal only: the children and the married couple.
    expect(cols(row('S3', '750'))).toEqual([['ifd', '13600']]);
    expect(cols(row('S3', '775'))).toEqual([['ifd', '2800']]);
    // The taxable incomes, each from its own column.
    expect(cols(row('S3', '790'))).toEqual([
      ['icc', String(result.icc!.taxableIncome.amount / 100)],
      ['ifd', String(result.ifd!.taxableIncome.amount / 100)],
    ]);
    // The wealth page.
    expect(copies(row('S4', '800'))).toEqual(['240000']);
    expect(copies(row('S4', '910'))).toEqual([
      String(result.icc!.wealth.taxableWealth.amount / 100),
    ]);
  });

  it('gives nothing to type when the state tax is not computed', () => {
    const r = rules.computeReturn({
      ...MUSTER,
      cantonal: { church: { p1: 'catholic', p2: 'reformed' } },
    });
    expect(r.icc).toBeNull();
    expect(baselLandFormItems(r)).toEqual([]);
  });

  it('answers the generic views: lines, order, the 2026 note, the words for Claude', () => {
    expect(filing.canton).toBe('BL');
    expect(baselLandLineOf('salary.gross', 'p2')).toBe('105');
    expect(baselLandLineOf('pillar3a.paid', 'p1')).toBe('610');
    expect(baselLandLineOf('unknown.key', 'p1')).toBeUndefined();
    expect(filing.salaryLine('p1')).toBe('100');
    const order = filing.formOrder(2026);
    expect(order('100')! < order('499')!).toBe(true);
    expect(order('499')! < order('500')!).toBe(true);
    expect(order('790')! < order('800')!).toBe(true);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)?.en).toMatch(/20 March 2026/);
    expect(filing.words.guide).toMatch(/E-Tax BL/);
    expect(filing.checksPdf).toBe(false);
    expect(filing.formValues!(rules.computeReturn(MUSTER)).length).toBeGreaterThan(10);
  });
});
