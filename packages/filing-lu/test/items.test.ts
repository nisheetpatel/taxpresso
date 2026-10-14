// The values to type on the Lucerne return, from Lucerne's engine, laid out by the shared copy
// panel: every value finds its line, form B's totals reach page 3, the securities list's lines reach
// 150, and the Ergänzungsblatt's lines are there to check. Synthetic households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type LucerneCantonal } from '@taxpresso/rules-lu';
import { describe, expect, it } from 'vitest';
import {
  filing,
  FORM_LU_2026,
  LU_COPY_LABELS,
  lucerneFormItems,
  lucerneLineOf,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Meier family of Kriens: two salaries, two children, a crèche for the younger, savings. */
const MEIER: HouseholdInput<LucerneCantonal> = {
  taxYear: 2026,
  commune: 'Kriens',
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
      trainingCosts: chf(800),
    },
  ],
  children: [
    { custody: 'full', under14: false },
    { custody: 'full', under14: true },
  ],
  household: { healthPremiums: chf(11_400), childcare: chf(12_000) },
  movable: [{ owner: 'p1', value: chf(240_000), income: chf(1_200) }],
  cantonal: {
    church: { p1: 'catholic', p2: 'none', children: ['catholic', 'none'] },
    children: [
      { under14: false, livesWithYou: true },
      { under14: true, livesWithYou: true },
    ],
  },
};

function panel(input: HouseholdInput<LucerneCantonal>) {
  const result = rules.computeReturn(input);
  const items = lucerneFormItems(result);
  const built = buildCopyPanel({ form: FORM_LU_2026, items, lang: 'en', labels: LU_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  return { result, items, built, rows, row };
}

const copies = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);
const amount = (l: { amount: number }) => String(Math.abs(l.amount) / 100);

describe('the values to type on the Lucerne return', () => {
  it('places every value the engine gives, in the form’s order', () => {
    const { result, built, row } = panel(MEIER);
    expect(result.icc && result.ifd).toBeTruthy();
    expect(built.unplaced).toEqual([]);
    const icc = result.icc!;
    const at = (code: string, person = 'household') =>
      icc.items.find((i) => i.code === code && i.person === person)!;
    // Form B and its totals, which page 3 takes as they are.
    expect(copies(row('B', '208t'))).toEqual(['900']);
    expect(copies(row('B', '209t'))).toEqual(['700']);
    const formB1 = ['208t', '212', '220'].reduce((s, c) => s + at(c, 'p1').amount, 0);
    expect(copies(row('B', '238'))).toEqual([String(-formB1 / 100)]);
    expect(copies(row('S3', '238'))).toEqual([String(-formB1 / 100)]);
    expect(row('S3', '239')).toHaveLength(1);
    // The securities list: gross income and the flat costs, their difference on page 2 (150).
    expect(copies(row('WV', 'WV4'))).toEqual(['1200']);
    expect(copies(row('WV', 'WV6'))).toEqual(['720']);
    expect(copies(row('S2', '150'))).toEqual(['480']);
    expect(copies(row('S2', '100'))).toEqual(['83720']);
    expect(copies(row('S2', '199'))).toEqual([amount(icc.grossIncome)]);
    // Page 3: training per person and both together (250); the totals.
    expect(copies(row('S3', '248'))).toEqual(['1500']);
    expect(copies(row('S3', '249'))).toEqual(['800']);
    expect(copies(row('S3', '250'))).toEqual(['2300']);
    expect(copies(row('S3', '299'))).toEqual([amount(icc.totalDeductions)]);
    expect(copies(row('S3', '310'))).toEqual([amount(icc.incomeAfterDeductions)]);
    // The crèche, given for the household, is the younger child's (one child under 14).
    expect(copies(row('S3', '360'))).toEqual(['12000']);
    expect(copies(row('S3', '380'))).toEqual([amount(icc.taxableIncome)]);
    // The wealth page.
    expect(copies(row('S4', '400'))).toEqual(['240000']);
    expect(copies(row('S4', '480'))).toEqual([amount(icc.wealth.taxableWealth)]);
    // The Ergänzungsblatt, in the federal column: 310 carried, the federal lines, its total 23.
    expect(row('EB', 'E1').map((r) => r.columns.map((c) => c.id).join('+'))).toEqual(['ifd']);
    expect(copies(row('EB', 'E1'))).toEqual([amount(icc.incomeAfterDeductions)]);
    expect(copies(row('EB', 'E23'))).toEqual([amount(result.ifd!.taxableIncome)]);
    // In the form's order: form B first, then the securities list, pages 2 to 4, the sheet.
    expect(built.sections.map((s) => s.page)).toEqual(['B', 'WV', 'S2', 'S3', 'S4', 'EB']);
  });

  it('gives nothing to type when the cantonal tax is not computed', () => {
    // The church tax asked, the children's confessions not answered: not computed (fail closed).
    const r = rules.computeReturn({
      ...MEIER,
      cantonal: { ...MEIER.cantonal, church: { p1: 'catholic', p2: 'none' } },
    });
    expect(r.icc).toBeNull();
    expect(lucerneFormItems(r)).toEqual([]);
  });

  it('answers the generic views: lines, order, the 2026 note, the words for Claude', () => {
    expect(filing.canton).toBe('LU');
    expect(lucerneLineOf('salary.gross', 'p2')).toBe('101');
    expect(lucerneLineOf('pillar3a.paid', 'p1')).toBe('260');
    expect(lucerneLineOf('childcare.costs', 'household')).toBe('360');
    expect(lucerneLineOf('unknown.key', 'p1')).toBeUndefined();
    expect(filing.salaryLine('p1')).toBe('100');
    const order = filing.formOrder(2026);
    expect(order('238')! < order('100')!).toBe(true);
    expect(order('100')! < order('199')!).toBe(true);
    expect(order('199')! < order('248')!).toBe(true);
    expect(order('380')! < order('400')!).toBe(true);
    expect(order('480')! < order('E1')!).toBe(true);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)?.en).toMatch(/2025 Lucerne forms/);
    expect(filing.words.guide).toMatch(/eSteuern\.LU/);
    expect(filing.checksPdf).toBe(false);
    expect(filing.formValues!(rules.computeReturn(MEIER)).length).toBeGreaterThan(20);
  });
});
