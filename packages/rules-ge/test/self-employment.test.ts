// Self-employment in Geneva, the simple case (SPEC.md section 1): synthetic households whose every
// expected value was derived by hand, step by step, from the official documents, for tax years 2025
// and 2026. Fake people, fake businesses, fake figures.
//
// Documents and the values read in them:
//   ge-2025-declaration-specimen p. 8 and 10 (annexe B2 and B4): 12.17 = 12.08 + 12.09 + 12.15 +
//     12.16; 12.45 = 12.21 + 12.22 + 12.23 + 12.24 + 12.41 + 12.42; 12.46 = 12.17 - 12.45; 12.01
//     (profit) or 57.10 (loss); 57.00 = 57.10 + 57.20; 12.50 = 12.48 + 12.49; 12.52 = 12.50 - 57.50.
//   ge-2025-guide-independants p. 13 to 18 (the same sums; 51.60 half the business wealth
//     invested, at most 533'042), p. 22 (32.10, 32.11 deducted in full), p. 23 (32.40: 7'258 with a
//     pension fund, without one 20 % of the net profit less the AVS contributions, at most 36'288;
//     32.90 IFD two earners 50 % between 8'600 and 14'100), p. 24 (32.95 ICC 1'051).
//   ch-2025-ifd-instructions-personnes-physiques and ch-2026-ifd-instructions-personnes-physiques
//     p. 7 (3a: the income of all activities; no deduction when they make a loss in all).
//   ge-2025-icc-tariff-pdf p. 2 (income: 667.50 cumulated at 26'962, then 10.00 %; 2'565.15 at
//     43'815, then 12.80 %; 3'140.40 at 48'309, then 13.20 %), p. 5 (wealth: 1.49 per mille up to
//     118'398, supplementary tax 0 there), p. 4 and 6 (+ 47.5 %, - 12 % on income, + 1 % home care).
//   ch-2025-ifd-frais-professionnels-progression p. 3 and ch-2026-ifd-progression-deductions p. 4
//     (federal scales: single 0.77 per 100 from 15'200; 612.00 at 58'000, then 2.97 per 100;
//     married 395.00 at 61'300, then 3.00 per 100; the same in 2025 and 2026 at these incomes), p. 2
//     (insurance 1'800 single, 3'700 couple; couple deduction 2'800).
//   Communes (ge-2025-communal-centimes-pdf; ge-2026-communal-centimes-arca and
//     ge-2026-part-privilegiee-communique p. 11): Carouge PP 27 %, CA 40 (2025 and 2026); Vernier
//     2025 PP 80 %, 2026 PP 75 %, CA 50; Onex PP 80 %, CA 50.5.
// Rounding as in the official tariff: each line to 5 centimes, halves up; shares to the franc.
import { Ledger, type FactStatus, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  engineInputFromFacts,
  KEYS_2026,
  type EngineInput,
  type Item,
  type TaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const items = (list: readonly Item[]) =>
  list.map((i) => `${i.code} ${i.person} ${(i.amount / 100).toFixed(2)}`).sort();
const lines = (rows: [string, string, number][]) =>
  rows.map(([code, person, amount]) => `${code} ${person} ${amount.toFixed(2)}`).sort();

interface Expected {
  icc: [string, string, number][];
  ifd: [string, string, number][];
  wealth: [string, string, number][];
  sheet: { icc: [string, number][]; ifd: [string, number][]; wealth: [string, number][] };
  taxable: number;
  rate: number;
  cantonalIncome: number;
  communalIncome: number;
  taxableWealth: number;
  cantonalWealth: number;
  communalWealth: number;
  iccTotal: number;
  ifdTaxable: number;
  ifdTax: number;
}

function check(r: TaxResult, e: Expected) {
  const icc = r.icc!;
  const ifd = r.ifd!;
  expect(items(icc.items)).toEqual(lines(e.icc));
  expect(items(ifd.items)).toEqual(lines(e.ifd));
  expect(items(icc.wealth.items)).toEqual(lines(e.wealth));
  const sheet = r.business![0]!;
  const codes = (list: readonly Item[]) =>
    list.map((i) => [i.code, i.amount / 100] as [string, number]);
  expect(codes(sheet.icc)).toEqual(e.sheet.icc);
  expect(codes(sheet.ifd)).toEqual(e.sheet.ifd);
  expect(codes(sheet.wealth)).toEqual(e.sheet.wealth);
  expect(icc.taxableIncome.amount).toBe(chf(e.taxable));
  expect(icc.rateIncome.amount).toBe(chf(e.rate));
  expect(icc.taxes.incomeCantonal.amount).toBe(chf(e.cantonalIncome));
  expect(icc.taxes.communalIncomeTotal.amount).toBe(chf(e.communalIncome));
  expect(icc.wealth.taxableWealth.amount).toBe(chf(e.taxableWealth));
  expect(icc.taxes.wealthCantonal.amount).toBe(chf(e.cantonalWealth));
  expect(icc.taxes.communalWealthTotal.amount).toBe(chf(e.communalWealth));
  expect(icc.taxes.total.amount).toBe(chf(e.iccTotal));
  expect(ifd.taxableIncome.amount).toBe(chf(e.ifdTaxable));
  expect(ifd.tax.amount).toBe(chf(e.ifdTax));
  expect(r.total).toBe(chf(e.iccTotal) + chf(e.ifdTax));
  expect(r.unsupported).toEqual([]);
}

function both(
  name: string,
  input: (year: 2025 | 2026) => EngineInput,
  expected: Record<2025 | 2026, Expected>,
) {
  describe(name, () => {
    it('2025', () => {
      const r = computeReturn(input(2025));
      check(r, expected[2025]);
      expect(r.estimates).toEqual([]);
    });
    it('2026: Geneva values flagged as estimates, federal values official', () => {
      const r = computeReturn(input(2026));
      check(r, expected[2026]);
      expect(r.estimates.map((e) => e.id)).toEqual(['ge-2026-unpublished']);
      expect(r.ifd!.tax.estimates).toBeUndefined();
    });
  });
}

// S1. Léa Martin, single, Carouge: a graphic design studio in her own name, no pension fund.
// Accounts: 12.08 120'000, 12.16 500, 12.21 8'000, 12.23 3'000, 12.42 14'500: 12.17 120'500,
// 12.45 25'500, 12.46 = 12.01 95'000. AVS 32.10 9'000. Balance: 12.48 230'000, 12.49 20'000: 12.50
// 250'000; 57.50 10'000; 12.52 240'000; 51.60 = 50 % = 120'000 (under 533'042). 3a paid 18'000,
// limit 20 % x (95'000 - 9'000 = 86'000) = 17'200: 32.40 -17'200. Health premiums 6'000.
// ICC: 95'000 - 9'000 - 17'200 - 6'000 = 62'800. Base 3'140.40 + 14'491 x 13.20 % = 1'912.812 ->
// 1'912.80: 5'053.20. Centimes 2'400.27 -> 2'400.25; reduction 12 % x 7'453.45 = 894.414 ->
// 894.40; home care 50.532 -> 50.55; cantonal income 6'609.60. Communal (PP 27 %): 1'364.364 ->
// 1'364.35 x 40 % = 545.74 -> 545.75; rest 3'688.85 x 40 % = 1'475.54 -> 1'475.55: 2'021.30.
// Wealth: 250'000 - 10'000 - 120'000 = 120'000, less 87'632: 32'368. Base 32'368 x 1.49 per mille
// = 48.228 -> 48.25; centimes 22.919 -> 22.90; home care 0.4825 -> 0.50; supplementary 0: 71.65.
// Communal: 13.0275 -> 13.05 x 40 % = 5.22 -> 5.20; rest 35.20 x 40 % = 14.08 -> 14.10: 19.30.
// ICC 6'609.60 + 71.65 + 2'021.30 + 19.30 + 25 = 8'746.85.
// IFD: 52.00 min(6'000, 1'800). 95'000 - 9'000 - 17'200 - 1'800 = 67'000: 612.00 + 90 x 2.97 =
// 879.30.
const lea = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'carouge',
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      pillar3a: amt(18_000),
      business: {
        turnover: amt(120_000),
        otherIncome: amt(500),
        costsGoods: amt(8_000),
        depreciation: amt(3_000),
        costsOther: amt(14_500),
        currentAssets: amt(230_000),
        fixedAssets: amt(20_000),
        liabilities: amt(10_000),
        avsYear: amt(9_000),
      },
    },
  ],
  household: { healthPremiums: amt(6_000) },
});
const S1: Expected = {
  icc: [
    ['12.01', 'p1', 95_000],
    ['32.10', 'p1', -9_000],
    ['32.40', 'p1', -17_200],
    ['52.21', 'household', -6_000],
  ],
  ifd: [
    ['12.01', 'p1', 95_000],
    ['32.10', 'p1', -9_000],
    ['32.40', 'p1', -17_200],
    ['52.00', 'household', -1_800],
  ],
  wealth: [
    ['12.50', 'p1', 250_000],
    ['57.50', 'p1', -10_000],
    ['51.60', 'p1', -120_000],
  ],
  sheet: {
    icc: [
      ['12.17', 120_500],
      ['12.45', 25_500],
      ['12.46', 95_000],
      ['12.01', 95_000],
      ['32.00', -26_200],
    ],
    ifd: [
      ['12.17', 120_500],
      ['12.45', 25_500],
      ['12.46', 95_000],
      ['12.01', 95_000],
      ['32.00', -26_200],
    ],
    wealth: [
      ['12.50', 250_000],
      ['57.50', -10_000],
      ['12.52', 240_000],
      ['51.60', -120_000],
    ],
  },
  taxable: 62_800,
  rate: 62_800,
  cantonalIncome: 6_609.6,
  communalIncome: 2_021.3,
  taxableWealth: 32_368,
  cantonalWealth: 71.65,
  communalWealth: 19.3,
  iccTotal: 8_746.85,
  ifdTaxable: 67_000,
  ifdTax: 879.3,
};
both('S1 single self-employed, Carouge', lea, { 2025: S1, 2026: S1 });

