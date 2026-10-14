// The scales against the canton's detailed tables of the base tax (vd-<year>-tariff-revenu, every
// CHF 100 up to 300,000; vd-<year>-tariff-fortune, every CHF 1,000 from 50,000 to 2,000,000): rows
// read in the tables, with their page. Every one of the 3,000 income rows of each year, and every
// wealth row from CHF 60,000 (the first taxed amount), was compared with the summary steps when
// the scales were written: all equal, the wealth rows rounded to 5 centimes as printed.
import { describe, expect, it } from 'vitest';
import { scaleTax, vdParamsFor } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

// [taxable amount in CHF, base tax in CHF as printed, page of the table]
const INCOME: Record<2025 | 2026, [number, number, number][]> = {
  2025: [
    [100, 1, 1],
    [1_600, 16, 1],
    [1_700, 18, 1],
    [3_400, 52, 1],
    [17_200, 750, 2],
    [20_700, 995, 3],
    [48_200, 3_243, 5],
    [74_300, 5_763, 8],
    [74_400, 5_774, 8],
    [108_100, 9_651.5, 11],
    [122_200, 11_414, 13],
    [192_500, 20_643.5, 20],
    [256_000, 29_700.5, 26],
    [291_700, 35_057, 30],
    [300_000, 36_343.5, 30],
  ],
  2026: [
    [100, 1, 1],
    [1_700, 18, 1],
    [17_200, 750, 2],
    [20_700, 995, 3],
    [57_200, 4_053, 6],
    [74_400, 5_773, 8],
    [91_100, 7_610, 10],
    [108_000, 9_637, 11],
    [122_200, 11_411.5, 13],
    [134_900, 12_999, 14],
    [192_300, 20_612, 20],
    [255_800, 29_665, 26],
    [291_400, 35_004, 30],
    [300_000, 36_335.5, 30],
  ],
};

const WEALTH: Record<2025 | 2026, [number, number, number][]> = {
  2025: [
    [60_000, 32.65, 1],
    [61_000, 33.6, 1],
    [95_000, 66.6, 1],
    [120_000, 108.85, 1],
    [177_000, 205.2, 2],
    [355_000, 635.95, 4],
    [710_000, 1_754.2, 7],
    [711_000, 1_757.6, 7],
    [1_000_000, 2_737.3, 10],
    [1_999_000, 6_123.9, 20],
  ],
  2026: [
    [60_000, 32.65, 1],
    [61_000, 33.6, 1],
    [120_000, 108.85, 1],
    [355_000, 635.95, 4],
    [710_000, 1_754.2, 7],
    [711_000, 1_757.35, 7],
    [712_000, 1_760.75, 7],
    [1_000_000, 2_737.05, 10],
    [1_999_000, 6_123.65, 20],
  ],
};

describe('the income scale against the canton’s tables', () => {
  for (const year of [2025, 2026] as const) {
    const scale = vdParamsFor(year).incomeScale.value;
    for (const [income, tax, page] of INCOME[year]) {
      it(`${year}: CHF ${income} gives CHF ${tax} (vd-${year}-tariff-revenu p. ${page})`, () => {
        expect(scaleTax(scale, chf(income))).toBe(chf(tax));
      });
    }
  }

  it('drops fractions under CHF 100 (LI art. 46) and taxes nothing under CHF 100', () => {
    const scale = vdParamsFor(2025).incomeScale.value;
    // 20,799.99 is taxed as 20,700; 20,800 one step further, 7.00 more.
    expect(scaleTax(scale, chf(20_799.99))).toBe(chf(995));
    expect(scaleTax(scale, chf(20_800))).toBe(chf(995 + 7));
    expect(scaleTax(scale, chf(99))).toBe(0);
    expect(scaleTax(scale, 0)).toBe(0);
  });

  it('above CHF 300,000, 15.5 % of every further CHF 100 (tariff p. 31)', () => {
    for (const year of [2025, 2026] as const) {
      const scale = vdParamsFor(year).incomeScale.value;
      expect(scaleTax(scale, chf(1_000_100)) - scaleTax(scale, chf(1_000_000))).toBe(chf(15.5));
    }
  });
});

describe('the wealth scale against the canton’s tables', () => {
  for (const year of [2025, 2026] as const) {
    const scale = vdParamsFor(year).wealthScale.value;
    for (const [wealth, tax, page] of WEALTH[year]) {
      it(`${year}: CHF ${wealth} gives CHF ${tax} (vd-${year}-tariff-fortune p. ${page})`, () => {
        expect(scaleTax(scale, chf(wealth))).toBe(chf(tax));
      });
    }
  }

  it('in whole CHF 1,000 (LI art. 59 al. 3), rounded to 5 centimes as the tables print', () => {
    const scale = vdParamsFor(2025).wealthScale.value;
    // 60,000 + 1,000 at 0.97 per mille = 33.62, printed 33.60.
    expect(scaleTax(scale, chf(61_999))).toBe(chf(33.6));
  });
});

describe('the coefficients', () => {
  it('cantonal coefficient 155 % in 2025 and 2026 (annual tax law art. 2)', () => {
    expect(vdParamsFor(2025).cantonalCoefficient.value).toBe(15_500);
    expect(vdParamsFor(2026).cantonalCoefficient.value).toBe(15_500);
  });

  it('LRIPP reduction of the cantonal base income tax: 4 % in 2025, 5 % in 2026 (art. 4)', () => {
    expect(vdParamsFor(2025).lrippReductionBp.value).toBe(400);
    expect(vdParamsFor(2026).lrippReductionBp.value).toBe(500);
  });

  it('fails closed for another year', () => {
    expect(() => vdParamsFor(2024)).toThrow(RangeError);
    expect(() => vdParamsFor(2027)).toThrow(/not supported/);
  });
});
