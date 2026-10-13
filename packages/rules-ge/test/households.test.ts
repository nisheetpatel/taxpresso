// Synthetic Geneva households (SPEC.md section 13), computed for tax years 2025 and 2026. Every
// expected value below was derived by hand, step by step, from the official documents; the steps
// are in the comment above each household. Fake people, fake figures.
//
// Documents and the values read in them (2025):
//   ge-2025-icc-tariff-pdf: income scale p. 2 (cumulative tax 2'012.25 at 39'320, 2'565.15 at
//     43'815, 3'140.40 at 48'309; rates 7.30 % from 18'650, 8.20 % from 22'470, 9.10 % from
//     24'717, 12.30 % from 39'321, 12.80 % from 43'816, 13.20 % from 48'310); splitting 50 % and
//     55.56 % (p. 2 to 4); wealth scales p. 5 (1'635.05 and 120.80 at 710'387, then 2.98 and
//     0.4463 per mille); surcharges p. 4 and 6: + 47.5 %, - 12 % (income), + 1 % home care.
//   ge-2025-guide-declaration-pp p. 11, 15, 16, 18 to 21, 29, 30: flat professional expenses 3 %,
//     ICC 640 to 1'812, IFD 2'000 to 4'000; commuting ICC 534, IFD 3'300; two earners ICC 1'051,
//     IFD 50 % between 8'600 and 14'100; health premiums 17'122 per adult, 3'965 per child;
//     childcare ICC 26'320, IFD 25'800; family charge 13'660 (10'508 with childcare, half 6'830);
//     IFD child 6'800 (half 3'400); IFD couple 2'800; wealth deduction 175'264 for a couple;
//     medical costs above 0.5 % (ICC) and 5 % (IFD) of 92.20; donations up to 20 % of 92.40.
//   ch-2025-ifd-frais-professionnels-progression p. 2 and 3: IFD insurance 1'800 single,
//     3'700 couple, + 700 per child, 5'550 for a couple paying into neither 2nd pillar nor 3a; the
//     scales; 263 per child.
//   ge-2025-communal-centimes-pdf: PP and CA 2025. ge-2026-part-privilegiee-communique p. 11 and
//     ge-2026-communal-centimes-arca: PP and CA 2026. ge-na-law-lcp art. 375: taxe personnelle 25.
//   2026: the federal values from ch-2026-ifd-progression-deductions; the Geneva values are the
//     2025 ones, flagged as estimates until the 2026 guide (January 2027).
//
// Rounding: each bracket and each tax line to 5 centimes (half up); deductions computed as a share
// to the franc; the federal tax at the income rounded down to CHF 100, rounded down to 5 centimes.
import { describe, expect, it } from 'vitest';
import { computeReturn, type EngineInput, type Item, type TaxResult } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const items = (list: readonly Item[]) =>
  list.map((i) => `${i.code} ${i.person} ${(i.amount / 100).toFixed(2)}`).sort();
const lines = (rows: [string, string, number][]) =>
  rows.map(([code, person, amount]) => `${code} ${person} ${amount.toFixed(2)}`).sort();

interface Expected {
  icc: [string, string, number][];
  ifd: [string, string, number][];
  taxable: number;
  rate: number;
  base: number;
  cc: number;
  reduction: number;
  homeCare: number;
  cantonal: number;
  communal: { privileged: number; rest: number[] };
  personal: number;
  iccTotal: number;
  wealth?: {
    taxable: number;
    base: number;
    cc: number;
    homeCare: number;
    supplementary: number;
    communal: number;
  };
  ifdTaxable: number;
  ifdScaleTax: number;
  ifdTax: number;
}

function check(r: TaxResult, e: Expected) {
  const icc = r.icc!;
  const ifd = r.ifd!;
  expect(items(icc.items)).toEqual(lines(e.icc));
  expect(icc.taxableIncome.amount).toBe(chf(e.taxable));
  expect(icc.rateIncome.amount).toBe(chf(e.rate));
  const x = icc.taxes;
  expect(x.incomeBase.amount).toBe(chf(e.base));
  expect(x.incomeCantonalCentimes.amount).toBe(chf(e.cc));
  expect(x.incomeReduction12.amount).toBe(chf(-e.reduction));
  expect(x.incomeHomeCare.amount).toBe(chf(e.homeCare));
  expect(x.incomeCantonal.amount).toBe(chf(e.cantonal));
  expect(x.communalIncome.privileged.tax.amount).toBe(chf(e.communal.privileged));
  expect(x.communalIncome.rest.map((s) => s.tax.amount)).toEqual(e.communal.rest.map(chf));
  expect(x.personalTax.amount).toBe(chf(e.personal));
  if (e.wealth) {
    expect(icc.wealth.taxableWealth.amount).toBe(chf(e.wealth.taxable));
    expect(x.wealthBase.amount).toBe(chf(e.wealth.base));
    expect(x.wealthCantonalCentimes.amount).toBe(chf(e.wealth.cc));
    expect(x.wealthHomeCare.amount).toBe(chf(e.wealth.homeCare));
    expect(x.wealthSupplementary.amount).toBe(chf(e.wealth.supplementary));
    expect(x.communalWealthTotal.amount).toBe(chf(e.wealth.communal));
  } else {
    expect(x.wealthBase.amount).toBe(0);
  }
  expect(x.total.amount).toBe(chf(e.iccTotal));
  expect(items(ifd.items)).toEqual(lines(e.ifd));
  expect(ifd.taxableIncome.amount).toBe(chf(e.ifdTaxable));
  expect(ifd.scaleTax.amount).toBe(chf(e.ifdScaleTax));
  expect(ifd.tax.amount).toBe(chf(e.ifdTax));
  expect(r.total).toBe(chf(e.iccTotal) + chf(e.ifdTax));
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
      expect(r.icc!.taxes.total.estimates).toContain('ge-2026-unpublished');
      expect(r.ifd!.tax.estimates).toBeUndefined();
    });
  });
}

