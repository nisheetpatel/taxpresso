// The tariffs against the Steuerverwaltung's tariff sheets: at the end of each bracket the sheets
// print the einfache Steuer and its share (zg-2026-tariff-grundtarif and zg-2026-tariff-
// mehrpersonentarif: p. 1 is 2026, p. 2 is 2025). scripts/zg-tariff.mjs --check reads every row from
// the PDFs; this test keeps them in the repo, as printed.
import { describe, expect, it } from 'vitest';
import { simpleRate, simpleTax, zgParamsFor } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

// [Einkommen kumuliert, Einfache Steuer, Einfache Steuer in %], as the sheets print them.
const GRUNDTARIF: [number, number, string][] = [
  [1_100, 5.5, '0.5000'],
  [3_300, 27.5, '0.8333'],
  [6_100, 83.5, '1.3689'],
  [10_100, 203.5, '2.0149'],
  [15_300, 372.5, '2.4346'],
  [21_100, 575.5, '2.7275'],
  [26_900, 807.5, '3.0019'],
  [34_900, 1_167.5, '3.3453'],
  [46_400, 1_800, '3.8793'],
  [59_700, 2_531.5, '4.2404'],
  [74_700, 3_506.5, '4.6941'],
  [94_800, 5_114.5, '5.3950'],
  [120_100, 7_644.5, '6.3651'],
  [149_900, 10_326.5, '6.8889'],
];
const MEHRPERSONENTARIF: [number, number, string][] = [
  [2_200, 11, '0.5000'],
  [6_600, 55, '0.8333'],
  [12_200, 167, '1.3689'],
  [20_200, 407, '2.0149'],
  [30_600, 745, '2.4346'],
  [42_200, 1_151, '2.7275'],
  [53_800, 1_615, '3.0019'],
  [69_800, 2_335, '3.3453'],
  [92_800, 3_600, '3.8793'],
  [119_400, 5_063, '4.2404'],
  [149_400, 7_013, '4.6941'],
  [189_600, 10_229, '5.3950'],
  [240_200, 15_289, '6.3651'],
  [299_800, 20_653, '6.8889'],
];
const WEALTH: [number, number, string][] = [
  [254_000, 107.95, '0.04250'],
  [508_000, 323.85, '0.06375'],
  [762_000, 647.7, '0.08500'],
];

describe('the tariff sheets, 2025 (p. 2) and 2026 (p. 1)', () => {
  for (const year of [2025, 2026] as const) {
    const P = zgParamsFor(year);
    it(`${year}: Grundtarif and Mehrpersonentarif at every bracket end`, () => {
      for (const [scale, rows] of [
        [P.income.value.single, GRUNDTARIF],
        [P.income.value.married, MEHRPERSONENTARIF],
      ] as const) {
        for (const [income, tax, share] of rows) {
          expect(simpleTax(scale, chf(income)), `${year} ${income}`).toBe(chf(tax));
          expect((simpleRate(scale, chf(income)) * 100).toFixed(4)).toBe(share);
        }
      }
    });

    it(`${year}: the wealth tariff at every bracket end`, () => {
      for (const [wealth, tax, share] of WEALTH) {
        expect(simpleTax(P.wealth.value, chf(wealth)), `${year} ${wealth}`).toBe(chf(tax));
        expect((simpleRate(P.wealth.value, chf(wealth)) * 100).toFixed(5)).toBe(share);
      }
    });
  }

  it('above the top bracket: 8 % (income) and 0.17 % (wealth) on the rest', () => {
    const P = zgParamsFor(2026);
    expect(simpleTax(P.income.value.single, chf(200_000))).toBe(chf(10_326.5 + 50_100 * 0.08));
    expect(simpleTax(P.income.value.married, chf(400_000))).toBe(chf(20_653 + 100_200 * 0.08));
    expect(simpleTax(P.wealth.value, chf(1_000_000))).toBe(chf(647.7 + 238_000 * 0.0017));
  });

  it('between two ends: exact on whole francs, then to the centime, halves up', () => {
    const P = zgParamsFor(2025);
    // 65,603 single: 2,531.50 + 5,903 x 6.5 % = 2,915.195, to the centime 2,915.20.
    expect(simpleTax(P.income.value.single, chf(65_603))).toBe(chf(2_915.2));
    // Rappen are dropped: 65,603.99 is taxed as 65,603.
    expect(simpleTax(P.income.value.single, chf(65_603.99))).toBe(chf(2_915.2));
    expect(simpleTax(P.income.value.single, 0)).toBe(0);
    expect(simpleTax(P.income.value.single, -500)).toBe(0);
  });

  it('the 2025 and 2026 brackets are the same (the sheets’ headers differ: NOTES.md, Gaps)', () => {
    expect(zgParamsFor(2026).income.value).toEqual(zgParamsFor(2025).income.value);
    expect(zgParamsFor(2026).wealth.value).toEqual(zgParamsFor(2025).wealth.value);
  });

  it('fails closed for another year', () => {
    expect(() => zgParamsFor(2024)).toThrow(RangeError);
    expect(() => zgParamsFor(2027)).toThrow(/not supported/);
  });
});