// S2. Marc and Sofia Dupuis, married, Vernier. Marc is salaried (90'000, AVS 5'800, pension fund
// 6'500, 3a 7'258); Sofia translates in her own name, without a pension fund: 12.08 48'000, 12.21
// 2'000, 12.42 6'000: 12.01 40'000; AVS 32.10 4'000; 3a 6'000, under her limit 20 % x 36'000 =
// 7'200. Balance 12.48 15'000, 57.50 3'000: 12.52 12'000, 51.60 6'000. Health premiums 9'000.
// ICC: Marc's flat professional deduction 3 % x 77'700 = 2'331, at most 1'812. Two earners: Marc
// 90'000 - 5'800 - 6'500 - 7'258 - 1'812 = 68'630, Sofia 40'000 - 4'000 - 6'000 = 30'000, lower:
// 1'051 on annexe B (32.95, she has no salary). Taxable 130'000 - 41'421 = 88'579, rate 50 %:
// 44'290 (to the franc). Scale at 44'290: 2'565.15 + 475 x 12.80 % = 60.80: 2'625.95; base 88'579
// x 2'625.95 / 44'290 = 5'251.84 -> 5'251.85. Centimes 2'494.629 -> 2'494.65; reduction 12 % x
// 7'746.50 = 929.58 -> 929.60; home care 52.5185 -> 52.50; cantonal income 6'869.40. Communal
// 2025 (PP 80 %): 4'201.48 -> 4'201.50 x 50 % = 2'100.75; rest 1'050.35 x 50 % = 525.175 -> 525.20:
// 2'625.95. 2026 (PP 75 %): 3'938.8875 -> 3'938.90 x 50 % = 1'969.45; rest 1'312.95 x 50 % =
// 656.475 -> 656.50: 2'625.95. Wealth 15'000 - 3'000 - 6'000 = 6'000, under 175'264: 0.
// ICC 6'869.40 + 2'625.95 + 25 = 9'520.35 (both years).
// IFD: Marc's 31.20 3 % x 77'700 = 2'331; two earners: Sofia 30'000 is the lower, 50 % = 15'000, at
// most 14'100 (32.90); 52.00 min(9'000, 3'700); 59.20 2'800. Taxable 130'000 - 52'489 = 77'511,
// at 77'500: 395.00 + 162 x 3.00 = 881.00.
const dupuis = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'vernier',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        {
          gross: amt(90_000),
          socialContributions: amt(5_800),
          pensionFund: amt(6_500),
        },
      ],
      pillar3a: amt(7_258),
    },
    {
      id: 'p2',
      pillar3a: amt(6_000),
      business: {
        turnover: amt(48_000),
        costsGoods: amt(2_000),
        costsOther: amt(6_000),
        currentAssets: amt(15_000),
        liabilities: amt(3_000),
        avsYear: amt(4_000),
      },
    },
  ],
  household: { healthPremiums: amt(9_000) },
});
const S2 = (communal: number): Expected => ({
  icc: [
    ['11.10', 'p1', 90_000],
    ['31.10', 'p1', -5_800],
    ['31.12', 'p1', -6_500],
    ['31.40', 'p1', -7_258],
    ['31.50', 'p1', -1_812],
    ['12.01', 'p2', 40_000],
    ['32.10', 'p2', -4_000],
    ['32.40', 'p2', -6_000],
    ['32.95', 'p2', -1_051],
    ['52.21', 'household', -9_000],
  ],
  ifd: [
    ['11.10', 'p1', 90_000],
    ['31.10', 'p1', -5_800],
    ['31.12', 'p1', -6_500],
    ['31.40', 'p1', -7_258],
    ['31.20', 'p1', -2_331],
    ['12.01', 'p2', 40_000],
    ['32.10', 'p2', -4_000],
    ['32.40', 'p2', -6_000],
    ['32.90', 'p2', -14_100],
    ['52.00', 'household', -3_700],
    ['59.20', 'household', -2_800],
  ],
  wealth: [
    ['12.50', 'p2', 15_000],
    ['57.50', 'p2', -3_000],
    ['51.60', 'p2', -6_000],
  ],
  sheet: {
    icc: [
      ['12.17', 48_000],
      ['12.45', 8_000],
      ['12.46', 40_000],
      ['12.01', 40_000],
      ['32.00', -11_051],
    ],
    ifd: [
      ['12.17', 48_000],
      ['12.45', 8_000],
      ['12.46', 40_000],
      ['12.01', 40_000],
      ['32.00', -24_100],
    ],
    wealth: [
      ['12.50', 15_000],
      ['57.50', -3_000],
      ['12.52', 12_000],
      ['51.60', -6_000],
    ],
  },
  taxable: 88_579,
  rate: 44_290,
  cantonalIncome: 6_869.4,
  communalIncome: communal,
  taxableWealth: 0,
  cantonalWealth: 0,
  communalWealth: 0,
  iccTotal: 9_520.35,
  ifdTaxable: 77_511,
  ifdTax: 881,
});
both('S2 couple, one salaried and one self-employed, Vernier', dupuis, {
  2025: S2(2_625.95),
  2026: S2(2_625.95),
});