const job = (gross: number, social: number, lpp: number) => ({
  gross: { value: chf(gross) },
  socialContributions: { value: chf(social) },
  pensionFund: { value: chf(lpp) },
});

// H1. Single, City of Geneva, no children.
// ICC items: 11.10 85'000; 31.10 -5'500; 31.12 -4'500; 31.40 3a -7'258 (with pension fund, limit
// 7'258); 31.50 = 3 % x (85'000 - 5'500 - 4'500 = 75'000) = 2'250, above the 1'812 maximum:
// -1'812; 14.00 income of the bank account 150; 52.21 premiums 5'400, under 17'122: -5'400.
// Taxable 85'150 - 5'500 - 4'500 - 7'258 - 1'812 - 5'400 = 60'680 (no splitting, rate 60'680).
// Base: 3'140.40 + (60'680 - 48'309) x 13.20 % = 12'371 x 0.132 = 1'632.972 -> 1'632.95:
// 4'773.35. Centimes 47.5 %: 2'267.34125 -> 2'267.35. Reduction 12 % of (4'773.35 + 2'267.35 =
// 7'040.70) = 844.884 -> 844.90. Home care 1 %: 47.7335 -> 47.75. Cantonal 4'773.35 + 2'267.35 -
// 844.90 + 47.75 = 6'243.55.
// Communal 2025 (Genève PP 28 %, CA 45.49): privileged base 28 % x 4'773.35 = 1'336.538 ->
// 1'336.55, x 45.49 % = 607.997 -> 608.00; rest 3'436.80 x 45.49 % = 1'563.40 -> 1'563.40.
// Communal 2026 (PP 29 %, CA 45.49): 1'384.2715 -> 1'384.25 x 45.49 % = 629.695 -> 629.70; rest
// 3'389.10 x 45.49 % = 1'541.70. Wealth 30'000 under the 87'632 deduction: taxable 0.
// ICC 6'243.55 + 2'171.40 + 25 = 8'439.95 (both years).
// IFD: 31.20 = 3 % x 75'000 = 2'250 (between 2'000 and 4'000); 52.00 min(5'400, 1'800) = 1'800.
// Taxable 85'150 - 5'500 - 4'500 - 7'258 - 2'250 - 1'800 = 63'842, scale at 63'800: 612.00 + 58 x
// 2.97 = 784.26 -> 784.25 (2025 and 2026 single scales are the same below 76'100).
both(
  'H1 single, Genève',
  (taxYear) => ({
    taxYear,
    commune: 'geneve',
    civilStatus: 'single',
    people: [
      { id: 'p1', employments: [job(85_000, 5_500, 4_500)], pillar3a: { value: chf(7_258) } },
    ],
    household: { healthPremiums: { value: chf(5_400) } },
    movable: [{ owner: 'p1', value: { value: chf(30_000) }, income: { value: chf(150) } }],
  }),
  (() => {
    const base = {
      icc: [
        ['11.10', 'p1', 85_000],
        ['31.10', 'p1', -5_500],
        ['31.12', 'p1', -4_500],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['14.00', 'p1', 150],
        ['52.21', 'household', -5_400],
      ] as [string, string, number][],
      ifd: [
        ['11.10', 'p1', 85_000],
        ['31.10', 'p1', -5_500],
        ['31.12', 'p1', -4_500],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_250],
        ['14.00', 'p1', 150],
        ['52.00', 'household', -1_800],
      ] as [string, string, number][],
      taxable: 60_680,
      rate: 60_680,
      base: 4_773.35,
      cc: 2_267.35,
      reduction: 844.9,
      homeCare: 47.75,
      cantonal: 6_243.55,
      personal: 25,
      iccTotal: 8_439.95,
      ifdTaxable: 63_842,
      ifdScaleTax: 784.25,
      ifdTax: 784.25,
    };
    return {
      2025: { ...base, communal: { privileged: 608.0, rest: [1_563.4] } },
      2026: { ...base, communal: { privileged: 629.7, rest: [1_541.7] } },
    };
  })(),
);

