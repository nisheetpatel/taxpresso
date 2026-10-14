// The official examples and tables of the 2025 guide (fr-2025-guide-instructions-generales; "p." is
// the PDF page, the guide prints one less), checked against the engine's rules: the splitting
// example (p. 39), the extract of the income tariff (p. 45 and 46), the wealth table (p. 46), the
// child deduction tables (p. 35), the modest income tables (p. 37 and 38), the social deduction on
// wealth (p. 39) and the flat health insurance amounts (p. 24). The guide has no full worked
// return; the synthetic households (households.test.ts) chain these rules.
import { describe, expect, it } from 'vitest';
import {
  assess,
  childAmounts,
  frParamsFor,
  incomeBaseTax,
  incomeRate,
  rateIncome,
  tapered,
  wealthBaseTax,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const P = frParamsFor(2025);
const A = P.amounts;
const scale = P.incomeScale.value;

describe('guide p. 39 (code 7.910): the rate of half the income for couples and single parents', () => {
  it('40,000 taxed at the rate of 20,000', () => {
    // "Si le revenu global imposable est de 40'000 fr., l'imposition se fera sur ce revenu, mais au
    // taux d'imposition correspondant à un revenu de 20'000 fr." 20,000: 4.1745 % + 25 x 0.0147 =
    // 4.5420 %; 40,000 x 4.5420 % = 1,816.80, the guide's extract (p. 45).
    expect(rateIncome(scale, chf(40_000), true)).toBe(chf(20_000));
    expect(incomeRate(scale, chf(40_000), true)).toBe(incomeRate(scale, chf(20_000), false));
    expect(incomeRate(scale, chf(40_000), true)).toBe(45_420);
    expect(incomeBaseTax(scale, chf(40_000), true)).toBe(chf(1_816.8));
  });
});

describe('guide p. 45 and 46: the income tax at 100 % (cote d’impôt cantonal de base)', () => {
  // [taxable income, single person, married couples and single parents], as printed.
  const EXTRACT: [number, number, number][] = [
    [5_200, 52.0, 52.0],
    [10_000, 224.3, 100.0],
    [11_000, 275.25, 118.55],
    [25_000, 1_319.25, 722.65],
    [40_000, 2_857.1, 1_816.8],
    [44_000, 3_332.85, 2_127.85],
    [50_000, 4_076.25, 2_638.5],
    [55_000, 4_673.6, 3_104.45],
    [75_000, 7_365.75, 5_154.5],
    [100_000, 10_791.0, 8_152.5],
    [150_000, 18_534.3, 14_731.5],
    [180_000, 23_557.5, 18_775.8],
    [250_000, 33_750.0, 28_997.5],
    [400_000, 54_000.0, 53_578.8],
    [414_100, 55_903.5, 55_902.25],
  ];
  it('every row of the selection, both columns', () => {
    for (const [income, single, family] of EXTRACT) {
      expect(incomeBaseTax(scale, chf(income), false), `${income} single`).toBe(chf(single));
      expect(incomeBaseTax(scale, chf(income), true), `${income} family`).toBe(chf(family));
    }
  });

  it('the cantonal tax is 96 % of it (p. 45; the 2025 coefficient law)', () => {
    expect(P.coefficients.value).toEqual({ income: 9_600, wealth: 10_000 });
  });
});

describe('guide p. 46: the wealth tax at 100 %', () => {
  // [taxable wealth, cote at 100 %], the rows of the table, and the average rate in per mille.
  const ROWS: [number, number, number][] = [
    [50_000, 25, 0.5],
    [100_000, 80, 0.8],
    [200_000, 260, 1.3],
    [400_000, 760, 1.9],
    [700_000, 1_690, 2.41],
    [1_000_000, 2_740, 2.74],
    [1_200_000, 3_480, 2.9],
  ];
  it('the cote at each bracket, and its average rate to two decimals', () => {
    for (const [wealth, cote, average] of ROWS) {
      const tax = wealthBaseTax(P.wealthScale.value, chf(wealth));
      expect(tax, String(wealth)).toBe(chf(cote));
      expect(Math.round((tax / chf(wealth)) * 100_000) / 100, String(wealth)).toBe(average);
    }
  });

  it('the communal and church taxes are percentages of the base tax (p. 46, LICo art. 3 al. 3)', () => {
    // Bulle 74.3 % (fr-2025-communal-coefficients-opendata): an income base tax of 1,816.80 gives
    // 1,349.88 communal, 1,349.90 to 5 centimes.
    const r = assess({
      taxYear: 2025,
      commune: 'Bulle',
      family: true,
      incomeItems: [{ code: '1.110', person: 'p1', amount: chf(40_000) }],
      wealthItems: [],
    });
    expect(r.taxes.incomeBase.amount).toBe(chf(1_816.8));
    expect(r.taxes.cantonalIncome.amount).toBe(chf(1_744.15));
    expect(r.taxes.communalIncome.amount).toBe(chf(1_349.9));
  });
});

describe('guide p. 35 (code 6.110): child deductions by net income (code 4.910)', () => {
  const c = A.children.value;
  const total = (n: number, net: number) => childAmounts(c, n, chf(net)).reduce((s, a) => s + a, 0);
  it('one child', () => {
    expect(total(1, 62_700)).toBe(chf(8_600));
    expect(total(1, 62_701)).toBe(chf(8_500));
    expect(total(1, 63_700)).toBe(chf(8_500));
    expect(total(1, 66_000)).toBe(chf(8_200));
    expect(total(1, 75_701)).toBe(chf(7_200));
    expect(total(1, 76_701)).toBe(chf(7_100));
    expect(total(1, 150_000)).toBe(chf(7_100));
  });
  it('two children', () => {
    expect(total(2, 72_800)).toBe(chf(17_200));
    expect(total(2, 72_801)).toBe(chf(17_000));
    expect(total(2, 80_000)).toBe(chf(15_600));
    expect(total(2, 86_801)).toBe(chf(14_200));
  });
  it('three children: from the third, 9,600 at most and 8,100 at least', () => {
    expect(total(3, 82_900)).toBe(chf(26_800));
    expect(total(3, 90_000)).toBe(chf(24_400));
    expect(total(3, 96_901)).toBe(chf(22_300));
  });
  it('four children', () => {
    expect(total(4, 93_000)).toBe(chf(36_400));
    expect(total(4, 100_500)).toBe(chf(33_200));
    expect(total(4, 107_001)).toBe(chf(30_400));
  });
});

describe('guide p. 37 and 38 (code 7.110): the modest income deduction by income (code 6.910)', () => {
  const m = A.modest.value;
  const d = (p: Parameters<typeof tapered>[0], income: number) => tapered(p, chf(income));
  it('AVS/AI beneficiaries, married or with children', () => {
    expect(d(m.avsCharges, 30_300)).toBe(chf(11_100));
    expect(d(m.avsCharges, 30_301)).toBe(chf(10_700));
    expect(d(m.avsCharges, 57_000)).toBe(chf(300));
    expect(d(m.avsCharges, 57_301)).toBe(0);
  });
  it('AVS/AI beneficiaries living alone without children', () => {
    expect(d(m.avsSingle, 24_300)).toBe(chf(9_100));
    expect(d(m.avsSingle, 25_000)).toBe(chf(8_800));
    expect(d(m.avsSingle, 54_000)).toBe(chf(100));
    expect(d(m.avsSingle, 54_301)).toBe(0);
  });
  it('others living alone without children', () => {
    expect(d(m.single, 20_300)).toBe(chf(4_100));
    expect(d(m.single, 21_000)).toBe(chf(3_900));
    expect(d(m.single, 40_300)).toBe(chf(100));
    expect(d(m.single, 40_301)).toBe(0);
  });
  it('others, married or with children', () => {
    expect(d(m.charges, 24_300)).toBe(chf(5_100));
    expect(d(m.charges, 24_301)).toBe(chf(4_900));
    expect(d(m.charges, 49_300)).toBe(chf(100));
    expect(d(m.charges, 49_301)).toBe(0);
  });
});

describe('guide p. 39 (code 7.110, wealth): the social deduction on net wealth (code 6.910)', () => {
  const w = A.wealthDeduction.value;
  it('people living alone without children', () => {
    expect(tapered(w.single, chf(75_000))).toBe(chf(55_000));
    expect(tapered(w.single, chf(75_001))).toBe(chf(45_000));
    expect(tapered(w.single, chf(100_000))).toBe(chf(45_000));
    expect(tapered(w.single, chf(190_000))).toBe(chf(5_000));
    expect(tapered(w.single, chf(200_001))).toBe(0);
  });
  it('married couples and single parents', () => {
    expect(tapered(w.family, chf(125_000))).toBe(chf(105_000));
    expect(tapered(w.family, chf(125_001))).toBe(chf(85_000));
    expect(tapered(w.family, chf(280_000))).toBe(chf(5_000));
    expect(tapered(w.family, chf(300_001))).toBe(0);
  });
});

describe('guide p. 24 (code 4.110) and the ordinance: the flat health insurance amounts', () => {
  it('4,810 an adult (9,620 for spouses), 4,210 a young adult in training, 1,140 a child', () => {
    expect(A.health.value).toEqual({ adult: chf(4_810), young: chf(4_210), child: chf(1_140) });
    expect(frParamsFor(2026).amounts.health.value).toEqual(A.health.value);
  });
});

describe('the SCC’s child deduction calculators (sheet Paramètres) give the law’s amounts', () => {
  it('2025 and 2026: 8,600, 9,600 from the third child, limit 62,700 plus 10,100 a child, 100 less per started 1,000, at most 1,500 less', () => {
    for (const year of [2025, 2026] as const) {
      const c = frParamsFor(year).amounts.children.value;
      expect(c.first).toBe(chf(8_600));
      expect(c.fromThird).toBe(chf(9_600));
      expect(c.limit).toBe(chf(62_700));
      expect(c.perChild).toBe(chf(10_100));
      expect(c.cut).toBe(chf(100));
      expect(c.first - c.minFirst).toBe(chf(1_500));
      expect(c.fromThird - c.minFromThird).toBe(chf(1_500));
    }
  });
});
