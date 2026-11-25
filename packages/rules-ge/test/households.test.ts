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
//   ge-2025-communal-centimes-pdf: PP and CA 2025. ge-2026-part-privilegiee-communique p. 12 and
//     ge-2026-communal-centimes-arca: PP and CA 2026. ge-na-law-lcp art. 375: taxe personnelle 25.
//   2026: the federal values from ch-2026-ifd-progression-deductions; the Geneva values from
//     ge-2026-rcepf (the regulation of 8 October 2025): income scale art. 17 (0 % up to 18'700,
//     7.30 % to 22'530, 8.20 % to 24'784, 9.10 % to 27'036, 10.00 % to 29'290, 10.90 % to 34'922,
//     11.30 % to 39'428, 12.30 % to 43'935, 12.80 % to 48'441, 13.20 % to 77'730; cumulative tax,
//     each bracket to 5 centimes: 279.60 at 22'530, 464.45 at 24'784, 1'508.70 at 34'922, 2'017.90
//     at 39'428, 2'572.25 at 43'935, 3'149.00 at 48'441); wealth scales art. 18 (1'639.55 and
//     121.10 at 712'330, then 2.98 and 0.4463 per mille); flat professional expenses 641 to 1'817
//     (art. 6 al. 2); commuting 536 (art. 6 al. 1); two earners 1'054 (art. 10); childcare 26'392
//     (art. 9); family charge 13'698 (10'536 with childcare, half 6'849: art. 13); AVS pensioners,
//     a couple, up to 98'348 (art. 14); wealth deduction 87'872, 175'743 for a couple (art. 16).
//     The surcharges are the laws' (ge-na-law-lcacant art. 2, ge-na-law-ldirpp art. 1), the same
//     in both years. Two amounts are not published for 2026 yet (they come with the 2026 guide,
//     January 2027): the health premium ceiling (17'122 per adult, 3'965 per child) and the meal
//     amounts (15 a day, 3'200 a year); the 2025 ones are used and flagged as estimates.
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
    // Every household below has health premiums (52.21), whose 2026 ceiling Geneva has not
    // published yet (H10 has meals too, 31.60): the cantonal tax is flagged for that, the federal
    // tax never. A 2026 household with neither has no estimate: capital.test.ts (Favre).
    it('2026: Geneva’s 2026 values, the health premium ceiling an estimate, federal values official', () => {
      const r = computeReturn(input(2026));
      check(r, expected[2026]);
      expect(r.estimates.map((e) => e.id)).toEqual(['ge-2026-unpublished']);
      expect(r.icc!.taxes.total.estimates).toContain('ge-2026-unpublished');
      expect(r.ifd!.tax.estimates).toBeUndefined();
    });
  });
}