// H2. Married, one income, Vernier, no children.
// ICC: 11.10 120'000; 31.10 -7'800; 31.12 -9'000; 31.40 -7'258; 31.50 = 3 % x 103'200 = 3'096 ->
// max 1'812; 52.21 11'000 (limit 2 x 17'122). Taxable 120'000 - 7'800 - 9'000 - 7'258 - 1'812 -
// 11'000 = 83'130. Full splitting: rate 41'565; scale there 2'012.25 + (41'565 - 39'320) x 12.30 %
// = 2'245 x 0.123 = 276.135 -> 276.15: 2'288.40; base 83'130 x 2'288.40 / 41'565 = 4'576.80.
// Centimes 2'173.98 -> 2'174.00; reduction 12 % x 6'750.80 = 810.096 -> 810.10; home care 45.768
// -> 45.75; cantonal 5'986.45.
// Communal 2025 (Vernier PP 80 %, CA 50): 3'661.44 -> 3'661.45 x 50 % = 1'830.725 -> 1'830.75
// (half up); rest 915.35 x 50 % = 457.675 -> 457.70. 2026 (PP 75 %, CA 50): 3'432.60 -> 1'716.30;
// rest 1'144.20 -> 572.10. ICC 2025: 5'986.45 + 2'288.45 + 25 = 8'299.90; 2026: 8'299.85.
// IFD: 31.20 3 % x 103'200 = 3'096; 52.00 min(11'000, 3'700) = 3'700; 59.20 2'800; the spouse earns
// nothing, no two-earner deduction. Taxable 120'000 - 7'800 - 9'000 - 7'258 - 3'096 - 3'700 -
// 2'800 = 86'346, scale at 86'300 (married): 929 + 72 x 4 = 1'217.00 (same both years).
both(
  'H2 married, one income, Vernier',
  (taxYear) => ({
    taxYear,
    commune: 'vernier',
    civilStatus: 'married',
    people: [
      { id: 'p1', employments: [job(120_000, 7_800, 9_000)], pillar3a: { value: chf(7_258) } },
      { id: 'p2' },
    ],
    household: { healthPremiums: { value: chf(11_000) } },
  }),
  (() => {
    const base = {
      icc: [
        ['11.10', 'p1', 120_000],
        ['31.10', 'p1', -7_800],
        ['31.12', 'p1', -9_000],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -11_000],
      ] as [string, string, number][],
      ifd: [
        ['11.10', 'p1', 120_000],
        ['31.10', 'p1', -7_800],
        ['31.12', 'p1', -9_000],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -3_096],
        ['52.00', 'household', -3_700],
        ['59.20', 'household', -2_800],
      ] as [string, string, number][],
      taxable: 83_130,
      rate: 41_565,
      base: 4_576.8,
      cc: 2_174.0,
      reduction: 810.1,
      homeCare: 45.75,
      cantonal: 5_986.45,
      personal: 25,
      ifdTaxable: 86_346,
      ifdScaleTax: 1_217,
      ifdTax: 1_217,
    };
    return {
      2025: { ...base, communal: { privileged: 1_830.75, rest: [457.7] }, iccTotal: 8_299.9 },
      2026: { ...base, communal: { privileged: 1_716.3, rest: [572.1] }, iccTotal: 8_299.85 },
    };
  })(),
);