// S3. Noé Favre, single, Onex: a part-time salary (50'000, AVS 3'200, pension fund 2'500, 3a
// 3'000) and a small repair business in his own name that made a loss: 12.08 20'000, 12.42 26'000:
// 12.46 -6'000, 57.10 -6'000; AVS 32.10 800; losses of earlier years not deducted yet 2'000 in each
// tax (57.20); 57.00 8'000. Balance 12.48 4'000, 57.50 1'000: 12.52 3'000, 51.60 1'500. Health
// premiums 4'000. 3a: with a pension fund (his salary's), the activities together earn 50'000 -
// 3'200 - 6'000 - 800 = 40'000 > 0: 3'000 counts (under 7'258), on A1 (31.40).
// ICC: flat 3 % x 44'300 = 1'329 (between 640 and 1'812). Taxable 50'000 - 3'200 - 2'500 - 3'000 -
// 1'329 - 6'000 - 2'000 - 800 - 4'000 = 27'171. Base 667.50 + 209 x 10 % = 20.90: 688.40.
// Centimes 326.99 -> 327.00; reduction 12 % x 1'015.40 = 121.848 -> 121.85; home care 6.884 ->
// 6.90; cantonal income 900.45. Communal (PP 80 %): 550.72 -> 550.70 x 50.5 % = 278.1035 -> 278.10;
// rest 137.70 x 50.5 % = 69.5385 -> 69.55: 347.65. Wealth 1'500, under 87'632: 0.
// ICC 900.45 + 347.65 + 25 = 1'273.10.
// IFD: 31.20 3 % x 44'300 = 1'329, at least 2'000; 52.00 min(4'000, 1'800). Taxable 50'000 -
// 21'300 = 28'700: 135 x 0.77 = 103.95.
const favre = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'onex',
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: amt(50_000), socialContributions: amt(3_200), pensionFund: amt(2_500) },
      ],
      pillar3a: amt(3_000),
      business: {
        turnover: amt(20_000),
        costsOther: amt(26_000),
        currentAssets: amt(4_000),
        liabilities: amt(1_000),
        avsYear: amt(800),
        priorLosses: { cantonal: amt(2_000), federal: amt(2_000) },
      },
    },
  ],
  household: { healthPremiums: amt(4_000) },
});
const S3: Expected = {
  icc: [
    ['11.10', 'p1', 50_000],
    ['31.10', 'p1', -3_200],
    ['31.12', 'p1', -2_500],
    ['31.40', 'p1', -3_000],
    ['31.50', 'p1', -1_329],
    ['57.10', 'p1', -6_000],
    ['57.20', 'p1', -2_000],
    ['32.10', 'p1', -800],
    ['52.21', 'household', -4_000],
  ],
  ifd: [
    ['11.10', 'p1', 50_000],
    ['31.10', 'p1', -3_200],
    ['31.12', 'p1', -2_500],
    ['31.40', 'p1', -3_000],
    ['31.20', 'p1', -2_000],
    ['57.10', 'p1', -6_000],
    ['57.20', 'p1', -2_000],
    ['32.10', 'p1', -800],
    ['52.00', 'household', -1_800],
  ],
  wealth: [
    ['12.50', 'p1', 4_000],
    ['57.50', 'p1', -1_000],
    ['51.60', 'p1', -1_500],
  ],
  sheet: {
    icc: [
      ['12.17', 20_000],
      ['12.45', 26_000],
      ['12.46', -6_000],
      ['57.10', -6_000],
      ['57.20', -2_000],
      ['57.00', -8_000],
      ['32.00', -800],
    ],
    ifd: [
      ['12.17', 20_000],
      ['12.45', 26_000],
      ['12.46', -6_000],
      ['57.10', -6_000],
      ['57.20', -2_000],
      ['57.00', -8_000],
      ['32.00', -800],
    ],
    wealth: [
      ['12.50', 4_000],
      ['57.50', -1_000],
      ['12.52', 3_000],
      ['51.60', -1_500],
    ],
  },
  taxable: 27_171,
  rate: 27_171,
  cantonalIncome: 900.45,
  communalIncome: 347.65,
  taxableWealth: 0,
  cantonalWealth: 0,
  communalWealth: 0,
  iccTotal: 1_273.1,
  ifdTaxable: 28_700,
  ifdTax: 103.95,
};
both('S3 self-employed with a loss and earlier losses, also salaried, Onex', favre, {
  2025: S3,
  2026: S3,
});