/** The same lines, with other amounts for some of them: [code, person, amount]. */
const withLines = (rows: [string, string, number][], changes: [string, string, number][]) =>
  rows.map((row) => changes.find(([code, person]) => code === row[0] && person === row[1]) ?? row);

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
// Wealth 30'000 under the 87'632 deduction: taxable 0. ICC 6'243.55 + 2'171.40 + 25 = 8'439.95.
// ICC 2026 (ge-2026-rcepf): 31.50 at most 1'817 (art. 6 al. 2): taxable 85'150 - 5'500 - 4'500 -
// 7'258 - 1'817 - 5'400 = 60'675. Base (art. 17): 3'149.00 + (60'675 - 48'441) x 13.20 % = 12'234
// x 0.132 = 1'614.888 -> 1'614.90: 4'763.90. Centimes 2'262.8525 -> 2'262.85; reduction 12 % of
// 7'026.75 = 843.21 -> 843.20; home care 47.639 -> 47.65; cantonal 6'231.20. Communal (PP 29 %,
// CA 45.49): 1'381.531 -> 1'381.55 x 45.49 % = 628.467 -> 628.45; rest 3'382.35 x 45.49 % =
// 1'538.631 -> 1'538.65. Wealth 30'000 under the 87'872 deduction (art. 16). ICC 6'231.20 +
// 2'167.10 + 25 = 8'423.30.
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
      personal: 25,
      ifdTaxable: 63_842,
      ifdScaleTax: 784.25,
      ifdTax: 784.25,
    };
    return {
      2025: {
        ...base,
        taxable: 60_680,
        rate: 60_680,
        base: 4_773.35,
        cc: 2_267.35,
        reduction: 844.9,
        homeCare: 47.75,
        cantonal: 6_243.55,
        communal: { privileged: 608.0, rest: [1_563.4] },
        iccTotal: 8_439.95,
      },
      2026: {
        ...base,
        icc: withLines(base.icc, [['31.50', 'p1', -1_817]]),
        taxable: 60_675,
        rate: 60_675,
        base: 4_763.9,
        cc: 2_262.85,
        reduction: 843.2,
        homeCare: 47.65,
        cantonal: 6_231.2,
        communal: { privileged: 628.45, rest: [1_538.65] },
        iccTotal: 8_423.3,
      },
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
// (half up); rest 915.35 x 50 % = 457.675 -> 457.70. ICC 2025: 5'986.45 + 2'288.45 + 25 = 8'299.90.
// ICC 2026 (ge-2026-rcepf): 31.50 at most 1'817 (art. 6 al. 2): taxable 83'125; rate 41'562.5 ->
// 41'563; scale (art. 17) 2'017.90 + (41'563 - 39'428) x 12.30 % = 2'135 x 0.123 = 262.605 ->
// 262.60: 2'280.50; base 83'125 x 2'280.50 / 41'563 = 4'560.945 -> 4'560.95. Centimes 2'166.45125
// -> 2'166.45; reduction 12 % x 6'727.40 = 807.288 -> 807.30; home care 45.6095 -> 45.60; cantonal
// 5'965.70. Communal (PP 75 %, CA 50): 3'420.7125 -> 3'420.70 x 50 % = 1'710.35; rest 1'140.25 x
// 50 % = 570.125 -> 570.15. ICC 5'965.70 + 2'280.50 + 25 = 8'271.20.
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
      personal: 25,
      ifdTaxable: 86_346,
      ifdScaleTax: 1_217,
      ifdTax: 1_217,
    };
    return {
      2025: {
        ...base,
        taxable: 83_130,
        rate: 41_565,
        base: 4_576.8,
        cc: 2_174.0,
        reduction: 810.1,
        homeCare: 45.75,
        cantonal: 5_986.45,
        communal: { privileged: 1_830.75, rest: [457.7] },
        iccTotal: 8_299.9,
      },
      2026: {
        ...base,
        icc: withLines(base.icc, [['31.50', 'p1', -1_817]]),
        taxable: 83_125,
        rate: 41_563,
        base: 4_560.95,
        cc: 2_166.45,
        reduction: 807.3,
        homeCare: 45.6,
        cantonal: 5_965.7,
        communal: { privileged: 1_710.35, rest: [570.15] },
        iccTotal: 8_271.2,
      },
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
// ICC 2026 (ge-2026-rcepf): A's 31.50 at most 1'817 (art. 6 al. 2), 41.95 -1'054 (art. 10).
// Earned income A 73'225, B 34'220. Taxable 137'000 - 21'775 (A) - 8'834 (B, with 41.95) - 12'005
// = 94'386; rate 47'193; scale (art. 17) 2'572.25 + (47'193 - 43'935) x 12.80 % = 3'258 x 0.128 =
// 417.024 -> 417.00: 2'989.25; base x 2 = 5'978.50. Centimes 2'839.7875 -> 2'839.80; reduction
// 12 % x 8'818.30 = 1'058.196 -> 1'058.20; home care 59.785 -> 59.80; cantonal 7'819.90. Communal:
// 1'614.195 -> 1'614.20 x 40 % = 645.68 -> 645.70; rest 4'364.30 x 40 % = 1'745.72 -> 1'745.70.
// ICC 7'819.90 + 2'391.40 + 25 = 10'236.30.
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
    return {
      2025: e,
      2026: {
        ...e,
        icc: withLines(e.icc, [
          ['31.50', 'p1', -1_817],
          ['41.95', 'p2', -1_054],
        ]),
        taxable: 94_386,
        rate: 47_193,
        base: 5_978.5,
        cc: 2_839.8,
        reduction: 1_058.2,
        homeCare: 59.8,
        cantonal: 7_819.9,
        communal: { privileged: 645.7, rest: [1_745.7] },
        iccTotal: 10_236.3,
      },
    };
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
// 42 % = 125.013 -> 125.00. ICC 2025 556.15 + 178.55 + 25 = 759.70.
// ICC 2026 (ge-2026-rcepf): 31.50 at most 1'817 (art. 6 al. 2); 59.10 12'000 (under 26'392, art.
// 9); 92.20 = 53'625; 61.25 with childcare 10'536 instead of 13'698 (art. 13 al. 1): taxable
// 43'089; rate 21'544.5 -> 21'545; scale (art. 17) (21'545 - 18'700) x 7.30 % = 2'845 x 0.073 =
// 207.685 -> 207.70; base 43'089 x 207.70 / 21'545 = 415.3904 -> 415.40. Centimes 197.315 ->
// 197.30; reduction 12 % x 612.70 = 73.524 -> 73.50; home care 4.154 -> 4.15; cantonal 543.35.
// Communal (PP 29 %, CA 42): 120.466 -> 120.45 x 42 % = 50.589 -> 50.60; rest 294.95 x 42 % =
// 123.879 -> 123.90. ICC 543.35 + 174.50 + 25 = 742.85.
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
      personal: 25,
      ifdTaxable: 52_631,
      ifdScaleTax: 229,
      ifdTax: 0,
    };
    return {
      2025: {
        ...base,
        taxable: 43_122,
        rate: 21_561,
        base: 425.2,
        cc: 201.95,
        reduction: 75.25,
        homeCare: 4.25,
        cantonal: 556.15,
        communal: { privileged: 53.55, rest: [125.0] },
        iccTotal: 759.7,
      },
      2026: {
        ...base,
        icc: withLines(base.icc, [
          ['31.50', 'p1', -1_817],
          ['61.25', 'household', -10_536],
        ]),
        taxable: 43_089,
        rate: 21_545,
        base: 415.4,
        cc: 197.3,
        reduction: 73.5,
        homeCare: 4.15,
        cantonal: 543.35,
        communal: { privileged: 50.6, rest: [123.9] },
        iccTotal: 742.85,
      },
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
// rest 202.95 -> 101.475 -> 101.50. ICC 1'327.25 + 507.40 + 25 = 1'859.65.
// ICC 2026 (ge-2026-rcepf): A's flat at most 1'817 (art. 6 al. 2), more than the commute (900
// capped at 536, art. 6 al. 1): 31.50 -1'817. B 41.50 813. Earned A 85'925, B 26'297: 41.95 -1'054
// (art. 10). 52.21 16'000; 59.10 15'000 (under 26'392, art. 9). 92.20 = 140'000 - 24'075 - 4'757 -
// 31'000 = 80'168. 71.00: 5'005 - 0.5 % x 80'168 (400.84 -> 401) = 4'604. 92.40 = 75'564. 73.00
// 1'000, under 20 % (15'112.80). 61.25 (art. 13 al. 1): 10'536 (childcare) + 13'698 = 24'234.
// Taxable 75'564 - 1'000 - 24'234 = 50'330; rate 25'165: scale (art. 17) 464.45 + (25'165 -
// 24'784) x 9.10 % = 381 x 0.091 = 34.671 -> 34.65: 499.10; base 998.20. Centimes 474.145 ->
// 474.15; reduction 12 % x 1'472.35 = 176.682 -> 176.70; home care 9.982 -> 10.00; cantonal
// 1'305.65. Communal (PP 75 %, CA 50): 748.65 x 50 % = 374.325 -> 374.35; rest 249.55 x 50 % =
// 124.775 -> 124.80. ICC 1'305.65 + 499.15 + 25 = 1'829.80.
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
      personal: 25,
      ifdTaxable: 57_724,
      ifdScaleTax: 323,
      ifdTax: 0,
    };
    return {
      2025: {
        ...base,
        taxable: 50_404,
        rate: 25_202,
        base: 1_014.7,
        cc: 482.0,
        reduction: 179.6,
        homeCare: 10.15,
        cantonal: 1_327.25,
        communal: { privileged: 405.9, rest: [101.5] },
        iccTotal: 1_859.65,
      },
      2026: {
        ...base,
        icc: withLines(base.icc, [
          ['31.50', 'p1', -1_817],
          ['41.95', 'p2', -1_054],
          ['61.25', 'household', -24_234],
        ]),
        taxable: 50_330,
        rate: 25_165,
        base: 998.2,
        cc: 474.15,
        reduction: 176.7,
        homeCare: 10.0,
        cantonal: 1_305.65,
        communal: { privileged: 374.35, rest: [124.8] },
        iccTotal: 1_829.8,
      },
    };
  })(),
);

