// The values to type on Zug's form K, from Zug's engine, laid out by the shared copy panel: every
// value finds its line, a value both taxes share is typed once into each column, and the canton's
// filing side answers the generic views. Synthetic households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type ZugCantonal } from '@taxpresso/rules-zg';
import { describe, expect, it } from 'vitest';
import { filing, FORM_ZG_2026, ZG_COPY_LABELS, zugFormItems, zugLineOf } from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Muster family of Baar: two salaries, two children, a crèche for the younger, savings. */
const MUSTER: HouseholdInput<ZugCantonal> = {
  taxYear: 2026,
  commune: 'Baar',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(95_000), socialContributions: chf(6_080), pensionFund: chf(5_200) },
      ],
      pillar3a: chf(7_258),
      commuteCost: chf(729),
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
    { custody: 'full', under14: false },
    { custody: 'full', under14: true },
  ],
  household: { healthPremiums: chf(11_400), childcare: chf(18_000) },
  movable: [{ owner: 'p1', value: chf(240_000), income: chf(120) }],
  cantonal: {
    church: { p1: 'none', p2: 'none' },
    citizenOf: { p1: null, p2: null },
    children: [{ under15: false, minor: true }, { under15: true }],
    rent: chf(28_000),
  },
};

function panel(input: HouseholdInput<ZugCantonal>) {
  const result = rules.computeReturn(input);
  const items = zugFormItems(result);
  const built = buildCopyPanel({ form: FORM_ZG_2026, items, lang: 'en', labels: ZG_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  return { result, items, built, rows, row };
}

const copies = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);
/** Each row with its columns ("icc+ifd" for one value in both) and what to type. */
const cols = (rs: readonly CopyRow[]) =>
  rs.map((r) => [r.columns.map((c) => c.id).join('+'), r.copy]);

describe('the values to type on Zug’s form K', () => {
  it('places every value the engine gives, in the form’s order', () => {
    const { result, built, row } = panel(MUSTER);
    expect(result.icc && result.ifd).toBeTruthy();
    expect(built.unplaced).toEqual([]);
    // The income: one value, typed into both columns; 190 likewise.
    expect(cols(row('K2', '100'))).toEqual([['icc+ifd', '83720']]);
    expect(cols(row('K2', '190'))).toEqual([
      ['icc+ifd', String(result.icc!.grossIncome.amount / 100)],
    ]);
    // A deduction both taxes take alike: one value, typed into each column.
    expect(cols(row('K3', '220'))).toEqual([['icc+ifd', '7258']]);
    // Different amounts in the two columns: each tax's maximum for the insurance premiums.
    expect(row('K3', '230').map((r) => r.columns.map((c) => c.id).join('+'))).toEqual([
      'icc',
      'ifd',
    ]);
    // The cantonal tax only: the personal deduction, own care, the extra child deduction, the rent.
    expect(cols(row('K3', '400'))).toEqual([['icc', '24000']]);
    expect(cols(row('K3', '403a'))).toEqual([['icc', '12200']]);
    expect(cols(row('K3', '407'))).toEqual([['icc', '8400']]);
    // The federal tax only: the married couple; the child deduction in each column its own amount.
    expect(cols(row('K3', '401'))).toEqual([['ifd', '2800']]);
    expect(row('K3', '403').map((r) => r.columns.map((c) => c.id).join('+'))).toEqual([
      'icc',
      'ifd',
    ]);
    // The crèche (18,000) for the child under 15: more than own care, so childcare (253).
    expect(cols(row('K3', '253'))).toEqual([['icc+ifd', '18000']]);
    // The taxable incomes, each from its own column.
    expect(cols(row('K3', '490'))).toEqual([
      ['icc', String(result.icc!.taxableIncome.amount / 100)],
      ['ifd', String(result.ifd!.taxableIncome.amount / 100)],
    ]);
    // The wealth page.
    expect(copies(row('K4', '600'))).toEqual(['240000']);
    expect(copies(row('K4', '690'))).toEqual([
      String(result.icc!.wealth.taxableWealth.amount / 100),
    ]);
  });

  it('gives nothing to type when the cantonal tax is not computed', () => {
    const r = rules.computeReturn({
      ...MUSTER,
      cantonal: { ...MUSTER.cantonal, citizenOf: { p1: 'Baar', p2: 'Cham' } },
    });
    expect(r.icc).toBeNull();
    expect(zugFormItems(r)).toEqual([]);
  });

  it('answers the generic views: lines, order, the 2026 note, the words for Claude', () => {
    expect(filing.canton).toBe('ZG');
    expect(zugLineOf('salary.gross', 'p2')).toBe('101');
    expect(zugLineOf('pillar3a.paid', 'p1')).toBe('220');
    expect(zugLineOf('unknown.key', 'p1')).toBeUndefined();
    expect(filing.salaryLine('p1')).toBe('100');
    const order = filing.formOrder(2026);
    expect(order('100')! < order('190')!).toBe(true);
    expect(order('190')! < order('201')!).toBe(true);
    expect(order('490')! < order('600')!).toBe(true);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)?.en).toMatch(/2025 form K/);
    expect(filing.words.guide).toMatch(/eTax\.zug/);
    expect(filing.checksPdf).toBe(false);
    expect(filing.formValues!(rules.computeReturn(MUSTER)).length).toBeGreaterThan(10);
  });
});