// H3. Married, two incomes, Carouge.
// A: 11.10 95'000; 31.10 -6'200; 31.12 -6'500; 31.40 -7'258; 31.50 3 % x 82'300 = 2'469 -> 1'812.
// B: 21.10 42'000; 41.10 -2'760; 41.12 -1'900; 41.40 -2'000; 41.50 3 % x 37'340 = 1'120.20 ->
// 1'120. Earned income A 73'230, B 34'220: B earns less, 41.95 -1'051. 52.21 -12'005.
// Taxable 137'000 - 21'770 (A) - 8'831 (B, with 41.95) - 12'005 = 94'394; rate 47'197; scale
// 2'565.15 + 3'382 x 12.80 % = 432.896 -> 432.90: 2'998.05; base x 2 = 5'996.10. Centimes
// 2'848.1475 -> 2'848.15; reduction 12 % x 8'844.25 = 1'061.31 -> 1'061.30; home care 59.961 ->
// 59.95; cantonal 7'842.90. Communal (Carouge PP 27 %, CA 40, both years): 1'618.947 -> 1'618.95
// x 40 % = 647.58 -> 647.60; rest 4'377.15 x 40 % = 1'750.86 -> 1'750.85. ICC 7'842.90 +
// 2'398.45 + 25 = 10'266.35.
// IFD: A 31.20 2'469; B 41.20 1'120 -> minimum 2'000. Earned A 72'573, B 33'340: 50 % = 16'670,
// above 14'100: 41.90 -14'100. 52.00 3'700; 59.20 2'800. Taxable 137'000 - 22'427 - 8'660 -
// 14'100 - 3'700 - 2'800 = 85'313, at 85'300: 929 + 62 x 4 = 1'177.00.
both(
  'H3 married, two incomes, Carouge',
  (taxYear) => ({
    taxYear,
    commune: 'carouge',
    civilStatus: 'married',
    people: [
      { id: 'p1', employments: [job(95_000, 6_200, 6_500)], pillar3a: { value: chf(7_258) } },
      { id: 'p2', employments: [job(42_000, 2_760, 1_900)], pillar3a: { value: chf(2_000) } },
    ],
    household: { healthPremiums: { value: chf(12_005) } },
  }),
  (() => {
    const e: Expected = {
      icc: [
        ['11.10', 'p1', 95_000],
        ['31.10', 'p1', -6_200],
        ['31.12', 'p1', -6_500],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['21.10', 'p2', 42_000],
        ['41.10', 'p2', -2_760],
        ['41.12', 'p2', -1_900],
        ['41.40', 'p2', -2_000],
        ['41.50', 'p2', -1_120],
        ['41.95', 'p2', -1_051],
        ['52.21', 'household', -12_005],
      ],
      ifd: [
        ['11.10', 'p1', 95_000],
        ['31.10', 'p1', -6_200],
        ['31.12', 'p1', -6_500],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_469],
        ['21.10', 'p2', 42_000],
        ['41.10', 'p2', -2_760],
        ['41.12', 'p2', -1_900],
        ['41.40', 'p2', -2_000],
        ['41.20', 'p2', -2_000],
        ['41.90', 'p2', -14_100],
        ['52.00', 'household', -3_700],
        ['59.20', 'household', -2_800],
      ],
      taxable: 94_394,
      rate: 47_197,
      base: 5_996.1,
      cc: 2_848.15,
      reduction: 1_061.3,
      homeCare: 59.95,
      cantonal: 7_842.9,
      communal: { privileged: 647.6, rest: [1_750.85] },
      personal: 25,
      iccTotal: 10_266.35,
      ifdTaxable: 85_313,
      ifdScaleTax: 1_177,
      ifdTax: 1_177,
    };
    return { 2025: e, 2026: e };
  })(),
);

// H4. Single parent, Meyrin, one child (full custody, under 14, childcare 12'000).
// ICC: 11.10 95'000; 31.10 -6'300; 31.12 -5'000; 31.40 -7'258; 31.50 3 % x 83'700 = 2'511 ->
// 1'812; 52.21 9'000 (limit 17'122 + 3'965); 59.10 12'000 (under 26'320). 92.20 = 53'630. 61.25:
// childcare is deducted for the child, so 10'508 instead of 13'660. Taxable 43'122, full splitting
// (single parent living with the child): rate 21'561, scale (21'561 - 18'649) x 7.30 % = 2'912 x
// 0.073 = 212.576 -> 212.60; base x 2 = 425.20. Centimes 201.97 -> 201.95; reduction 12 % x
// 627.15 = 75.258 -> 75.25; home care 4.252 -> 4.25; cantonal 556.15.
// Communal 2025 (Meyrin PP 30 %, CA 42): 127.56 -> 127.55 x 42 % = 53.571 -> 53.55; rest 297.65 x
// 42 % = 125.013 -> 125.00. 2026 (PP 29 %): 123.308 -> 123.30 -> 51.786 -> 51.80; rest 301.90 ->
// 126.798 -> 126.80. ICC 2025 556.15 + 178.55 + 25 = 759.70; 2026: 759.75.
// IFD: 31.20 2'511; 52.00 min(9'000, 1'800 + 700) = 2'500; 59.12 12'000; 61.20 6'800. Taxable
// 95'000 - 6'300 - 5'000 - 7'258 - 2'511 - 2'500 - 12'000 - 6'800 = 52'631, at 52'600 on the
// parental (married) scale: 0 + 229 x 1.00 = 229.00, less 263 for the child: 0.
both(
  'H4 single parent, Meyrin',
  (taxYear) => ({
    taxYear,
    commune: 'meyrin',
    civilStatus: 'divorced',
    people: [
      { id: 'p1', employments: [job(95_000, 6_300, 5_000)], pillar3a: { value: chf(7_258) } },
    ],
    children: [{ custody: 'full', under14: true, age: 'child', childcare: { value: chf(12_000) } }],
    household: { healthPremiums: { value: chf(9_000) } },
  }),
  (() => {
    const base = {
      icc: [
        ['11.10', 'p1', 95_000],
        ['31.10', 'p1', -6_300],
        ['31.12', 'p1', -5_000],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -9_000],
        ['59.10', 'household', -12_000],
        ['61.25', 'household', -10_508],
      ] as [string, string, number][],
      ifd: [
        ['11.10', 'p1', 95_000],
        ['31.10', 'p1', -6_300],
        ['31.12', 'p1', -5_000],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_511],
        ['52.00', 'household', -2_500],
        ['59.12', 'household', -12_000],
        ['61.20', 'household', -6_800],
      ] as [string, string, number][],
      taxable: 43_122,
      rate: 21_561,
      base: 425.2,
      cc: 201.95,
      reduction: 75.25,
      homeCare: 4.25,
      cantonal: 556.15,
      personal: 25,
      ifdTaxable: 52_631,
      ifdScaleTax: 229,
      ifdTax: 0,
    };
    return {
      2025: { ...base, communal: { privileged: 53.55, rest: [125.0] }, iccTotal: 759.7 },
      2026: { ...base, communal: { privileged: 51.8, rest: [126.8] }, iccTotal: 759.75 },
    };
  })(),
);