/** The cantonal side of H6 and H6E in 2026, derived in H6's comment below. */
const H6_ICC_2026 = {
  icc: [
    ['11.10', 'p1', 70_000],
    ['31.10', 'p1', -4_600],
    ['31.12', 'p1', -3_600],
    ['31.40', 'p1', -5_000],
    ['31.50', 'p1', -1_817],
    ['52.21', 'household', -6_500],
    ['61.25', 'household', -6_849],
  ] as [string, string, number][],
  taxable: 41_634,
  rate: 23_132,
  base: 592.05,
  cc: 281.2,
  reduction: 104.8,
  homeCare: 5.9,
  cantonal: 774.35,
  communal: { privileged: 141.9, rest: [136.35] },
  iccTotal: 1_077.6,
};

// H6. Shared custody, Lancy: a divorced parent, one child half the time, no childcare.
// ICC: 11.10 70'000; 31.10 -4'600; 31.12 -3'600; 31.40 -5'000; 31.50 3 % x 61'800 = 1'854 ->
// 1'812; 52.21 -6'500. 92.20 = 48'488; 61.25 half charge 6'830: taxable 41'658. Partial splitting:
// rate 55.56 % x 41'658 = 23'145.18 -> 23'145; scale 278.85 + 676 x 8.20 % = 55.432 -> 55.45:
// 334.30; base 41'658 x 334.30 / 23'145 = 601.697 -> 601.70. Centimes 285.8075 -> 285.80;
// reduction 12 % x 887.50 = 106.50; home care 6.017 -> 6.00; cantonal 787.00.
// Communal 2025 (Lancy PP 49 %, CA 47): 294.833 -> 294.85 x 47 % = 138.5795 -> 138.60; rest 306.85
// x 47 % = 144.2195 -> 144.20. ICC 787.00 + 282.80 + 25 = 1'094.80.
// ICC 2026 (ge-2026-rcepf): 31.50 at most 1'817 (art. 6 al. 2); 92.20 = 48'483; 61.25 half charge
// 6'849 (art. 13 al. 1): taxable 41'634. Rate 55.56 % x 41'634 = 23'131.85 -> 23'132; scale (art.
// 17) 279.60 + (23'132 - 22'530) x 8.20 % = 602 x 0.082 = 49.364 -> 49.35: 328.95; base 41'634 x
// 328.95 / 23'132 = 592.0588 -> 592.05. Centimes 281.22375 -> 281.20; reduction 12 % x 873.25 =
// 104.79 -> 104.80; home care 5.9205 -> 5.90; cantonal 774.35. Communal (PP 51 %, CA 47): 301.9455
// -> 301.95 x 47 % = 141.9165 -> 141.90; rest 290.10 x 47 % = 136.347 -> 136.35. ICC 774.35 +
// 278.25 + 25 = 1'077.60.
// IFD, no child support and the other parent earns more, so the other parent has the parental
// scale (ch-na-circulaire-30-epoux-famille p. 24 and 32, ch. 13.4.2 and 14.4.2): single scale.
// 31.20 1'854 -> 2'000; 52.00 min(6'500, 1'800 + 350): each parent has half the amount per child,
// as half the child deduction (circular 30 p. 32, ch. 14.4.1): 2'150; 61.20 half 3'400. Taxable
// 70'000 - 4'600 - 3'600 - 5'000 - 2'000 - 2'150 - 3'400 = 49'250, at 49'200: 229.20 + 57 x 2.64
// = 379.68 -> 379.65.
both(
  'H6 shared custody, Lancy',
  (taxYear) => ({
    taxYear,
    commune: 'lancy',
    civilStatus: 'divorced',
    childSupport: 'none',
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
        ['52.00', 'household', -2_150],
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
      ifdTaxable: 49_250,
      ifdScaleTax: 379.65,
      ifdTax: 379.65,
    };
    return { 2025: e, 2026: { ...e, ...H6_ICC_2026 } };
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

// The same parent in Lancy, with the other answers to the child support question (contribution
// d'entretien): ch-na-circulaire-30-epoux-famille p. 24 (ch. 13.4.2), p. 32 and 33 (ch. 14.4, 14.5);
// ge-2025-guide-declaration-pp p. 45 (splitting) and p. 46 (family charges).
const sharedParent = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'lancy',
  civilStatus: 'divorced',
  people: [{ id: 'p1', employments: [job(70_000, 4_600, 3_600)], pillar3a: { value: chf(5_000) } }],
  children: [{ custody: 'shared', age: 'child' }],
  household: { healthPremiums: { value: chf(6_500) } },
});
const H6_EMPLOYMENT: [string, string, number][] = [
  ['11.10', 'p1', 70_000],
  ['31.10', 'p1', -4_600],
  ['31.12', 'p1', -3_600],
  ['31.40', 'p1', -5_000],
];