describe('the rules of the simple case', () => {
  it('cites the guide for the self-employed, the law and the federal instructions of the year', () => {
    for (const year of [2025, 2026] as const) {
      const r = computeReturn(lea(year));
      const at = (code: string) => r.icc!.items.find((i) => i.code === code)!.sources.join(' | ');
      expect(at('12.01')).toMatch(/ge-2025-guide-independants p\. 16/);
      expect(at('12.01')).toMatch(/ch-na-law-lifd art\. 18 al\. 1/);
      expect(at('32.10')).toMatch(/ge-2025-guide-independants p\. 22/);
      expect(at('32.10')).toMatch(/ch-na-law-lifd art\. 33 al\. 1 let\. d and f/);
      expect(at('32.40')).toMatch(
        new RegExp(`ch-${year}-ifd-instructions-personnes-physiques p\\. 7`),
      );
      const wealth = r.icc!.wealth.items.find((i) => i.code === '51.60')!;
      expect(wealth.sources.join(' ')).toMatch(/ge-na-law-lipp art\. 58 al\. 2/);
      expect(r.unverifiedRules.map((u) => u.en).join(' ')).toMatch(/51\.60.*equity/);
      expect(r.limits.find((l) => l.code === '32.40')).toMatchObject({
        kind: 'cap',
        given: chf(18_000),
        limit: chf(17_200),
        counted: chf(17_200),
      });
      expect(r.limits.find((l) => l.code === '51.60')).toMatchObject({
        given: chf(120_000),
        limit: chf(533_042),
        counted: chf(120_000),
        ...(year === 2026 ? { estimate: true } : {}),
      });
    }
    const losses = computeReturn(favre(2026)).icc!.items.find((i) => i.code === '57.20')!;
    expect(losses.sources.join(' ')).toMatch(/ch-2026-ifd-instructions-personnes-physiques p\. 3/);
    expect(losses.how.en).toMatch(/2019 to 2025/);
    const losses25 = computeReturn(favre(2025)).ifd!.items.find((i) => i.code === '57.20')!;
    expect(losses25.how.en).toMatch(/2018 to 2024/);
  });

  it('caps the deduction on business wealth at the indexed maximum', () => {
    const big = lea(2025);
    const p = big.people[0]!;
    const r = computeReturn({
      ...big,
      people: [{ ...p, business: { ...p.business!, currentAssets: amt(1_500_000) } }],
    });
    // Equity 1'510'000, half 755'000, at most 533'042.
    expect(r.icc!.wealth.items.find((i) => i.code === '51.60')!.amount).toBe(chf(-533_042));
    expect(r.limits.find((l) => l.code === '51.60')).toMatchObject({
      given: chf(755_000),
      counted: chf(533_042),
    });
  });

  it('deducts no 3a when the activities make a loss in all, and says why', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 'onex',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          pillar3a: amt(5_000),
          business: { turnover: amt(10_000), costsOther: amt(30_000), avsYear: amt(500) },
        },
      ],
    });
    expect(r.icc!.items.some((i) => i.code === '32.40')).toBe(false);
    expect(r.notCounted.map((n) => n.en).join(' ')).toMatch(/make a loss in all/);
    expect(r.limits.find((l) => l.code === '32.40')).toMatchObject({ limit: 0, counted: 0 });
    // The loss is bigger than the income: no income tax, and the assessment says what carries on.
    expect(r.icc!.taxableIncome.amount).toBe(0);
    expect(r.ifd!.taxableIncome.amount).toBe(0);
    expect(r.icc!.subtotal9220.amount).toBe(chf(-20_500));
    expect(r.notCounted.map((n) => n.en).join(' ')).toMatch(/carry to the next seven years/);
    expect(r.icc!.taxes.incomeCantonal.amount).toBe(0);
    expect(r.ifd!.tax.amount).toBe(0);
  });

  it('counts nothing for a business whose accounts are not in yet, and says so', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 'onex',
      civilStatus: 'single',
      people: [{ id: 'p1', business: {} }],
    });
    expect(r.icc!.items).toEqual([]);
    expect(r.notCounted.map((n) => n.en).join(' ')).toMatch(/accounts .* not in yet/);
    expect(r.notCounted.map((n) => n.en).join(' ')).toMatch(/AVS.* not in yet/);
    expect(r.business![0]!.icc).toEqual([]);
  });

  it('fails closed beyond the simple case: no tax at all, and why', () => {
    const why = { en: 'Self-employment: a partnership.', fr: 'Activité indépendante : société.' };
    const r = computeReturn({ ...lea(2026), unsupported: [why] });
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toContainEqual(why);
    expect(r.business).toBeUndefined();
  });

  it('refuses a business and a profit given as one figure for the same person', () => {
    const p = lea(2026).people[0]!;
    expect(() =>
      computeReturn({ ...lea(2026), people: [{ ...p, selfEmploymentProfit: amt(1) }] }),
    ).toThrow(/not both/);
  });
});