// H5. The Dupont household: married, two incomes, two children, Vernier. Childcare 15'000 for the
// first child (under 14); medical costs 5'005; donations 1'000; A's commute 900 a year.
// ICC: A 11.10 110'000, 31.10 -7'300, 31.12 -7'700, 31.40 -7'258; flat 3 % x 95'000 = 2'850 ->
// 1'812, more than the actual costs (commute 900 capped at 534): 31.50 -1'812. B 21.10 30'000,
// 41.10 -1'990, 41.12 -900, 41.50 3 % x 27'110 = 813.30 -> 813. Earned A 85'930, B 26'297: 41.95
// -1'051. 52.21 16'000 (limit 2 x 17'122 + 2 x 3'965); 59.10 15'000 (both work). 92.20 = 140'000 -
// 24'070 - 4'754 - 31'000 = 80'176. 71.00: 5'005 - 0.5 % x 80'176 (400.88 -> 401) = 4'604. 92.40
// = 75'572. 73.00 (ICC column): 1'000, under 20 % (15'114). 61.25: 10'508 (childcare) + 13'660 = 24'168.
// Taxable 75'572 - 1'000 - 24'168 = 50'404; rate 25'202: 463.10 + 486 x 9.10 % = 44.226 -> 44.25:
// 507.35; base 1'014.70. Centimes 481.9825 -> 482.00; reduction 12 % x 1'496.70 = 179.604 ->
// 179.60; home care 10.147 -> 10.15; cantonal 1'327.25.
// Communal 2025 (Vernier PP 80 %, CA 50): 811.76 -> 811.75 x 50 % = 405.875 -> 405.90 (half up);
// rest 202.95 -> 101.475 -> 101.50. 2026 (PP 75 %): 761.025 -> 761.05 -> 380.525 -> 380.55; rest
// 253.65 -> 126.825 -> 126.85. ICC 1'327.25 + 507.40 + 25 = 1'859.65 (both years).
// IFD: A 31.20 2'850, 31.71 900 (under 3'300); B 41.20 813 -> 2'000. Earned B 25'110: 50 % =
// 12'555, within 8'600 to 14'100: 41.90 -12'555. 52.00 min(16'000, 3'700 + 2 x 700) = 5'100;
// 59.12 15'000; 59.20 2'800. 92.20 = 140'000 - 26'008 - 17'445 - 22'900 = 73'647. 71.00: 5'005 -
// 5 % x 73'647 (3'682.35 -> 3'682) = 1'323. 92.40 = 72'324; 73.00 (IFD column) 1'000. 61.20 2 x 6'800. Taxable
// 72'324 - 1'000 - 13'600 = 57'724, at 57'700: 237 + 43 x 2 = 323.00, less 2 x 263: 0.
both(
  'H5 Dupont, married with two children, Vernier',
  (taxYear) => ({
    taxYear,
    commune: 'vernier',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [job(110_000, 7_300, 7_700)],
        pillar3a: { value: chf(7_258) },
        commuteCost: { value: chf(900) },
      },
      { id: 'p2', employments: [job(30_000, 1_990, 900)] },
    ],
    children: [
      { custody: 'full', under14: true, age: 'child', childcare: { value: chf(15_000) } },
      { custody: 'full', under14: true, age: 'child' },
    ],
    household: {
      healthPremiums: { value: chf(16_000) },
      medicalCosts: { value: chf(5_005) },
      donations: { value: chf(1_000) },
    },
  }),
  (() => {
    const base = {
      icc: [
        ['11.10', 'p1', 110_000],
        ['31.10', 'p1', -7_300],
        ['31.12', 'p1', -7_700],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['21.10', 'p2', 30_000],
        ['41.10', 'p2', -1_990],
        ['41.12', 'p2', -900],
        ['41.50', 'p2', -813],
        ['41.95', 'p2', -1_051],
        ['52.21', 'household', -16_000],
        ['59.10', 'household', -15_000],
        ['71.00', 'household', -4_604],
        ['73.00', 'household', -1_000],
        ['61.25', 'household', -24_168],
      ] as [string, string, number][],
      ifd: [
        ['11.10', 'p1', 110_000],
        ['31.10', 'p1', -7_300],
        ['31.12', 'p1', -7_700],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_850],
        ['31.71', 'p1', -900],
        ['21.10', 'p2', 30_000],
        ['41.10', 'p2', -1_990],
        ['41.12', 'p2', -900],
        ['41.20', 'p2', -2_000],
        ['41.90', 'p2', -12_555],
        ['52.00', 'household', -5_100],
        ['59.12', 'household', -15_000],
        ['59.20', 'household', -2_800],
        ['71.00', 'household', -1_323],
        ['73.00', 'household', -1_000],
        ['61.20', 'household', -13_600],
      ] as [string, string, number][],
      taxable: 50_404,
      rate: 25_202,
      base: 1_014.7,
      cc: 482.0,
      reduction: 179.6,
      homeCare: 10.15,
      cantonal: 1_327.25,
      personal: 25,
      iccTotal: 1_859.65,
      ifdTaxable: 57_724,
      ifdScaleTax: 323,
      ifdTax: 0,
    };
    return {
      2025: { ...base, communal: { privileged: 405.9, rest: [101.5] } },
      2026: { ...base, communal: { privileged: 380.55, rest: [126.85] } },
    };
  })(),
);