// H6R. Child support received, 12'000 (13.10, income in both taxes): the parent who receives it
// mainly supports the child, so the child is a full charge (guide p. 45 and 46; circular 30 ch.
// 14.5.2 and 14.5.3).
// ICC: 31.50 1'812; 52.21 6'500 (limit 17'122 + 3'965); 61.25 full charge 13'660. Taxable 82'000 -
// 4'600 - 3'600 - 5'000 - 1'812 - 6'500 - 13'660 = 46'828; full splitting: rate 23'414; scale
// 278.85 + (23'414 - 22'469) x 8.20 % = 77.49 -> 77.50: 356.35; base x 2 = 712.70. Centimes
// 338.5325 -> 338.55; reduction 12 % x 1'051.25 = 126.15; home care 7.127 -> 7.15; cantonal
// 932.25. Communal 2025 (Lancy PP 49 %, CA 47): 349.223 -> 349.20 x 47 % = 164.124 -> 164.10; rest
// 363.50 x 47 % = 170.845 -> 170.85. ICC 932.25 + 334.95 + 25 = 1'292.20.
// ICC 2026 (ge-2026-rcepf): 31.50 1'817 (art. 6 al. 2); 61.25 full charge 13'698 (art. 13 al. 1).
// Taxable 82'000 - 4'600 - 3'600 - 5'000 - 1'817 - 6'500 - 13'698 = 46'785; full splitting: rate
// 23'392.5 -> 23'393; scale (art. 17) 279.60 + (23'393 - 22'530) x 8.20 % = 70.766 -> 70.75:
// 350.35; base 46'785 x 350.35 / 23'393 = 700.685 -> 700.70. Centimes 332.8325 -> 332.85;
// reduction 12 % x 1'033.55 = 124.026 -> 124.05; home care 7.007 -> 7.00; cantonal 916.50.
// Communal (PP 51 %, CA 47): 357.357 -> 357.35 x 47 % = 167.9545 -> 167.95; rest 343.35 x 47 % =
// 161.3745 -> 161.35. ICC 916.50 + 329.30 + 25 = 1'270.80.
// IFD: 31.20 2'000; 52.00 min(6'500, 1'800 + 700) = 2'500; 61.20 the whole 6'800. Taxable 82'000 -
// 4'600 - 3'600 - 5'000 - 2'000 - 2'500 - 6'800 = 57'500, parental (married) scale at 57'500: 237 +
// 41 x 2 = 319.00, less 263 for the child: 56.00.
both(
  'H6R shared custody, child support received, Lancy',
  (taxYear) => ({
    ...sharedParent(taxYear),
    childSupport: 'receives',
    people: [
      {
        id: 'p1',
        employments: [job(70_000, 4_600, 3_600)],
        pillar3a: { value: chf(5_000) },
        alimonyReceived: { value: chf(12_000) },
      },
    ],
  }),
  (() => {
    const e: Expected = {
      icc: [
        ...H6_EMPLOYMENT,
        ['13.10', 'p1', 12_000],
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -6_500],
        ['61.25', 'household', -13_660],
      ],
      ifd: [
        ...H6_EMPLOYMENT,
        ['13.10', 'p1', 12_000],
        ['31.20', 'p1', -2_000],
        ['52.00', 'household', -2_500],
        ['61.20', 'household', -6_800],
      ],
      taxable: 46_828,
      rate: 23_414,
      base: 712.7,
      cc: 338.55,
      reduction: 126.15,
      homeCare: 7.15,
      cantonal: 932.25,
      communal: { privileged: 164.1, rest: [170.85] },
      personal: 25,
      iccTotal: 1_292.2,
      ifdTaxable: 57_500,
      ifdScaleTax: 319,
      ifdTax: 56,
    };
    return {
      2025: e,
      2026: {
        ...e,
        icc: withLines(e.icc, [
          ['31.50', 'p1', -1_817],
          ['61.25', 'household', -13_698],
        ]),
        taxable: 46_785,
        rate: 23_393,
        base: 700.7,
        cc: 332.85,
        reduction: 124.05,
        homeCare: 7.0,
        cantonal: 916.5,
        communal: { privileged: 167.95, rest: [161.35] },
        iccTotal: 1_270.8,
      },
    };
  })(),
);

// H6P. Child support paid, 12'000 (53.10, deducted in both taxes): the child counts for the other
// parent, so no family charge, no splitting, no child deduction, single scale (guide p. 46; circular
// 30 ch. 14.5).
// ICC: 31.50 1'812; 52.21 6'500 (limit 17'122, one adult); 53.10 12'000. Taxable 70'000 - 4'600 -
// 3'600 - 5'000 - 1'812 - 6'500 - 12'000 = 36'488, no splitting: 1'504.55 + (36'488 - 34'827) x
// 11.30 % = 187.693 -> 187.70: 1'692.25. Centimes 803.81875 -> 803.80; reduction 12 % x 2'496.05 =
// 299.526 -> 299.55; home care 16.9225 -> 16.90; cantonal 2'213.40. Communal 2025 (PP 49 %):
// 829.2025 -> 829.20 x 47 % = 389.724 -> 389.70; rest 863.05 x 47 % = 405.6335 -> 405.65. ICC
// 2'213.40 + 795.35 + 25 = 3'033.75.
// ICC 2026 (ge-2026-rcepf): 31.50 1'817 (art. 6 al. 2): taxable 36'483; scale (art. 17) 1'508.70 +
// (36'483 - 34'922) x 11.30 % = 1'561 x 0.113 = 176.393 -> 176.40: 1'685.10. Centimes 800.4225 ->
// 800.40; reduction 12 % x 2'485.50 = 298.26 -> 298.25; home care 16.851 -> 16.85; cantonal
// 2'204.10. Communal (PP 51 %, CA 47): 859.401 -> 859.40 x 47 % = 403.918 -> 403.90; rest 825.70 x
// 47 % = 388.079 -> 388.10. ICC 2'204.10 + 792.00 + 25 = 3'021.10.
// IFD: 31.20 2'000; 52.00 min(6'500, 1'800) = 1'800; 53.10 12'000. Taxable 70'000 - 4'600 -
// 3'600 - 5'000 - 2'000 - 1'800 - 12'000 = 41'000, single scale: 138.60 + 78 x 0.88 = 207.24 ->
// 207.20.
both(
  'H6P shared custody, child support paid, Lancy',
  (taxYear) => ({
    ...sharedParent(taxYear),
    childSupport: 'pays',
    household: { healthPremiums: { value: chf(6_500) }, alimonyPaid: { value: chf(12_000) } },
  }),
  (() => {
    const e: Expected = {
      icc: [
        ...H6_EMPLOYMENT,
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -6_500],
        ['53.10', 'household', -12_000],
      ],
      ifd: [
        ...H6_EMPLOYMENT,
        ['31.20', 'p1', -2_000],
        ['52.00', 'household', -1_800],
        ['53.10', 'household', -12_000],
      ],
      taxable: 36_488,
      rate: 36_488,
      base: 1_692.25,
      cc: 803.8,
      reduction: 299.55,
      homeCare: 16.9,
      cantonal: 2_213.4,
      communal: { privileged: 389.7, rest: [405.65] },
      personal: 25,
      iccTotal: 3_033.75,
      ifdTaxable: 41_000,
      ifdScaleTax: 207.2,
      ifdTax: 207.2,
    };
    return {
      2025: e,
      2026: {
        ...e,
        icc: withLines(e.icc, [['31.50', 'p1', -1_817]]),
        taxable: 36_483,
        rate: 36_483,
        base: 1_685.1,
        cc: 800.4,
        reduction: 298.25,
        homeCare: 16.85,
        cantonal: 2_204.1,
        communal: { privileged: 403.9, rest: [388.1] },
        iccTotal: 3_021.1,
      },
    };
  })(),
);

