// The scales against the SCC's tariffs: rows read in the detailed income tariff
// (fr-<year>-bareme-revenu, every CHF 100 from 5,200 to 414,200, two columns), with their page, and
// the wealth tariff's brackets (fr-<year>-bareme-fortune). Every one of the 4,091 income rows, both
// columns, is compared by scripts/fr-tariff.mjs --check (the PDF stays on the developer's computer):
// all rates equal, and every tax equal to income x rate rounded to 5 centimes except the 19 exact
// halves the table rounds down, which the scale lists.
import { describe, expect, it } from 'vitest';
import {
  classRate,
  frParamsFor,
  incomeBaseTax,
  incomeRate,
  rateIncome,
  wealthBaseTax,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

// [taxable income in CHF, single rate %, single tax CHF, family rate %, family tax CHF, page]
const ROWS: [number, number, number, number, number, number][] = [
  [5_200, 1.0, 52.0, 1.0, 52.0, 1],
  [5_300, 1.0259, 54.35, 1.0, 53.0, 1],
  [10_400, 2.3468, 244.05, 1.0, 104.0, 2],
  [10_600, 2.3986, 254.25, 1.0259, 108.75, 2],
  [12_500, 2.8907, 361.35, 1.259, 157.35, 3],
  [17_400, 4.1598, 723.8, 1.9065, 331.75, 4],
  [17_500, 4.1745, 730.55, 1.9065, 333.65, 4],
  [31_300, 6.2031, 1_941.55, 3.6936, 1_156.1, 8],
  [31_400, 6.2139, 1_951.15, 3.7195, 1_167.9, 8],
  [48_200, 8.0283, 3_869.65, 5.1447, 2_479.75, 12],
  [48_300, 8.0352, 3_881.0, 5.1447, 2_484.9, 12],
  [63_700, 9.0978, 5_795.3, 6.2571, 3_985.75, 16],
  [63_800, 9.1042, 5_808.5, 6.2679, 3_998.9, 16],
  [77_500, 9.981, 7_735.25, 7.0023, 5_426.8, 20],
  [77_600, 9.9846, 7_748.05, 7.0131, 5_442.15, 20],
  [102_000, 10.863, 11_080.25, 8.2215, 8_385.95, 26],
  [102_100, 10.8662, 11_094.4, 8.2215, 8_394.15, 26],
  [128_600, 11.7142, 15_064.45, 9.1362, 11_749.15, 33],
  [128_700, 11.7172, 15_080.05, 9.1362, 11_758.3, 33],
  [155_900, 12.5332, 19_539.25, 9.9954, 15_582.85, 40],
  [156_000, 12.5355, 19_555.4, 9.999, 15_598.45, 40],
  [180_900, 13.1082, 23_712.75, 10.4454, 18_895.75, 46],
  [181_000, 13.1097, 23_728.55, 10.449, 18_912.7, 46],
  [207_000, 13.4997, 27_944.4, 10.911, 22_585.75, 53],
  [207_100, 13.5, 27_958.5, 10.911, 22_596.7, 53],
  [211_100, 13.5, 28_498.5, 10.975, 23_168.2, 54],
  [250_000, 13.5, 33_750.0, 11.599, 28_997.5, 64],
  [300_000, 13.5, 40_500.0, 12.3562, 37_068.6, 77],
  [414_100, 13.5, 55_903.5, 13.4997, 55_902.25, 106],
  [414_200, 13.5, 55_917.0, 13.5, 55_917.0, 106],
];

describe('income scale (LICD art. 37, detailed tariff)', () => {
  for (const year of [2025, 2026] as const) {
    const scale = frParamsFor(year).incomeScale.value;
    it(`${year}: rates and taxes of the tariff's rows, both columns`, () => {
      for (const [income, rs, ts, rf, tf, page] of ROWS) {
        const at = `CHF ${income} (p. ${page})`;
        expect(incomeRate(scale, chf(income), false), at).toBe(Math.round(rs * 10_000));
        expect(incomeRate(scale, chf(income), true), at).toBe(Math.round(rf * 10_000));
        expect(incomeBaseTax(scale, chf(income), false), at).toBe(chf(ts));
        expect(incomeBaseTax(scale, chf(income), true), at).toBe(chf(tf));
      }
    });
  }

  it('the classes end where the law says: 4.1598 % at CHF 17,400, 13.4997 % at 207,000', () => {
    const scale = frParamsFor(2025).incomeScale.value;
    // LICD art. 37 al. 1 (p. 27 and 28): each class's last rate.
    const ends: [number, number][] = [
      [17_400, 41_598],
      [31_300, 62_031],
      [48_200, 80_283],
      [63_700, 90_978],
      [77_500, 99_810],
      [102_000, 108_630],
      [128_600, 117_142],
      [155_900, 125_332],
      [180_900, 131_082],
      [207_000, 134_997],
    ];
    for (const [income, rate] of ends) expect(classRate(scale, income), String(income)).toBe(rate);
  });

  it('no tax under CHF 5,200; fractions under CHF 100 dropped; the top rate above the table', () => {
    const scale = frParamsFor(2025).incomeScale.value;
    expect(incomeBaseTax(scale, chf(5_199), false)).toBe(0);
    expect(incomeBaseTax(scale, chf(5_199), true)).toBe(0);
    expect(incomeBaseTax(scale, chf(5_299.95), false)).toBe(chf(52));
    // p. 106: above CHF 414,200, 13.5 % of the whole income.
    expect(incomeBaseTax(scale, chf(500_000), false)).toBe(chf(67_500));
    expect(incomeBaseTax(scale, chf(500_000), true)).toBe(chf(67_500));
    expect(rateIncome(scale, chf(40_050), true)).toBe(chf(20_000));
  });

  it('a family between CHF 5,200 and 10,400 pays the minimum rate (art. 37 al. 3)', () => {
    const scale = frParamsFor(2025).incomeScale.value;
    expect(incomeRate(scale, chf(8_000), true)).toBe(10_000);
    expect(incomeBaseTax(scale, chf(8_000), true)).toBe(chf(80));
  });

  it('2026 uses the same tariff as 2025', () => {
    expect(frParamsFor(2026).incomeScale.value).toEqual(frParamsFor(2025).incomeScale.value);
    expect(frParamsFor(2026).wealthScale.value).toEqual(frParamsFor(2025).wealthScale.value);
  });
});

describe('wealth scale (LICD art. 62, wealth tariff)', () => {
  it('per mille by bracket, in whole CHF 1,000', () => {
    const scale = frParamsFor(2025).wealthScale.value;
    // fr-2025-bareme-fortune p. 1: 0.5 ‰ for the first 50,000, then 1.1, 1.8, 2.5, 3.1, 3.5, 3.7 ‰.
    expect(wealthBaseTax(scale, chf(50_000))).toBe(chf(25));
    expect(wealthBaseTax(scale, chf(50_999))).toBe(chf(25));
    expect(wealthBaseTax(scale, chf(51_000))).toBe(chf(26.1));
    expect(wealthBaseTax(scale, chf(123_000))).toBe(chf(80 + 23 * 1.8));
    // Above CHF 1,200,000, 2.9 ‰: the average rate stays 2.9 ‰.
    expect(wealthBaseTax(scale, chf(1_200_000))).toBe(chf(3_480));
    expect(wealthBaseTax(scale, chf(2_000_000))).toBe(chf(5_800));
  });
});