// H6. Shared custody, Lancy: a divorced parent, one child half the time, no childcare.
// ICC: 11.10 70'000; 31.10 -4'600; 31.12 -3'600; 31.40 -5'000; 31.50 3 % x 61'800 = 1'854 ->
// 1'812; 52.21 -6'500. 92.20 = 48'488; 61.25 half charge 6'830: taxable 41'658. Partial splitting:
// rate 55.56 % x 41'658 = 23'145.18 -> 23'145; scale 278.85 + 676 x 8.20 % = 55.432 -> 55.45:
// 334.30; base 41'658 x 334.30 / 23'145 = 601.697 -> 601.70. Centimes 285.8075 -> 285.80;
// reduction 12 % x 887.50 = 106.50; home care 6.017 -> 6.00; cantonal 787.00.
// Communal 2025 (Lancy PP 49 %, CA 47): 294.833 -> 294.85 x 47 % = 138.5795 -> 138.60; rest 306.85
// x 47 % = 144.2195 -> 144.20. 2026 (PP 51 %): 306.867 -> 306.85 -> 144.20; rest 294.85 -> 138.60.
// ICC 787.00 + 282.80 + 25 = 1'094.80.
// IFD, told the other parent has the parental scale (single scale): 31.20 1'854 -> 2'000; 52.00
// min(6'500, 1'800 + 700) = 2'500; 61.20 half 3'400. Taxable 48'900: 229.20 + 54 x 2.64 = 371.76
// -> 371.75.
both(
  'H6 shared custody, Lancy',
  (taxYear) => ({
    taxYear,
    commune: 'lancy',
    civilStatus: 'divorced',
    ifdParentalScale: false,
    people: [
      { id: 'p1', employments: [job(70_000, 4_600, 3_600)], pillar3a: { value: chf(5_000) } },
    ],
    children: [{ custody: 'shared', age: 'child' }],
    household: { healthPremiums: { value: chf(6_500) } },
  }),
  (() => {
    const e: Expected = {
      icc: [
        ['11.10', 'p1', 70_000],
        ['31.10', 'p1', -4_600],
        ['31.12', 'p1', -3_600],
        ['31.40', 'p1', -5_000],
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -6_500],
        ['61.25', 'household', -6_830],
      ],
      ifd: [
        ['11.10', 'p1', 70_000],
        ['31.10', 'p1', -4_600],
        ['31.12', 'p1', -3_600],
        ['31.40', 'p1', -5_000],
        ['31.20', 'p1', -2_000],
        ['52.00', 'household', -2_500],
        ['61.20', 'household', -3_400],
      ],
      taxable: 41_658,
      rate: 23_145,
      base: 601.7,
      cc: 285.8,
      reduction: 106.5,
      homeCare: 6.0,
      cantonal: 787.0,
      communal: { privileged: 138.6, rest: [144.2] },
      personal: 25,
      iccTotal: 1_094.8,
      ifdTaxable: 48_900,
      ifdScaleTax: 371.75,
      ifdTax: 371.75,
    };
    return { 2025: e, 2026: { ...e, communal: { privileged: 144.2, rest: [138.6] } } };
  })(),
);