// H6E. No child support, and this parent earns more: the parental scale is theirs (circular 30
// ch. 13.4.2 and 14.4.2), with the whole reduction per child (ch. 13.4.1); the deductions stay
// half (ch. 14.4.1). ICC as H6. IFD taxable 49'250 as H6, parental (married) scale at 49'200:
// (49'200 - 29'700) / 100 x 1.00 = 195.00, less 263 for the child, at most the tax: 0.
both(
  'H6E shared custody, no child support, earns more, Lancy',
  (taxYear) => ({ ...sharedParent(taxYear), childSupport: 'none', ifdParentalScale: true }),
  (() => {
    const e: Expected = {
      icc: [
        ...H6_EMPLOYMENT,
        ['31.50', 'p1', -1_812],
        ['52.21', 'household', -6_500],
        ['61.25', 'household', -6_830],
      ],
      ifd: [
        ...H6_EMPLOYMENT,
        ['31.20', 'p1', -2_000],
        ['52.00', 'household', -2_150],
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
      ifdTaxable: 49_250,
      ifdScaleTax: 195,
      ifdTax: 0,
    };
    return { 2025: e, 2026: { ...e, ...H6_ICC_2026 } };
  })(),
);

describe('shared custody: what the federal scale and the child lines cite', () => {
  it('cites circular 30 on the scale, the reduction and the child lines', () => {
    const r = computeReturn({
      ...sharedParent(2026),
      childSupport: 'none',
      ifdParentalScale: true,
    });
    const cites = (sources: string[]) =>
      sources.some((s) => s.startsWith('ch-na-circulaire-30-epoux-famille'));
    expect(cites(r.ifd!.scaleTax.sources)).toBe(true);
    expect(cites(r.ifd!.childReduction.sources)).toBe(true);
    for (const code of ['52.00', '61.20']) {
      expect(cites(r.ifd!.items.find((i) => i.code === code)!.sources), code).toBe(true);
    }
    expect(r.ifd!.scale).toBe('parental');
  });
  it('fails closed when nobody knows who earns more', () => {
    const r = computeReturn({ ...sharedParent(2026), childSupport: 'none' });
    expect(r.ifd).toBeNull();
    expect(r.unsupported[0]!.en).toMatch(/earns more/);
  });
});

// H7. Self-employed, Onex, single, no pension fund: net profit given 60'000; 3a 10'000.
// ICC: 12.01 60'000; 32.40 (3a on the annexe B): without a pension fund, 20 % x 60'000 = 12'000 limit, 10'000 paid:
// -10'000; no flat professional deduction (no salary); 52.21 -6'000. Taxable 44'000: 2'565.15 +
// 185 x 12.80 % = 23.68 -> 23.70: 2'588.85. Centimes 1'229.70375 -> 1'229.70; reduction 12 % x
// 3'818.55 = 458.226 -> 458.25; home care 25.8885 -> 25.90; cantonal 3'386.20.
// Communal (Onex PP 80 %, CA 50.5, both years): 2'071.08 -> 2'071.10 x 50.5 % = 1'045.9055 ->
// 1'045.90; rest 517.75 x 50.5 % = 261.46375 -> 261.45. ICC 3'386.20 + 1'307.35 + 25 = 4'718.55.
// ICC 2026 (ge-2026-rcepf art. 17): the same taxable 44'000: 2'572.25 + (44'000 - 43'935) x
// 12.80 % = 8.32 -> 8.30: 2'580.55. Centimes 1'225.76125 -> 1'225.75; reduction 12 % x 3'806.30 =
// 456.756 -> 456.75; home care 25.8055 -> 25.80; cantonal 3'375.35. Communal: 2'064.44 ->
// 2'064.45 x 50.5 % = 1'042.547 -> 1'042.55; rest 516.10 x 50.5 % = 260.6305 -> 260.65. ICC
// 3'375.35 + 1'303.20 + 25 = 4'703.55.
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
    return {
      2025: e,
      2026: {
        ...e,
        base: 2_580.55,
        cc: 1_225.75,
        reduction: 456.75,
        homeCare: 25.8,
        cantonal: 3_375.35,
        communal: { privileged: 1_042.55, rest: [260.65] },
        iccTotal: 4_703.55,
      },
    };
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
// ICC 2026 (ge-2026-rcepf): 92.40 = 104'000, above 98'348 (art. 14 al. 2): no 61.30. Rate 52'000:
// scale (art. 17) 3'149.00 + (52'000 - 48'441) x 13.20 % = 3'559 x 0.132 = 469.788 -> 469.80:
// 3'618.80; base 7'237.60. Centimes 3'437.86 -> 3'437.85; reduction 12 % x 10'675.45 = 1'281.054
// -> 1'281.05; home care 72.376 -> 72.40; cantonal income 9'466.80.
// Wealth 2026: 950'000 - 175'743 (couple, art. 16 al. 1) = 774'257. Base (art. 18 al. 1) 1'639.55
// + (774'257 - 712'330) x 2.98 per mille = 61'927 x 0.00298 = 184.5425 -> 184.55: 1'824.10;
// centimes 866.4475 -> 866.45; home care 18.241 -> 18.25; supplementary (art. 18 al. 2) 121.10 +
// 61'927 x 0.4463 per mille = 27.638 -> 27.65: 148.75; cantonal wealth 2'857.55.
// Communal 2026: income 1'447.52 -> 1'447.50 x 25 % = 361.875 -> 361.90; rest 5'790.10 ->
// 1'447.525 -> 1'447.55; wealth 364.82 -> 364.80 -> 91.20; rest 1'459.30 -> 364.825 -> 364.85,
// total 456.05. ICC 9'466.80 + 2'857.55 + 1'809.45 + 456.05 + 25 = 14'614.85.
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
      2026: {
        ...base,
        base: 7_237.6,
        cc: 3_437.85,
        reduction: 1_281.05,
        homeCare: 72.4,
        cantonal: 9_466.8,
        communal: { privileged: 361.9, rest: [1_447.55] },
        iccTotal: 14_614.85,
        wealth: {
          taxable: 774_257,
          base: 1_824.1,
          cc: 866.45,
          homeCare: 18.25,
          supplementary: 148.75,
          communal: 456.05,
        },
        ifdScaleTax: 2_305,
        ifdTax: 2_305,
      },
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
// ICC 2026 (ge-2026-rcepf): 31.50 1'817 (art. 6 al. 2): taxable 72'325; scale (art. 17) 3'149.00 +
// (72'325 - 48'441) x 13.20 % = 23'884 x 0.132 = 3'152.688 -> 3'152.70: 6'301.70. Centimes
// 2'993.3075 -> 2'993.30; reduction 12 % x 9'295.00 = 1'115.40; home care 63.017 -> 63.00;
// cantonal 8'242.60. Communal: privileged 4'852.309 -> 4'852.30 x 44 % = 2'135.012 -> 2'135.00 for
// Thônex; the rest 1'449.40 x 45.49 % = 659.332 -> 659.35 for Genève. ICC 8'242.60 + 2'794.35 + 25
// = 11'061.95.
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
    return {
      2025: e,
      2026: {
        ...e,
        icc: withLines(e.icc, [['31.50', 'p1', -1_817]]),
        taxable: 72_325,
        rate: 72_325,
        base: 6_301.7,
        cc: 2_993.3,
        reduction: 1_115.4,
        homeCare: 63.0,
        cantonal: 8_242.6,
        communal: { privileged: 2_135.0, rest: [0, 659.35] },
        iccTotal: 11_061.95,
      },
    };
  })(),
);

