// The values to type on the Basel-Stadt return, from its engine: every value finds its place on the
// form, the two columns are one value where the taxes agree and two where the limits differ, and
// the auxiliary forms' lines add up to what the main form carries. Synthetic households only.
import { buildCopyPanel, type FormItem } from '@taxpresso/filing-ge';
import { rules, type BaselCantonal } from '@taxpresso/rules-bs';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import { baselFormItems, baselFormMap, BS_COPY_LABELS } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** A couple in Riehen: two salaries, a child at a crèche, 3a, premiums, savings, medical costs. */
const COUPLE: HouseholdInput<BaselCantonal> = {
  taxYear: 2026,
  commune: 'Riehen',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: amt(110_000), socialContributions: amt(7_040), pensionFund: amt(7_700) },
      ],
      commuteMode: { by: 'public_transport' },
      commuteCost: amt(824),
      mealDays: 200,
      pillar3a: amt(7_258),
    },
    {
      id: 'p2',
      employments: [{ gross: amt(50_000), socialContributions: amt(3_200) }],
      commuteMode: { by: 'bike' },
      hasPensionFund: false,
      pillar3a: amt(5_000),
    },
  ],
  children: [{ custody: 'full', under14: true }],
  household: {
    childcare: amt(14_000),
    healthPremiums: amt(9_600),
    medicalCosts: amt(9_000),
    donations: amt(1_200),
    bankFees: amt(80),
  },
  movable: [
    { owner: 'household', value: amt(60_000), income: amt(120) },
    { owner: 'p1', value: amt(40_000) },
  ],
  cantonal: {
    workRate: { p1: 100, p2: 50 },
    childrenMinor: [true],
    church: false,
    politicalParty: amt(400),
  },
};

const find = (items: readonly FormItem[], code: string, column?: string) =>
  items.filter((i) => i.code === code && (column === undefined || i.column === column));

describe('the values to type on the Basel-Stadt return', () => {
  const r = rules.computeReturn(COUPLE);
  const items = baselFormItems(r);

  it('computes the household: both taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(r.icc).not.toBeNull();
    expect(r.ifd).not.toBeNull();
  });

  it('places every value on the form, in the order you fill it in', () => {
    const panel = buildCopyPanel({
      form: baselFormMap(2026),
      items,
      lang: 'en',
      labels: BS_COPY_LABELS,
    });
    expect(panel.unplaced).toEqual([]);
    expect(panel.provisional).toBe(true);
    expect(panel.sections.map((s) => s.page)).toEqual([
      'W',
      'B1',
      'B2',
      'K',
      'Z',
      'F',
      'H2',
      'H3',
      'H4',
    ]);
    const h3 = panel.sections.find((s) => s.page === 'H3')!;
    const row620 = h3.groups.flatMap((g) => g.rows).find((x) => x.key === '620')!;
    // The 3a cap is the same in both taxes: one value for Kanton and Bund.
    expect(row620.columns.map((c) => c.label)).toEqual(['Kanton', 'Bund']);
    expect(row620.copy).toBe('7258');
  });

  it('gives one value for both columns where the taxes agree, two where the limits differ', () => {
    // The flat insurance deduction of the canton against what was paid for the federal tax.
    expect(find(items, '630').map((i) => [i.column, i.amount])).toEqual([
      ['icc', chf(8_400)],
      ['ifd', chf(3_700)],
    ]);
    expect(find(items, '632').map((i) => [i.column, i.amount])).toEqual([['ifd', chf(700)]]);
    // The couple deduction and the children: each tax its own amount.
    expect(find(items, '760').map((i) => i.column)).toEqual(['icc', 'ifd']);
    // The income lines: one column (369 the same in both).
    expect(find(items, '100')).toEqual([expect.objectContaining({ amount: chf(95_260) })]);
    expect(find(items, '369')[0]?.column).toBeUndefined();
  });

  it('fills form B, W, K, Z and F from the engine, adding up to the main form’s lines', () => {
    // Form B of person 1: its lines in each column add up to its total, carried to 519.
    const inColumn = (code: string, column: 'icc' | 'ifd') =>
      find(items, code).find((i) => i.column === column || i.column === undefined)?.amount ?? 0;
    for (const column of ['icc', 'ifd'] as const) {
      const lines = ['500', '503', '504', '514', '516'].reduce(
        (s, code) => s + inColumn(code, column),
        0,
      );
      expect(lines, column).toBe(inColumn('B-519', column));
      expect(inColumn('519', column), column).toBe(inColumn('B-519', column));
    }
    // Form W: the gross income, the costs, 369; the market value, the yield value, the mean.
    expect(find(items, 'W-1')[0]?.amount).toBe(chf(120));
    expect(find(items, 'W-6')[0]?.amount).toBe(chf(80));
    expect(find(items, 'W-10')[0]?.amount).toBe(chf(40));
    expect(find(items, 'W-11')[0]?.amount).toBe(chf(100_000));
    expect(find(items, 'W-14')[0]?.amount).toBe(chf(120 * 345));
    expect(find(items, '800')[0]?.amount).toBe(find(items, 'W-16')[0]?.amount);
    // Form K: the costs, the share you bear in each tax, what each deducts (725 on page 3).
    expect(find(items, 'K-720').map((i) => i.amount)).toEqual([chf(9_000)]);
    expect(find(items, 'K-725').map((i) => i.amount)).toEqual(
      find(items, '725').map((i) => i.amount),
    );
    // Form Z: the donations given, and the party payments; form F: the childcare.
    expect(find(items, 'Z-zuwendungen')[0]?.amount).toBe(chf(1_200));
    expect(find(items, 'Z-parteien')[0]?.amount).toBe(chf(400));
    expect(find(items, 'F-670').map((i) => i.amount)).toEqual(
      find(items, '670').map((i) => i.amount),
    );
  });

  it('gives the income calculation of each column', () => {
    const icc = r.icc!;
    const ifd = r.ifd!;
    expect(find(items, '709').map((i) => i.amount)).toEqual([
      icc.netIncome.amount,
      ifd.subtotal709.amount,
    ]);
    expect(find(items, '799').map((i) => i.amount)).toEqual([
      icc.taxableIncome.amount,
      ifd.taxableIncome.amount,
    ]);
    expect(find(items, '899')[0]?.amount).toBe(icc.wealth.taxableWealth.amount);
  });

  it('gives nothing to type while the cantonal tax is not computed', () => {
    const q = rules.computeReturn({ ...COUPLE, cantonal: { ...COUPLE.cantonal, workRate: {} } });
    expect(q.icc).toBeNull();
    expect(baselFormItems(q)).toEqual([]);
  });
});
