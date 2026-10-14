// The tariffs against the canton's own tables: rows read in the 2025 tariff book
// (bs-2025-tariff-einkommens-vermoegenssteuer) and in the 2026 guide's tables
// (bs-2026-guide-wegleitung-b p. 44 to 49), with their page. Every row of both (income CHF 100 to
// 248,000 in tariff A and to 540,000 in tariff B; wealth CHF 1,000 to 2,500,000 and to 4,300,000)
// was compared with the brackets when they were written: all equal. Above the tables, the rule the
// tables state: CHF 27.25, then CHF 28.25 per further CHF 100.
import { describe, expect, it } from 'vitest';
import { bsParamsFor, tariffTax } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const HUNDRED = 10_000;
const THOUSAND = 100_000;

// [amount in CHF, tax in CHF as printed, page]
type Rows = [number, number, number][];
const INCOME: Record<2025 | 2026, { A: Rows; B: Rows }> = {
  2025: {
    A: [
      [100, 21, 3],
      [30_000, 6_300, 3],
      [30_200, 6_342, 4],
      [183_000, 38_430, 4],
      [212_000, 44_520, 5],
      [213_000, 44_761.25, 5],
      [219_000, 46_396.25, 5],
      [248_000, 54_298.75, 5],
    ],
    B: [
      [100, 21, 6],
      [60_000, 12_600, 7],
      [420_000, 88_200, 8],
      [425_000, 89_256.25, 8],
      [440_000, 93_343.75, 8],
      [540_000, 120_593.75, 8],
    ],
  },
  2026: {
    A: [
      [100, 21, 44],
      [37_800, 7_938, 44],
      [191_000, 40_110, 45],
      [228_000, 48_848.75, 45],
      [245_000, 53_481.25, 45],
    ],
    B: [
      [100, 21, 46],
      [48_000, 10_080, 46],
      [348_000, 73_080, 47],
      [445_000, 94_706.25, 47],
    ],
  },
};

const WEALTH: Record<2025 | 2026, { A: Rows; B: Rows }> = {
  2025: {
    A: [
      [1_000, 4.5, 9],
      [250_000, 1_125, 9],
      [255_000, 1_157.5, 9],
      [750_000, 4_375, 9],
      [760_000, 4_454, 9],
      [1_000_000, 6_350, 9],
      [2_500_000, 18_200, 9],
    ],
    B: [
      [400_000, 1_800, 10],
      [405_000, 1_832.5, 10],
      [1_200_000, 7_000, 10],
      [1_210_000, 7_079, 10],
      [4_000_000, 29_120, 10],
      [4_300_000, 31_490, 10],
    ],
  },
  2026: {
    A: [
      [1_000, 4.5, 48],
      [465_000, 2_522.5, 48],
      [1_020_000, 6_508, 48],
      [1_470_000, 10_063, 48],
    ],
    B: [
      [465_000, 2_222.5, 49],
      [655_000, 3_457.5, 49],
      [1_270_000, 7_553, 49],
      [2_050_000, 13_715, 49],
    ],
  },
};

const where = (year: 2025 | 2026, page: number) =>
  year === 2025
    ? `bs-2025-tariff-einkommens-vermoegenssteuer p. ${page}`
    : `bs-2026-guide-wegleitung-b p. ${page}`;

describe('the income tariffs against the canton’s tables', () => {
  for (const year of [2025, 2026] as const) {
    const P = bsParamsFor(year);
    for (const tariff of ['A', 'B'] as const) {
      for (const [income, tax, page] of INCOME[year][tariff]) {
        it(`${year}, tariff ${tariff}: CHF ${income} gives CHF ${tax} (${where(year, page)})`, () => {
          expect(tariffTax(P.income[tariff].value, chf(income), HUNDRED)).toBe(chf(tax));
        });
      }
    }
  }

  it('drops the rest under CHF 100 (StG § 36 al. 3): 54,103 is taxed as 54,100', () => {
    const scale = bsParamsFor(2025).income.B.value;
    expect(tariffTax(scale, chf(54_103), HUNDRED)).toBe(chf(11_361));
    expect(tariffTax(scale, chf(99), HUNDRED)).toBe(0);
  });

  it('above the tables: CHF 27.25, then CHF 28.25 per further CHF 100 (p. 5 and 8)', () => {
    for (const year of [2025, 2026] as const) {
      const P = bsParamsFor(year);
      // A: 212,500 x 21 % = 44,625; 103,800 x 27.25 % = 28,285.50; 83,700 x 28.25 % = 23,645.25.
      expect(tariffTax(P.income.A.value, chf(400_000), HUNDRED)).toBe(chf(96_555.75));
      // B: 424,900 x 21 % = 89,229; 207,600 x 27.25 % = 56,571; 67,500 x 28.25 % = 19,068.75.
      expect(tariffTax(P.income.B.value, chf(700_000), HUNDRED)).toBe(chf(164_868.75));
    }
  });
});

describe('the wealth tariffs against the canton’s tables', () => {
  for (const year of [2025, 2026] as const) {
    const P = bsParamsFor(year);
    for (const tariff of ['A', 'B'] as const) {
      for (const [wealth, tax, page] of WEALTH[year][tariff]) {
        it(`${year}, tariff ${tariff}: CHF ${wealth} gives CHF ${tax} (${where(year, page)})`, () => {
          expect(tariffTax(P.wealth[tariff].value, chf(wealth), THOUSAND)).toBe(chf(tax));
        });
      }
    }
  }

  it('drops the rest under CHF 1,000 (StG § 50 al. 3)', () => {
    const scale = bsParamsFor(2025).wealth.A.value;
    expect(tariffTax(scale, chf(26_999), THOUSAND)).toBe(chf(117));
  });
});