// Travel to work and lunches away from home: ch-2026-ifd-instructions-personnes-physiques p. 6 and
// ch-2026-ifd-progression-deductions p. 1 and 2 (federal 2026: travel at most 3'300; bike or moped
// 700; car 0.75, motorbike 0.40 a km, 0.70 for a car in 2025; meals 15 a day up to 3'200, half
// 7.50 up to 1'600 with box G); ge-2025-guide-declaration-pp p. 11 and 19 to 22 (Geneva: travel at
// most 534 whatever the means; meals only over 2 hours a day by public transport; actual costs
// instead of the flat deduction when higher). Geneva 2026: travel at most 536 (ge-2026-rcepf art. 6
// al. 1); the meal amounts (15 a day, 3'200 a year) are the 2025 ones, an estimate until the 2026
// guide.

// H10. Ribeiro, single, Meyrin: public transport of over 2 hours a day there and back, the pass
// 1'200; lunch away from home on 210 work days, no canteen (box G not ticked).
// ICC: 11.10 80'000; 31.10 -5'200; 31.12 -4'800; 31.40 -7'258. Flat 3 % x 70'000 = 2'100 -> 1'812;
// actual: travel min(1'200, 534) = 534 + meals 210 x 15 = 3'150 (under 3'200) = 3'684, more than
// the flat: 31.70 -534 and 31.60 -3'150, no 31.50. 52.21 -5'000. Taxable 80'000 - 5'200 - 4'800 -
// 7'258 - 534 - 3'150 - 5'000 = 54'058: 3'140.40 + 5'749 x 13.20 % = 758.868 -> 758.85: 3'899.25.
// Centimes 1'852.14375 -> 1'852.15; reduction 12 % x 5'751.40 = 690.168 -> 690.15; home care
// 38.9925 -> 39.00; cantonal 5'100.25. Communal 2025 (Meyrin PP 30 %, CA 42): 1'169.775 ->
// 1'169.80 (half up) x 42 % = 491.316 -> 491.30; rest 2'729.45 x 42 % = 1'146.369 -> 1'146.35.
// ICC 2025: 5'100.25 + 1'637.65 + 25 = 6'762.90.
// ICC 2026 (ge-2026-rcepf): flat 2'100 -> 1'817 (art. 6 al. 2); actual: travel min(1'200, 536) =
// 536 (art. 6 al. 1) + meals 3'150 = 3'686, more than the flat: 31.70 -536 and 31.60 -3'150.
// Taxable 80'000 - 5'200 - 4'800 - 7'258 - 536 - 3'150 - 5'000 = 54'056: scale (art. 17) 3'149.00
// + (54'056 - 48'441) x 13.20 % = 5'615 x 0.132 = 741.18 -> 741.20: 3'890.20. Centimes 1'847.845
// -> 1'847.85; reduction 12 % x 5'738.05 = 688.566 -> 688.55; home care 38.902 -> 38.90; cantonal
// 5'088.40. Communal (PP 29 %, CA 42): 1'128.158 -> 1'128.15 x 42 % = 473.823 -> 473.80; rest
// 2'762.05 x 42 % = 1'160.061 -> 1'160.05. ICC 5'088.40 + 1'633.85 + 25 = 6'747.25.
// IFD (2025 and 2026 alike): 31.20 3 % x 70'000 = 2'100; 31.71 min(1'200, 3'300) = 1'200; 31.60
// 3'150; 52.00 min(5'000, 1'800) = 1'800. Taxable 80'000 - 5'200 - 4'800 - 7'258 - 2'100 - 1'200 -
// 3'150 - 1'800 = 54'492, at 54'400: 229.20 + 109 x 2.64 = 516.96 -> 516.95.
both(
  'H10 Ribeiro, long trip by public transport and lunches away, Meyrin',
  (taxYear) => ({
    taxYear,
    commune: 'meyrin',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [job(80_000, 5_200, 4_800)],
        pillar3a: { value: chf(7_258) },
        commuteMode: { by: 'public_transport' },
        commuteCost: { value: chf(1_200) },
        mealDays: 210,
        mealsIccAllowed: true,
      },
    ],
    household: { healthPremiums: { value: chf(5_000) } },
  }),
  (() => {
    const base = {
      icc: [
        ['11.10', 'p1', 80_000],
        ['31.10', 'p1', -5_200],
        ['31.12', 'p1', -4_800],
        ['31.40', 'p1', -7_258],
        ['31.70', 'p1', -534],
        ['31.60', 'p1', -3_150],
        ['52.21', 'household', -5_000],
      ] as [string, string, number][],
      ifd: [
        ['11.10', 'p1', 80_000],
        ['31.10', 'p1', -5_200],
        ['31.12', 'p1', -4_800],
        ['31.40', 'p1', -7_258],
        ['31.20', 'p1', -2_100],
        ['31.71', 'p1', -1_200],
        ['31.60', 'p1', -3_150],
        ['52.00', 'household', -1_800],
      ] as [string, string, number][],
      personal: 25,
      ifdTaxable: 54_492,
      ifdScaleTax: 516.95,
      ifdTax: 516.95,
    };
    return {
      2025: {
        ...base,
        taxable: 54_058,
        rate: 54_058,
        base: 3_899.25,
        cc: 1_852.15,
        reduction: 690.15,
        homeCare: 39.0,
        cantonal: 5_100.25,
        communal: { privileged: 491.3, rest: [1_146.35] },
        iccTotal: 6_762.9,
      },
      2026: {
        ...base,
        icc: withLines(base.icc, [['31.70', 'p1', -536]]),
        taxable: 54_056,
        rate: 54_056,
        base: 3_890.2,
        cc: 1_847.85,
        reduction: 688.55,
        homeCare: 38.9,
        cantonal: 5_088.4,
        communal: { privileged: 473.8, rest: [1_160.05] },
        iccTotal: 6_747.25,
      },
    };
  })(),
);

