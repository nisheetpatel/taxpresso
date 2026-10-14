// The values to type on the Aargau return, from Aargau's engine, laid out by the shared copy panel:
// every value finds its line, in the one column, and the canton's filing side answers the generic
// views. Synthetic households only.
import { buildCopyPanel } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type AargauCantonal } from '@taxpresso/rules-ag';
import { describe, expect, it } from 'vitest';
import {
  AG_COPY_LABELS,
  aargauFormItems,
  aargauLineOf,
  filing,
  FORM_AG_2026,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Keller family of Baden: two salaries, two children, a crèche, savings, Roman Catholic. */
const KELLER: HouseholdInput<AargauCantonal> = {
  taxYear: 2026,
  commune: 'Baden',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(95_000), socialContributions: chf(6_080), pensionFund: chf(5_200) },
      ],
      pillar3a: chf(7_258),
      commuteCost: chf(1_200),
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
  children: [{ custody: 'full' }, { custody: 'full' }],
  household: { healthPremiums: chf(11_400), childcare: chf(8_000), donations: chf(600) },
  movable: [{ owner: 'p1', value: chf(240_000), income: chf(120) }],
  cantonal: {
    church: { p1: 'catholic', p2: 'catholic', parish: 'Baden' },
    childBands: ['under14', 'under18'],
  },
};

function panel(input: HouseholdInput<AargauCantonal>) {
  const result = rules.computeReturn(input);
  const items = aargauFormItems(result);
  const built = buildCopyPanel({ form: FORM_AG_2026, items, lang: 'en', labels: AG_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  return { result, items, built, rows, row };
}

describe('the values to type on the Aargau return', () => {
  it('places every value the engine gives, in the guide’s order, whole francs', () => {
    const { result, built, rows, row } = panel(KELLER);
    expect(result.icc).not.toBeNull();
    expect(built.unplaced).toEqual([]);
    expect(built.provisional).toBe(true);
    expect(built.note).toMatch(/Check each code against your form or eTAX AARGAU/);
    expect(built.sections.map((s) => s.page)).toEqual(['EK', 'AB', 'SO', 'VM']);
    // Each spouse's salary on their own line, the copy in whole francs without separators.
    expect(row('EK', '1.1').map((r) => [r.person, r.copy])).toEqual([
      ['A', '83720'],
      ['B', '37810'],
    ]);
    // The flat insurance deduction (married, 2026) and the household's childcare (one child under
    // 14: that child's).
    expect(row('AB', '14')[0]?.copy).toBe('7600');
    expect(row('AB', '15.0')[0]?.copy).toBe('8000');
    expect(row('SO', '19.1')[0]?.copy).toBe(String(9_300 + 10_300));
    expect(row('SO', '25')[0]?.copy).toBe(String(result.icc!.taxableIncome.amount / 100));
    // Wealth: the securities' value, the tax-free amounts, the taxable wealth.
    expect(row('VM', '20.1')[0]?.copy).toBe('240000');
    expect(row('VM', '37')[0]?.copy).toBe(String(result.icc!.wealth.taxableWealth.amount / 100));
    // No federal column: nothing federal to type.
    expect(rows.every((r) => r.columns.every((c) => c.id === 'amount' || c.id === 'wealth'))).toBe(
      true,
    );
  });

  it('gives nothing to type when the cantonal tax is not computed (fail closed)', () => {
    const mixed = rules.computeReturn({
      ...KELLER,
      cantonal: { ...KELLER.cantonal, church: { p1: 'catholic', p2: 'reformed' } },
    });
    expect(mixed.icc).toBeNull();
    expect(aargauFormItems(mixed)).toEqual([]);
  });

  it('leaves the wealth page out when there is no wealth', () => {
    const { built } = panel({ ...KELLER, movable: [] });
    expect(built.sections.map((s) => s.page)).toEqual(['EK', 'AB', 'SO']);
  });

  it('answers the generic views: lines, order, note, words', () => {
    expect(filing.canton).toBe('AG');
    expect(filing.checksPdf).toBe(false);
    expect(filing.formNote(2025)?.en).toMatch(/101\.01/);
    expect(filing.formNote(2026)?.en).toMatch(/101\.01/);
    const order = filing.formOrder(2026);
    expect(order('1.1')! < order('10.1')!).toBe(true);
    expect(order('10.1')! < order('19.1')!).toBe(true);
    expect(order('19.1')! < order('20.1')!).toBe(true);
    expect(order('99')).toBeUndefined();
    expect(filing.salaryLine('p2')).toBe('1.1');
    expect(aargauLineOf('pillar3a.paid')).toBe('13.2');
    expect(aargauLineOf('debt.balance')).toBe('34');
    expect(aargauLineOf('unknown.key')).toBeUndefined();
    expect(filing.words.guide).toMatch(/eTAX AARGAU/);
    expect(filing.words.guide).toMatch(/check each against the form or eTAX AARGAU/);
    expect(filing.words.example).toBe('AB');
  });
});