describe('H6 without knowing who has the federal parental scale', () => {
  it('computes the cantonal tax but not the federal one (fail closed)', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'lancy',
      civilStatus: 'divorced',
      people: [{ id: 'p1', employments: [job(70_000, 4_600, 3_600)] }],
      children: [{ custody: 'shared' }],
    });
    expect(r.icc).not.toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported[0]!.en).toMatch(/Federal tax not computed/);
  });
});

// H7. Self-employed, Onex, single, no pension fund: net profit given 60'000; 3a 10'000.
// ICC: 12.01 60'000; 32.40 (3a on the annexe B): without a pension fund, 20 % x 60'000 = 12'000 limit, 10'000 paid:
// -10'000; no flat professional deduction (no salary); 52.21 -6'000. Taxable 44'000: 2'565.15 +
// 185 x 12.80 % = 23.68 -> 23.70: 2'588.85. Centimes 1'229.70375 -> 1'229.70; reduction 12 % x
// 3'818.55 = 458.226 -> 458.25; home care 25.8885 -> 25.90; cantonal 3'386.20.
// Communal (Onex PP 80 %, CA 50.5, both years): 2'071.08 -> 2'071.10 x 50.5 % = 1'045.9055 ->
// 1'045.90; rest 517.75 x 50.5 % = 261.46375 -> 261.45. ICC 3'386.20 + 1'307.35 + 25 = 4'718.55.
// IFD: 52.00 min(6'000, 1'800) (3a paid, so the lower limit). Taxable 48'200: 229.20 + 47 x 2.64 =
// 353.28 -> 353.25.
both(
  'H7 self-employed, Onex',
  (taxYear) => ({
    taxYear,
    commune: 'onex',
    civilStatus: 'single',
    people: [
      { id: 'p1', selfEmploymentProfit: { value: chf(60_000) }, pillar3a: { value: chf(10_000) } },
    ],
    household: { healthPremiums: { value: chf(6_000) } },
  }),
  (() => {
    const e: Expected = {
      icc: [
        ['12.01', 'p1', 60_000],
        ['32.40', 'p1', -10_000],
        ['52.21', 'household', -6_000],
      ],
      ifd: [
        ['12.01', 'p1', 60_000],
        ['32.40', 'p1', -10_000],
        ['52.00', 'household', -1_800],
      ],
      taxable: 44_000,
      rate: 44_000,
      base: 2_588.85,
      cc: 1_229.7,
      reduction: 458.25,
      homeCare: 25.9,
      cantonal: 3_386.2,
      communal: { privileged: 1_045.9, rest: [261.45] },
      personal: 25,
      iccTotal: 4_718.55,
      ifdTaxable: 48_200,
      ifdScaleTax: 353.25,
      ifdTax: 353.25,
    };
    return { 2025: e, 2026: e };
  })(),
);