// H11. Ribeiro, married, Lancy, no children. A drives 9 km each way on 200 days, with no public
// transport A can use, and lunches away on 200 days with a canteen (box G); B rides a bike and eats
// at home. Health premiums 11'001.
// ICC: A 11.10 95'000, 31.10 -6'200, 31.12 -6'000, 31.40 -7'258; flat 3 % x 82'800 = 2'484 ->
// 1'812, more than the actual costs (travel capped at 534; no meals, the trip isn't one by public
// transport of over 2 hours): 31.50 -1'812. B 21.10 52'000, 41.10 -3'400, 41.12 -2'600, 41.50 3 % x
// 46'000 = 1'380 (more than the bike's 534). Earned A 73'730, B 44'620: 41.95 -1'051. 52.21
// -11'001. Taxable 147'000 - 21'270 - 8'431 - 11'001 = 106'298; full splitting, rate 53'149:
// 3'140.40 + 4'840 x 13.20 % = 638.88 -> 638.90: 3'779.30; base x 2 = 7'558.60. Centimes
// 3'590.335 -> 3'590.35; reduction 12 % x 11'148.95 = 1'337.874 -> 1'337.85; home care 75.586 ->
// 75.60; cantonal 9'886.70. Communal 2025 (Lancy PP 49 %, CA 47): 3'703.714 -> 3'703.70 x 47 % =
// 1'740.739 -> 1'740.75; rest 3'854.90 x 47 % = 1'811.803 -> 1'811.80. ICC 9'886.70 + 3'552.55 +
// 25 = 13'464.25.
// ICC 2026 (ge-2026-rcepf): A's flat 2'484 -> 1'817 (art. 6 al. 2), more than the travel capped at
// 536 (art. 6 al. 1): 31.50 -1'817. B 41.50 1'380 (more than the bike's 536). Earned A 73'725, B
// 44'620: 41.95 -1'054 (art. 10). Taxable 147'000 - 21'275 - 8'434 - 11'001 = 106'290; rate
// 53'145: scale (art. 17) 3'149.00 + (53'145 - 48'441) x 13.20 % = 4'704 x 0.132 = 620.928 ->
// 620.95: 3'769.95; base x 2 = 7'539.90. Centimes 3'581.4525 -> 3'581.45; reduction 12 % x
// 11'121.35 = 1'334.562 -> 1'334.55; home care 75.399 -> 75.40; cantonal 9'862.20. Communal (PP
// 51 %, CA 47): 3'845.349 -> 3'845.35 x 47 % = 1'807.3145 -> 1'807.30; rest 3'694.55 x 47 % =
// 1'736.4385 -> 1'736.45. ICC 9'862.20 + 3'543.75 + 25 = 13'430.95.
// IFD 2026: A 31.20 2'484; 31.71 9 x 2 x 200 x 0.75 = 2'700 (under 3'300); 31.60 200 x 7.50 =
// 1'500 (under 1'600). B 41.20 1'380 -> 2'000; 41.71 the bike's 700. Earned A 68'858, B 43'300:
// 50 % = 21'650 -> 41.90 -14'100. 52.00 3'700; 59.20 2'800. Taxable 147'000 - 26'142 - 22'800 -
// 3'700 - 2'800 = 91'558, at 91'500 (married): 929 + 124 x 4 = 1'425.00.
// IFD 2025: the car at 0.70: 31.71 2'520, so taxable 91'738, at 91'700: 929 + 126 x 4 = 1'433.00.
both(
  'H11 Ribeiro, by car without public transport and by bike, Lancy',
  (taxYear) => ({
    taxYear,
    commune: 'lancy',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [{ ...job(95_000, 6_200, 6_000), canteen: true }],
        pillar3a: { value: chf(7_258) },
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 9, days: 200 },
        mealDays: 200,
        mealsIccAllowed: false,
      },
      {
        id: 'p2',
        employments: [job(52_000, 3_400, 2_600)],
        commuteMode: { by: 'bike' },
        mealDays: 0,
      },
    ],
    household: { healthPremiums: { value: chf(11_001) } },
  }),
  (() => {
    const icc: [string, string, number][] = [
      ['11.10', 'p1', 95_000],
      ['31.10', 'p1', -6_200],
      ['31.12', 'p1', -6_000],
      ['31.40', 'p1', -7_258],
      ['31.50', 'p1', -1_812],
      ['21.10', 'p2', 52_000],
      ['41.10', 'p2', -3_400],
      ['41.12', 'p2', -2_600],
      ['41.50', 'p2', -1_380],
      ['41.95', 'p2', -1_051],
      ['52.21', 'household', -11_001],
    ];
    const ifd = (car: number): [string, string, number][] => [
      ['11.10', 'p1', 95_000],
      ['31.10', 'p1', -6_200],
      ['31.12', 'p1', -6_000],
      ['31.40', 'p1', -7_258],
      ['31.20', 'p1', -2_484],
      ['31.71', 'p1', -car],
      ['31.60', 'p1', -1_500],
      ['21.10', 'p2', 52_000],
      ['41.10', 'p2', -3_400],
      ['41.12', 'p2', -2_600],
      ['41.20', 'p2', -2_000],
      ['41.71', 'p2', -700],
      ['41.90', 'p2', -14_100],
      ['52.00', 'household', -3_700],
      ['59.20', 'household', -2_800],
    ];
    return {
      2025: {
        icc,
        taxable: 106_298,
        rate: 53_149,
        base: 7_558.6,
        cc: 3_590.35,
        reduction: 1_337.85,
        homeCare: 75.6,
        cantonal: 9_886.7,
        communal: { privileged: 1_740.75, rest: [1_811.8] },
        personal: 25,
        iccTotal: 13_464.25,
        ifd: ifd(2_520),
        ifdTaxable: 91_738,
        ifdScaleTax: 1_433,
        ifdTax: 1_433,
      },
      2026: {
        icc: withLines(icc, [
          ['31.50', 'p1', -1_817],
          ['41.95', 'p2', -1_054],
        ]),
        taxable: 106_290,
        rate: 53_145,
        base: 7_539.9,
        cc: 3_581.45,
        reduction: 1_334.55,
        homeCare: 75.4,
        cantonal: 9_862.2,
        communal: { privileged: 1_807.3, rest: [1_736.45] },
        personal: 25,
        iccTotal: 13_430.95,
        ifd: ifd(2_700),
        ifdTaxable: 91_558,
        ifdScaleTax: 1_425,
        ifdTax: 1_425,
      },
    };
  })(),
);

