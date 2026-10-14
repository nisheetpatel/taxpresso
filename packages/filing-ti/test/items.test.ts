// The values to type on Ticino's forms, from Ticino's engine, laid out by the shared copy panel:
// every value finds its line, Modulo 4's total equals its lines and is carried to 9.1 and 9.2,
// Modulo 6 and 5 carry what the engine started from, the totals are the engine's, and the canton's
// filing side answers the generic views. Synthetic households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type TicinoCantonal } from '@taxpresso/rules-ti';
import { describe, expect, it } from 'vitest';
import {
  filing,
  FORM_TI_2026,
  TI_COPY_LABELS,
  TI_FORM_KEYS,
  ticinoFormItems,
  ticinoLineOf,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/**
 * The Bernasconi family of Bellinzona: two salaries, the bus and a bike to work, two children (the
 * younger in a crèche), illness costs, donations, savings and a loan.
 */
const BERNASCONI: HouseholdInput<TicinoCantonal> = {
  taxYear: 2026,
  commune: 'BELLINZONA',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(98_000), socialContributions: chf(6_272), pensionFund: chf(4_900) },
      ],
      commuteMode: { by: 'public_transport' },
      commuteCost: chf(1_200),
      mealDays: 180,
      pillar3a: chf(7_258),
    },
    {
      id: 'p2',
      employments: [
        { gross: chf(54_000), socialContributions: chf(3_456), pensionFund: chf(2_100) },
      ],
      commuteMode: { by: 'bike' },
      commuteCost: chf(500),
      pillar3a: chf(3_000),
      trainingCosts: chf(1_200),
    },
  ],
  children: [
    { custody: 'full', under14: true, childcare: chf(14_000) },
    { custody: 'full', under14: true },
  ],
  household: {
    healthPremiums: chf(12_800),
    medicalCosts: chf(9_500),
    donations: chf(1_500),
    debtInterest: chf(1_200),
    debts: chf(40_000),
  },
  movable: [{ owner: 'household', value: chf(120_000), income: chf(600) }],
  cantonal: {
    workRate: { p1: 100, p2: 60 },
    monthsWorked: { p1: 12, p2: 12 },
    childrenMinor: [true, true],
  },
};

const result = rules.computeReturn(BERNASCONI);
const items = ticinoFormItems(result);
const panel = buildCopyPanel({ form: FORM_TI_2026, items, lang: 'en', labels: TI_COPY_LABELS });
const rows: CopyRow[] = panel.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
const row = (key: string, person = 'household') =>
  rows.find((r) => r.key === key && r.person === person);

describe('the values to type on Ticino’s forms', () => {
  it('computes the household, and every value finds its line', () => {
    expect(result.unsupported).toEqual([]);
    expect(result.icc).not.toBeNull();
    expect(panel.unplaced).toEqual([]);
    expect(panel.sections.map((s) => s.page)).toEqual([
      'M4-1',
      'M4-2',
      'M6',
      'M5',
      'P2',
      'P3',
      'P4',
    ]);
  });

  it('adds up Modulo 4 for each person and carries it to 9.1 and 9.2', () => {
    const icc = result.icc!;
    for (const [person, total, line, who] of [
      ['p1', '438', '9.1', 'A'],
      ['p2', '488', '9.2', 'B'],
    ] as const) {
      const parts = icc.professional.filter((i) => i.person === person);
      const sum = parts.reduce((s, i) => s - i.amount, 0);
      expect(row(total, who)?.centimes, total).toBe(sum);
      expect(row(line, who)?.centimes, line).toBe(sum);
    }
    // The taxpayer: the bus 1,200 (2.1), meals 180 x 15 = 2,700 (3.1), the flat 3,500 (5.1).
    expect(row('400', 'A')?.centimes).toBe(chf(1_200).value);
    expect(row('408', 'A')?.centimes).toBe(chf(2_700).value);
    expect(row('420', 'A')?.centimes).toBe(chf(3_500).value);
    // The spouse: the bike 500 (2.3).
    expect(row('454', 'B')?.centimes).toBe(chf(500).value);
  });

  it('carries Modulo 6 and 5 to 12, 20, 22.1, 13.2, 33.1 and 24', () => {
    const K = TI_FORM_KEYS;
    expect(row(K.premiums)?.centimes).toBe(chf(12_800).value);
    expect(row(K.premiumsAllowed)?.centimes).toBe(row('12')?.centimes);
    expect(row(K.premiumsMax)!.centimes).toBeGreaterThanOrEqual(row('12')!.centimes!);
    expect(row(K.childcarePaid)?.centimes).toBe(chf(14_000).value);
    expect(row(K.childcareTotal)?.centimes).toBe(row('20')?.centimes);
    expect(row(K.medicalCosts)?.centimes).toBe(chf(9_500).value);
    expect(row('22.1a')?.centimes).toBe(chf(9_500).value);
    expect(row(K.medicalThreshold)?.centimes).toBe(row('22.1b')?.centimes);
    expect(row('22.1')?.centimes).toBe(row('22.1a')!.centimes! - row('22.1b')!.centimes!);
    expect(row(K.debts)?.centimes).toBe(chf(40_000).value);
    expect(row(K.interest)?.centimes).toBe(chf(1_200).value);
    expect(row(K.donations)?.centimes).toBe(row('24')?.centimes);
  });

  it('gives the totals the engine computed', () => {
    const icc = result.icc!;
    expect(row('8')?.centimes).toBe(icc.grossIncome.amount);
    expect(row('19')?.centimes).toBe(icc.netIncome.amount);
    expect(row('28')?.centimes).toBe(icc.taxableIncome.amount);
    expect(row('36')?.centimes).toBe(icc.wealth.taxableWealth.amount);
  });

  it('answers the generic views: the lines of a value, the order, the words', () => {
    expect(ticinoLineOf('pillar3a.paid', 'p2')).toBe('11.2');
    expect(ticinoLineOf('salary.gross', 'p1')).toBe('1.1');
    expect(filing.salaryLine('p2')).toBe('1.1');
    const order = filing.formOrder(2026);
    expect(order('438')! < order('12')!).toBe(true);
    expect(order('8')! < order('28')!).toBe(true);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)?.en).toMatch(/2025 forms/);
    expect(filing.words.example).toBe('M4-1');
    expect(FORM_TI_2026.pages.map((p) => p.id)).toContain(filing.words.example);
    expect(filing.words.guide).toMatch(/eTax PF/);
    expect(filing.checksPdf).toBe(false);
  });
});
