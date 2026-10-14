// The values to type on the Fribourg return, from Fribourg's engine, laid out by the shared copy
// panel: every value finds its line, each person's on their part, the annexes' totals carry to 3.210
// and 4.210, and 2026's lines show though its taxes wait for the communal coefficients. Synthetic
// households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { NOTE, rules, type FribourgCantonal } from '@taxpresso/rules-fr';
import { describe, expect, it } from 'vitest';
import {
  filing,
  FORM_FR_2025,
  FORM_FR_2026,
  FR_COPY_LABELS,
  fribourgFormItems,
  fribourgLineOf,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Berset family of Bulle: two salaries, two children, a crèche for the younger, savings, a loan. */
const BERSET: HouseholdInput<FribourgCantonal> = {
  taxYear: 2025,
  commune: 2125,
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(95_000), socialContributions: chf(6_080), pensionFund: chf(5_200) },
      ],
      pillar3a: chf(7_258),
      commuteCost: chf(900),
      commuteMode: { by: 'public_transport' },
      mealDays: 200,
      trainingCosts: chf(1_500),
    },
    {
      id: 'p2',
      employments: [
        { gross: chf(42_000), socialContributions: chf(2_690), pensionFund: chf(1_500) },
      ],
      commuteMode: { by: 'bike' },
    },
  ],
  children: [{ custody: 'full' }, { custody: 'full' }],
  household: { childcare: chf(9_000), debtInterest: chf(1_200), debts: chf(40_000) },
  movable: [{ owner: 'p1', value: chf(240_000), income: chf(1_200) }],
  cantonal: {
    church: { p1: 'catholic', p2: 'catholic' },
    children: [
      { age: 'child', under14: false },
      { age: 'child', under14: true },
    ],
  },
};

function panel(input: HouseholdInput<FribourgCantonal>) {
  const result = rules.computeReturn(input);
  const items = fribourgFormItems(result);
  const form = input.taxYear === 2025 ? FORM_FR_2025 : FORM_FR_2026;
  const built = buildCopyPanel({ form, items, lang: 'en', labels: FR_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  return { result, items, built, rows, row };
}

const copies = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);
const amount = (l: { amount: number }) => String(Math.abs(l.amount) / 100);

describe('the values to type on the Fribourg return', () => {
  it('places every value the engine gives, in the form’s order, each person on their part', () => {
    const { result, built, row } = panel(BERSET);
    expect(result.icc && result.ifd).toBeTruthy();
    expect(built.unplaced).toEqual([]);
    const icc = result.icc!;
    // Each salary on its person's part of 1.110.
    expect(row('V', '1.110').map((r) => `${r.part?.label}: ${r.copy}`)).toEqual([
      'Personne 1: 83720',
      'Personne 2: 37810',
    ]);
    // Travel: the bus paid, the bike's flat amount.
    expect(row('VI', '2.110').map((r) => r.copy)).toEqual(['900', '700']);
    // The annexes' totals, and the lines they carry to on the return.
    expect(copies(row('A01', 'A01-R'))).toEqual(['1200']);
    expect(copies(row('A01', 'A01-F'))).toEqual(['240000']);
    expect(copies(row('A02', 'A02-I'))).toEqual(['1200']);
    expect(copies(row('A02', 'A02-D'))).toEqual(['40000']);
    expect(row('VII', '3.210').map((r) => `${r.columns[0]!.label} ${r.copy}`)).toEqual([
      'Revenu 1200',
      'Fortune 240000',
    ]);
    // The crèche, given for the household, is the younger child's (one child under 14).
    expect(copies(row('VIII', '4.380'))).toEqual(['9000']);
    // The totals of the return.
    expect(copies(row('IX', '4.910'))).toEqual([amount(icc.netIncome)]);
    expect(copies(row('IX', '7.910'))).toEqual([
      amount(icc.taxableIncome),
      amount(icc.wealth.taxableWealth),
    ]);
    // No federal value: the return has no federal part.
    expect(built.sections.map((s) => s.page)).toEqual([
      'A01',
      'A02',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
    ]);
  });

  it('2026: the lines of the return though the taxes wait for the communal coefficients', () => {
    const { result, built, row } = panel({ ...BERSET, taxYear: 2026 });
    expect(result.icc).toBeNull();
    expect(result.unsupported).toEqual([NOTE.communes2026]);
    expect(built.unplaced).toEqual([]);
    expect(built.provisional).toBe(true);
    expect(copies(row('V', '1.110'))).toEqual(['83720', '37810']);
    expect(copies(row('IX', '7.910'))).toHaveLength(2);
  });

  it('gives nothing to type when the lines can’t be computed', () => {
    const r = rules.computeReturn({
      ...BERSET,
      civilStatus: 'divorced',
      people: [BERSET.people[0]!],
      children: [{ custody: 'shared' }],
      childSupport: 'none',
      cantonal: { church: { p1: 'none' }, children: [{ age: 'child', under14: true }] },
    });
    expect(r.form).toBeNull();
    expect(fribourgFormItems(r)).toEqual([]);
  });

  it('answers the generic views: lines, order, the notes, the words for Claude', () => {
    expect(filing.canton).toBe('FR');
    expect(fribourgLineOf('salary.gross')).toBe('1.110');
    expect(fribourgLineOf('pillar3a.paid')).toBe('4.130');
    expect(fribourgLineOf('childcare.costs')).toBe('4.380');
    expect(fribourgLineOf('unknown.key')).toBeUndefined();
    expect(filing.lineOf('pillar3a.paid', 'p2')).toBe('4.130');
    expect(filing.salaryLine('p2')).toBe('1.110');
    const order = filing.formOrder(2026);
    expect(order('A01-R')! < order('1.110')!).toBe(true);
    expect(order('1.110')! < order('2.110')!).toBe(true);
    expect(order('4.420')! < order('4.910')!).toBe(true);
    expect(order('4.910')! < order('7.910')!).toBe(true);
    expect(filing.formNote(2025)?.en).toMatch(/2025 Fribourg guide/);
    expect(filing.formNote(2026)?.en).toMatch(/2026 guide and FriTax 2026/);
    expect(filing.words.guide).toMatch(/FriTax is not a web page/);
    expect(filing.checksPdf).toBe(false);
    expect(filing.formValues!(rules.computeReturn(BERSET)).length).toBeGreaterThan(20);
  });
});