describe('travel and meals: what is said and cited', () => {
  it('explains each line with its numbers, and flags the Geneva pricing of a car', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 'meyrin',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          employments: [job(40_000, 2_600, 1_000)],
          commuteMode: { by: 'car', transitUsable: false, kmOneWay: 30, days: 220 },
          mealDays: 220,
          mealsIccAllowed: true,
        },
      ],
    });
    // 30 x 2 x 220 x 0.75 = 9'900, at most 3'300.
    const ifd71 = r.ifd!.items.find((i) => i.code === '31.71')!;
    expect(ifd71.amount).toBe(chf(-3_300));
    expect(ifd71.how.en).toMatch(
      /30 km x 2 x 220 days x CHF 0\.75 a km = CHF 9’900\.00, at most CHF 3’300\.00/,
    );
    expect(ifd71.sources.join(' ')).toMatch(/ch-2026-ifd-progression-deductions p\. 1/);
    // ICC 2026: travel at most 536 (ge-2026-rcepf art. 6 al. 1) + meals 3'200 (220 x 15 = 3'300,
    // at most 3'200: the 2025 amounts, an estimate) beat the flat 3 % x 36'400 = 1'092.
    expect(r.icc!.items.find((i) => i.code === '31.70')!.amount).toBe(chf(-536));
    const meals = r.icc!.items.find((i) => i.code === '31.60')!;
    expect(meals.amount).toBe(chf(-3_200));
    // The meal amounts are among the two Geneva has not published for 2026: flagged, here without
    // any health premium in the household.
    expect(meals.estimates).toContain('ge-2026-unpublished');
    expect(r.estimates.map((e) => e.id)).toEqual(['ge-2026-unpublished']);
    expect(r.unverifiedRules.map((n) => n.en).join(' ')).toMatch(/prices them as the federal tax/);
  });

  it('says why nothing is counted from home, and that Geneva meals need a long trip', () => {
    const home = computeReturn({
      taxYear: 2026,
      commune: 'meyrin',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [job(60_000, 3_900, 3_000)], commuteMode: { by: 'home' } }],
    });
    expect(home.notCounted.map((n) => n.en).join(' ')).toMatch(/from home almost every day/);
    expect(home.ifd!.items.some((i) => ['31.60', '31.71'].includes(i.code))).toBe(false);
    const short = computeReturn({
      taxYear: 2026,
      commune: 'meyrin',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          employments: [job(60_000, 3_900, 3_000)],
          commuteMode: { by: 'public_transport' },
          commuteCost: { value: chf(500) },
          mealDays: 100,
        },
      ],
    });
    expect(short.notCounted.map((n) => n.en).join(' ')).toMatch(/over 2 hours a day/);
    expect(short.ifd!.items.find((i) => i.code === '31.60')!.amount).toBe(chf(-1_500));
    expect(short.icc!.items.some((i) => i.code === '31.60')).toBe(false);
  });
});
