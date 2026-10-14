// The tariffs against the official documents: the tax per unit the 2025 guide prints for every row
// of its two tables (lu-2025-guide-wegleitung p. 58 and 59) and its worked examples (p. 58 to 60),
// the 2026 guide's examples, and rows of the canton's Berechnungstabelle of each year. The whole of
// both Berechnungstabellen (20,902 rows each) and the Tariftabellen are compared by
// scripts/lu-tariff.mjs --check, which needs the downloaded PDFs.
import { describe, expect, it } from 'vitest';
import {
  luParamsFor,
  stepsTotal,
  unitTaxFraction,
  wealthTaxFraction,
  type UnitTariff,
} from '../src/index.js';

/** Tax per unit in centimes for an income in CHF (already in whole CHF 100). */
const perUnit = (t: UnitTariff, chf: number) => unitTaxFraction(t, chf * 100) / 10_000;
const c = (francs: number) => Math.round(francs * 100);

describe('the tariffs as the law prints them', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the steps end where the rate on the whole income starts, and the rates rise`, () => {
      const P = luParamsFor(year);
      for (const t of [P.incomeTariff.single.value, P.incomeTariff.family.value]) {
        expect(stepsTotal(t)).toBe(t.flatAbove);
        const rates = t.steps.map(([, r]) => r);
        expect([...rates].sort((a, b) => a - b)).toEqual(rates);
      }
    });
  }

  it('2025 single: continuous where the rate on the whole income starts', () => {
    const t = luParamsFor(2025).incomeTariff.single.value;
    // lu-2025-guide-wegleitung p. 58: 2,093,000 -> 119,301.00; 2,093,100 -> 119,306.70 (5.7 %).
    expect(perUnit(t, 2_093_000)).toBe(c(119_301));
    expect(perUnit(t, 2_093_100)).toBe(c(119_306.7));
  });

  it('2025 family: the law’s 5.6 % on the whole income starts 10 centimes below the steps’ sum', () => {
    const t = luParamsFor(2025).incomeTariff.family.value;
    // Steps at 1,424,300: 79,760.90 (p. 59); 5.6 % of 1,424,300 would be 79,760.80. Above it,
    // 5.6 % of the whole income: 1,424,400 -> 79,766.40, as the Berechnungstabelle prints it
    // (lu-2025-tariff-berechnungstabelle-einkommen p. 273). The guide prints 79,766.50 (p. 59):
    // docs/sources/lu/NOTES.md, Open points.
    expect(perUnit(t, 1_424_300)).toBe(c(79_760.9));
    expect(perUnit(t, 1_424_400)).toBe(c(79_766.4));
  });
});

describe('lu-2025-guide-wegleitung p. 58: Tabelle Alleinstehende', () => {
  // Every row as printed: [taxable income, tax per unit].
  const ROWS: [number, number][] = [
    [9_900, 0],
    [10_000, 0.5],
    [10_100, 1],
    [12_100, 11],
    [12_200, 11.5],
    [12_300, 12],
    [12_400, 13],
    [12_500, 14],
    [13_000, 19],
    [13_500, 24],
    [14_000, 29],
    [14_500, 34],
    [15_000, 39],
    [15_500, 44],
    [15_600, 46],
    [16_000, 54],
    [16_100, 56],
    [16_200, 58],
    [16_300, 60],
    [16_400, 62],
    [16_500, 64],
    [16_600, 66],
    [16_700, 69],
    [17_000, 78],
    [17_500, 93],
    [17_800, 102],
    [17_900, 106],
    [18_000, 110],
    [18_500, 130],
    [19_000, 150],
    [19_500, 170],
    [20_000, 190],
    [20_700, 218],
    [20_800, 222.5],
    [21_000, 231.5],
    [21_500, 254],
    [22_000, 276.5],
    [22_500, 299],
    [23_000, 321.5],
    [23_500, 344],
    [24_000, 366.5],
    [24_500, 389],
    [25_000, 411.5],
    [25_100, 416.5],
    [25_500, 436.5],
    [26_000, 461.5],
    [27_000, 511.5],
    [28_000, 561.5],
    [29_000, 611.5],
    [30_000, 661.5],
    [40_000, 1_161.5],
    [50_000, 1_661.5],
    [60_000, 2_161.5],
    [70_000, 2_661.5],
    [80_000, 3_161.5],
    [90_000, 3_661.5],
    [100_000, 4_161.5],
    [105_000, 4_411.5],
    [110_000, 4_661.5],
    [110_100, 4_666.75],
    [120_000, 5_186.5],
    [130_000, 5_711.5],
    [140_000, 6_236.5],
    [150_000, 6_761.5],
    [160_000, 7_286.5],
    [163_800, 7_486],
    [163_900, 7_491.5],
    [165_000, 7_552],
    [170_000, 7_827],
    [180_000, 8_377],
    [190_000, 8_927],
    [190_100, 8_932.8],
    [200_000, 9_507],
    [300_000, 15_307],
    [400_000, 21_107],
    [500_000, 26_907],
    [600_000, 32_707],
    [700_000, 38_507],
    [800_000, 44_307],
    [1_000_000, 55_907],
    [1_500_000, 84_907],
    [2_000_000, 113_907],
    [2_093_000, 119_301],
    [2_093_100, 119_306.7],
    [2_500_000, 142_500],
  ];
  const t = luParamsFor(2025).incomeTariff.single.value;
  it.each(ROWS)('CHF %i: %d per unit', (chf, tax) => {
    expect(perUnit(t, chf)).toBe(c(tax));
  });

  it('four rows print the tax of another income: the law and the Berechnungstabelle agree', () => {
    // The guide prints 10,500: 1.50; 11,000: 3.50; 11,500: 6.00; 12,000: 8.50, which are the taxes
    // of 10,200, 10,600, 11,100 and 11,600. § 57 Abs. 1 and the Berechnungstabelle (p. 1) give
    // 3.00, 5.50, 8.00 and 10.50 (docs/sources/lu/NOTES.md, Open points).
    expect([10_500, 11_000, 11_500, 12_000].map((x) => perUnit(t, x))).toEqual(
      [3, 5.5, 8, 10.5].map(c),
    );
    expect([10_200, 10_600, 11_100, 11_600].map((x) => perUnit(t, x))).toEqual(
      [1.5, 3.5, 6, 8.5].map(c),
    );
  });
});

describe('lu-2025-guide-wegleitung p. 59: Tabelle Familien', () => {
  const ROWS: [number, number][] = [
    [19_900, 0],
    [20_000, 0.5],
    [20_500, 3],
    [21_000, 5.5],
    [21_500, 8],
    [22_000, 10.5],
    [22_500, 13],
    [23_000, 15.5],
    [23_500, 18],
    [24_000, 20.5],
    [24_100, 22],
    [24_200, 23.5],
    [24_300, 25],
    [24_400, 26.5],
    [24_500, 28],
    [25_000, 35.5],
    [25_100, 38],
    [25_200, 40.5],
    [25_300, 43],
    [25_400, 45.5],
    [25_500, 48],
    [26_000, 60.5],
    [26_200, 65.5],
    [26_300, 68.5],
    [26_400, 71.5],
    [26_500, 74.5],
    [27_000, 89.5],
    [27_500, 104.5],
    [28_000, 119.5],
    [28_300, 128.5],
    [28_400, 132],
    [28_500, 135.5],
    [29_000, 153],
    [29_500, 170.5],
    [30_000, 188],
    [30_500, 205.5],
    [31_000, 223],
    [31_500, 240.5],
    [32_000, 258],
    [32_500, 275.5],
    [32_600, 280],
    [33_000, 298],
    [34_000, 343],
    [35_000, 388],
    [40_000, 613],
    [45_000, 838],
    [50_000, 1_063],
    [55_000, 1_288],
    [60_000, 1_513],
    [65_000, 1_738],
    [70_000, 1_963],
    [75_000, 2_188],
    [80_000, 2_413],
    [85_000, 2_638],
    [90_000, 2_863],
    [95_000, 3_088],
    [99_000, 3_268],
    [99_100, 3_273],
    [100_000, 3_318],
    [110_000, 3_818],
    [120_000, 4_318],
    [130_000, 4_818],
    [135_000, 5_068],
    [137_900, 5_213],
    [138_000, 5_218.5],
    [140_000, 5_328.5],
    [145_000, 5_603.5],
    [150_000, 5_878.5],
    [159_000, 6_373.5],
    [159_100, 6_379.3],
    [160_000, 6_431.5],
    [170_000, 7_011.5],
    [180_000, 7_591.5],
    [190_000, 8_171.5],
    [200_000, 8_751.5],
    [300_000, 14_551.5],
    [400_000, 20_351.5],
    [500_000, 26_151.5],
    [600_000, 31_951.5],
    [700_000, 37_751.5],
    [800_000, 43_551.5],
    [900_000, 49_351.5],
    [1_000_000, 55_151.5],
    [1_100_000, 60_951.5],
    [1_200_000, 66_751.5],
    [1_300_000, 72_551.5],
    [1_424_300, 79_760.9],
    [1_500_000, 84_000],
    [2_000_000, 112_000],
  ];
  const t = luParamsFor(2025).incomeTariff.family.value;
  it.each(ROWS)('CHF %i: %d per unit', (chf, tax) => {
    expect(perUnit(t, chf)).toBe(c(tax));
  });
});

describe('the worked examples', () => {
  it('lu-2025-guide-wegleitung p. 58: single, CHF 60,800 -> 2,201.50 per unit; x 3.75 units', () => {
    const tax = perUnit(luParamsFor(2025).incomeTariff.single.value, 60_800);
    expect(tax).toBe(c(2_201.5));
    // 2,201.50 x 3.75 = 8,255.625 exactly; the guide prints 8,255.65 (NOTE.rounding).
    expect((tax * 37_500) / 10_000).toBe(825_562.5); // centimes
  });

  it('lu-2025-guide-wegleitung p. 59: family, CHF 78,800 -> 2,359.00 per unit; x 3.75 = 8,846.25', () => {
    const tax = perUnit(luParamsFor(2025).incomeTariff.family.value, 78_800);
    expect(tax).toBe(c(2_359));
    expect((tax * 37_500) / 10_000).toBe(c(8_846.25));
  });

  it('lu-2025-guide-wegleitung p. 60: wealth CHF 74,000 -> 55.50 per unit; x 3.75', () => {
    const w = luParamsFor(2025).wealthTariff.value;
    const tax = wealthTaxFraction(w, c(74_000)) / 100_000;
    expect(tax).toBe(c(55.5));
    // 55.50 x 3.75 = 208.125 exactly; the guide prints 208.10 (NOTE.rounding).
    expect((tax * 37_500) / 10_000).toBe(20_812.5); // centimes
  });

  it('lu-2026-guide-wegleitung-unterjaehrig p. 58 and 59: the same incomes in 2026', () => {
    const P = luParamsFor(2026);
    // Single: 60,000 -> 2,158.50 in the table, + 5 % of 800 = 2,198.50; x 3.65 = 8,024.525, printed 8,024.50.
    expect(perUnit(P.incomeTariff.single.value, 60_000)).toBe(c(2_158.5));
    expect(perUnit(P.incomeTariff.single.value, 60_800)).toBe(c(2_198.5));
    // Family: 75,000 -> 2,188 + 4.5 % of 3,800 = 2,359.00.
    expect(perUnit(P.incomeTariff.family.value, 78_800)).toBe(c(2_359));
  });
});

describe('rows of the Berechnungstabelle', () => {
  const rows: [2025 | 2026, number, number, number, string][] = [
    // [year, income, single, family, page]
    [2025, 10_200, 1.5, 0, 'lu-2025-tariff-berechnungstabelle-einkommen p. 1'],
    [2025, 60_000, 2_161.5, 1_513, 'p. 10'],
    [2025, 100_000, 4_161.5, 3_318, 'p. 18'],
    [2025, 1_424_400, 80_522.2, 79_766.4, 'p. 273'],
    [2025, 2_093_000, 119_301, 117_208, 'p. 401'],
    [2026, 16_700, 68, 0, 'lu-2026-tariff-berechnungstabelle-einkommen p. 2'],
    [2026, 60_000, 2_158.5, 1_513, 'p. 10'],
    [2026, 100_000, 4_158.5, 3_317, 'p. 18'],
    [2026, 1_425_500, 80_582.2, 79_827.9, 'p. 273'],
    [2026, 1_425_600, 80_588, 79_833.6, 'p. 273'],
    [2026, 2_096_800, 119_517.6, 117_420.8, 'p. 402'],
    [2026, 2_096_900, 119_523.3, 117_426.4, 'p. 402'],
  ];
  it.each(rows)('%i, CHF %i: single %d, family %d (%s)', (year, chf, single, family) => {
    const P = luParamsFor(year);
    expect(perUnit(P.incomeTariff.single.value, chf)).toBe(c(single));
    expect(perUnit(P.incomeTariff.family.value, chf)).toBe(c(family));
  });
});

it('no tariff for another year', () => {
  expect(() => luParamsFor(2024)).toThrow(RangeError);
  expect(() => luParamsFor(2027)).toThrow(RangeError);
});