// H8. Wealth above the social deduction, Cologny: married retirees. A: AVS 30'000, pension fund
// 48'000; B: AVS 26'000. Securities 950'000 (income 14'000). Health premiums 14'000.
// ICC: income 118'000; 52.21 -14'000; 92.40 = 104'000, above 98'080: no AVS deduction (61.30).
// Taxable 104'000, rate 52'000: 3'140.40 + 3'691 x 13.20 % = 487.212 -> 487.20: 3'627.60; base
// 7'255.20. Centimes 3'446.22 -> 3'446.20; reduction 12 % x 10'701.40 = 1'284.168 -> 1'284.15;
// home care 72.552 -> 72.55; cantonal income 9'489.80.
// Wealth: 950'000 - 175'264 (couple) = 774'736. Base 1'635.05 + 64'349 x 2.98 per mille =
// 191.76 -> 191.75: 1'826.80; centimes 867.73 -> 867.75; home care 18.268 -> 18.25;
// supplementary 120.80 + 64'349 x 0.4463 per mille = 28.719 -> 28.70: 149.50; cantonal wealth
// 2'862.30.
// Communal (Cologny PP 20 %, CA 25, both years): income 1'451.04 -> 1'451.05 x 25 % = 362.7625 ->
// 362.75; rest 5'804.15 -> 1'451.0375 -> 1'451.05; wealth 365.36 -> 365.35 -> 91.3375 -> 91.35;
// rest 1'461.45 -> 365.3625 -> 365.35, total 456.70.
// ICC 9'489.80 + 2'862.30 + 1'813.80 + 456.70 + 25 = 14'647.60. Far under 60 % of the taxable
// income: no tax shield.
// IFD: 52.00 min(14'000, 5'550) (neither pays into a 2nd pillar or 3a); 59.20 2'800. Taxable
// 118'000 - 5'550 - 2'800 = 109'650, at 109'600: 2025 2'246 + 10 x 6 = 2'306.00; 2026 2'251 + 9 x
// 6 = 2'305.00.
both(
  'H8 wealth above the social deduction, Cologny',
  (taxYear) => ({
    taxYear,
    commune: 'cologny',
    civilStatus: 'married',
    people: [
      { id: 'p1', pensionAvs: { value: chf(30_000) }, pensionOccupational: { value: chf(48_000) } },
      { id: 'p2', pensionAvs: { value: chf(26_000) } },
    ],
    household: { healthPremiums: { value: chf(14_000) } },
    movable: [{ owner: 'p1', value: { value: chf(950_000) }, income: { value: chf(14_000) } }],
  }),
  (() => {
    const base = {
      icc: [
        ['17.10', 'p1', 30_000],
        ['13.20', 'p1', 48_000],
        ['17.10', 'p2', 26_000],
        ['14.00', 'p1', 14_000],
        ['52.21', 'household', -14_000],
      ] as [string, string, number][],
      ifd: [
        ['17.10', 'p1', 30_000],
        ['13.20', 'p1', 48_000],
        ['17.10', 'p2', 26_000],
        ['14.00', 'p1', 14_000],
        ['52.00', 'household', -5_550],
        ['59.20', 'household', -2_800],
      ] as [string, string, number][],
      taxable: 104_000,
      rate: 52_000,
      base: 7_255.2,
      cc: 3_446.2,
      reduction: 1_284.15,
      homeCare: 72.55,
      cantonal: 9_489.8,
      communal: { privileged: 362.75, rest: [1_451.05] },
      personal: 25,
      iccTotal: 14_647.6,
      wealth: {
        taxable: 774_736,
        base: 1_826.8,
        cc: 867.75,
        homeCare: 18.25,
        supplementary: 149.5,
        communal: 456.7,
      },
      ifdTaxable: 109_650,
    };
    return {
      2025: { ...base, ifdScaleTax: 2_306, ifdTax: 2_306 },
      2026: { ...base, ifdScaleTax: 2_305, ifdTax: 2_305 },
    };
  })(),
);

// H9. Lives in Thônex, works in the City of Geneva (commune of work for the communal split).
// ICC: 11.10 100'000; 31.10 -6'600; 31.12 -7'000; 31.40 -7'258; 31.50 3 % x 86'400 = 2'592 ->
// 1'812; 52.21 -5'000. Taxable 72'330: 3'140.40 + 24'021 x 13.20 % = 3'170.772 -> 3'170.75:
// 6'311.15. Centimes 2'997.79625 -> 2'997.80; reduction 12 % x 9'308.95 = 1'117.074 -> 1'117.05;
// home care 63.1115 -> 63.10; cantonal 8'255.00.
// Communal (Thônex PP 77 %, CA 44, both years; Genève CA 45.49): privileged 4'859.5855 -> 4'859.60
// x 44 % = 2'138.224 -> 2'138.20 for Thônex; the rest 1'451.55, all the salary earned in Genève,
// x 45.49 % = 660.310 -> 660.30 for Genève; nothing left for Thônex. ICC 8'255.00 + 2'798.50 + 25 =
// 11'078.50.
// IFD: 31.20 2'592; 52.00 1'800. Taxable 74'750, at 74'700: 612.00 + 167 x 2.97 = 1'107.99 ->
// 1'107.95.
both(
  'H9 lives in Thônex, works in Genève',
  (taxYear) => ({
    taxYear,
    commune: 'thonex',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [{ ...job(100_000, 6_600, 7_000), workCommune: 'geneve' }],
        pillar3a: { value: chf(7_258) },
      },
    ],
    household: { healthPremiums: { value: chf(5_000) } },
  }),
  (() => {
    const e: Expected = {
      icc: [
        ['11.10', 'p1', 100_000],
        ['31.10', 'p1', -6_600],
        ['31.12', 'p1', -7_000],
        ['31.40', 'p1', -7_258],
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -5_000],
      ],
      ifd: [
        ['11.10', 'p1', 100_000],
        ['31.10', 'p1', -6_600],
        ['31.12', 'p1', -7_000],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_592],
        ['52.00', 'household', -1_800],
      ],
      taxable: 72_330,
      rate: 72_330,
      base: 6_311.15,
      cc: 2_997.8,
      reduction: 1_117.05,
      homeCare: 63.1,
      cantonal: 8_255.0,
      // Rest: Thônex first (nothing left), then Genève.
      communal: { privileged: 2_138.2, rest: [0, 660.3] },
      personal: 25,
      iccTotal: 11_078.5,
      ifdTaxable: 74_750,
      ifdScaleTax: 1_107.95,
      ifdTax: 1_107.95,
    };
    return { 2025: e, 2026: e };
  })(),
);