describe('from the ledger: answers and the business’s documents', () => {
  const doc = (id: string, kind: VaultDocument['kind'], taxYear = 2026): VaultDocument => ({
    id,
    sha256: id,
    filename: `${id}.pdf`,
    path: `documents/${id}.pdf`,
    bytes: 1,
    addedAt: '2027-01-10T00:00:00.000Z',
    kind,
    person: 'p1',
    taxYear,
    parse: { method: 'claude', ok: true, warnings: [] },
  });
  type Answer = string | boolean | string[] | number;
  function ledgerOf(answers: Record<string, Answer> = {}, skip: string[] = []) {
    const l = new Ledger(2026, KEYS_2026);
    const user = { method: 'user' as const, via: 'chat' as const };
    const put = (
      key: string,
      person: 'p1' | 'household',
      value: Answer,
      status: FactStatus = 'stated',
      instance?: string,
    ) =>
      l.append({
        key,
        person,
        value,
        status,
        source: instance ? { method: 'claude', docId: instance, page: 1 } : user,
        ...(instance ? { instance } : {}),
      });
    put('profile.civil_status', 'household', 'single');
    put('profile.commune', 'household', 'carouge');
    put('profile.income_sources', 'p1', ['self_employment']);
    const base: Record<string, Answer> = {
      'profile.business_form': 'sole_proprietor',
      'profile.business_year': 'calendar',
      'profile.business_place': 'home_commune',
      'profile.business_special': [],
      'profile.business_losses': false,
      ...answers,
    };
    for (const [k, v] of Object.entries(base)) if (!skip.includes(k)) put(k, 'p1', v);
    // The accounts, read by Claude and confirmed; the AVS statement still to confirm.
    put('business.turnover', 'p1', chf(120_000), 'stated', 'd_accounts');
    put('business.other_income', 'p1', chf(500), 'stated', 'd_accounts');
    put('business.costs_goods', 'p1', chf(8_000), 'stated', 'd_accounts');
    put('business.depreciation', 'p1', chf(3_000), 'stated', 'd_accounts');
    put('business.costs_other', 'p1', chf(14_500), 'stated', 'd_accounts');
    put('business.current_assets', 'p1', chf(230_000), 'stated', 'd_accounts');
    put('business.fixed_assets', 'p1', chf(20_000), 'stated', 'd_accounts');
    put('business.liabilities', 'p1', chf(10_000), 'stated', 'd_accounts');
    put('avs.contributions_year', 'p1', chf(9_000), 'extracted', 'd_avs');
    put('pillar3a.paid', 'p1', chf(18_000), 'stated', 'd_3a');
    put('health.premiums', 'household', chf(6_000), 'stated', 'd_health');
    const docs = [
      doc('d_accounts', 'business_accounts'),
      doc('d_avs', 'avs_contributions'),
      doc('d_3a', 'pillar3a_attestation'),
      doc('d_health', 'health_premiums'),
    ];
    return { l, put, docs };
  }

  it('reads the business line by line, with each value’s facts and status, into S1’s figures', () => {
    const { l, docs } = ledgerOf();
    const { input, missing } = engineInputFromFacts(2026, l.view(), docs);
    expect(missing).toEqual([]);
    const b = input!.people[0]!.business!;
    expect(b.turnover).toMatchObject({ value: chf(120_000), status: 'stated' });
    expect(b.avsYear).toMatchObject({ value: chf(9_000), status: 'extracted' });
    const r = computeReturn(input!);
    expect(r.icc!.taxes.total.amount).toBe(chf(8_746.85));
    expect(r.ifd!.tax.amount).toBe(chf(879.3));
    // The AVS contributions still need the user's OK: so do the lines resting on them.
    expect(r.icc!.items.find((i) => i.code === '32.10')!.needsOk).toBe(true);
    expect(r.needsOk).toBeGreaterThan(0);
  });

  it('waits for the questions about the business before computing anything', () => {
    const { l, docs } = ledgerOf({}, ['profile.business_year']);
    const { input, missing } = engineInputFromFacts(2026, l.view(), docs);
    expect(input).toBeNull();
    expect(missing.map((m) => m.en)).toContain('the questions about your self-employment');
  });

  it('asks both amounts of earlier losses, then deducts each in its tax', () => {
    const { l, put, docs } = ledgerOf({ 'profile.business_losses': true });
    expect(engineInputFromFacts(2026, l.view(), docs).input).toBeNull();
    put('business.losses_icc', 'p1', chf(3_000));
    put('business.losses_ifd', 'p1', chf(2_500));
    const r = computeReturn(engineInputFromFacts(2026, l.view(), docs).input!);
    expect(r.icc!.items.find((i) => i.code === '57.20')!.amount).toBe(chf(-3_000));
    expect(r.ifd!.items.find((i) => i.code === '57.20')!.amount).toBe(chf(-2_500));
  });

  it('fails closed beyond the simple case, each reason in plain words', () => {
    const cases: [Record<string, Answer>, RegExp][] = [
      [{ 'profile.business_form': 'partnership' }, /a partnership \(société de personnes\)/],
      [{ 'profile.business_year': 'stopped' }, /stopping a business/],
      [{ 'profile.business_year': 'two_closings' }, /two business years/],
      [{ 'profile.business_year': 'no_closing' }, /closes next year/],
      [{ 'profile.business_place': 'other_commune' }, /another commune than your home/],
      [{ 'profile.business_place': 'outside_geneva' }, /a business outside Geneva/],
      [{ 'profile.business_special': ['vat'] }, /VAT \(TVA\)/],
      [{ 'profile.business_special': ['real_estate'] }, /business real estate/],
      [{ 'profile.business_special': ['reserves'] }, /hidden reserves/],
      [{ 'profile.business_special': ['transfer'] }, /between business and private wealth/],
      [{ 'profile.business_special': ['method_change'] }, /change of accounting method/],
      [{ 'profile.business_special': ['own_pension'] }, /pension fund of the self-employed/],
      [{ 'profile.business_special': ['spouse_works'] }, /spouse working in the business/],
      [{ 'profile.business_special': ['private_costs'] }, /private shares/],
      [{ 'profile.business_special': ['avs_provision'] }, /AVS provision or refund/],
      [{ 'profile.business_special': ['participations'] }, /patent box/],
      [{ 'profile.business_special': ['several'] }, /more than one business/],
      [{ 'profile.taxed_at_source': true }, /taxed at source/],
    ];
    for (const [answers, reason] of cases) {
      const { l, docs } = ledgerOf(answers);
      const r = computeReturn(engineInputFromFacts(2026, l.view(), docs).input!);
      const why = r.unsupported.map((u) => u.en).join(' ');
      expect(r.icc, JSON.stringify(answers)).toBeNull();
      expect(r.ifd, JSON.stringify(answers)).toBeNull();
      expect(why, JSON.stringify(answers)).toMatch(reason);
      expect(why).toMatch(/no tax is computed/);
    }
  });

  it('takes a second set of accounts for a second business: not supported', () => {
    const { l, put, docs } = ledgerOf();
    put('business.turnover', 'p1', chf(1_000), 'stated', 'd_other');
    const all = [...docs, doc('d_other', 'business_accounts')];
    const r = computeReturn(engineInputFromFacts(2026, l.view(), all).input!);
    expect(r.icc).toBeNull();
    expect(r.unsupported.map((u) => u.en).join(' ')).toMatch(/more than one business/);
  });

  it('leaves out the accounts of another year', () => {
    const { l, docs } = ledgerOf();
    const old = docs.map((d) => (d.id === 'd_accounts' ? { ...d, taxYear: 2025 } : d));
    const { input } = engineInputFromFacts(2026, l.view(), old);
    expect(input!.people[0]!.business!.turnover).toBeUndefined();
  });

  it('changes nothing for a household without self-employment', () => {
    const l = new Ledger(2026, KEYS_2026);
    const user = { method: 'user' as const, via: 'chat' as const };
    l.append({
      key: 'profile.civil_status',
      person: 'household',
      value: 'single',
      status: 'stated',
      source: user,
    });
    l.append({
      key: 'profile.commune',
      person: 'household',
      value: 'onex',
      status: 'stated',
      source: user,
    });
    l.append({
      key: 'profile.income_sources',
      person: 'p1',
      value: ['salary'],
      status: 'stated',
      source: user,
    });
    const { input } = engineInputFromFacts(2026, l.view(), []);
    expect(input!.people[0]!.business).toBeUndefined();
    expect(input!.unsupported).toBeUndefined();
  });
});
