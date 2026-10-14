// The tariffs against the canton's tables of the einfache Steuer (be-<year>-tariff-einkommen-
// verheiratete and -alleinstehende, "ab Steuerjahr" 2025 and 2026): rows read in the tables, with
// their page. Every one of the tables' 44,640 rows was compared with the law's steps when the
// tariffs were written (StG Art. 42 in be-2025-stg-de and be-2026-stg-de): all equal; the 2025
// tables print whole francs from CHF 643,000 of income. The wealth tariff has no table: its
// figures are worked out from StG Art. 65 by hand.
import { describe, expect, it } from 'vitest';
import { beParamsFor, stepsTotal, tariffFraction, type StepTariff } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
/** The einfache Steuer in centimes for an amount in francs. */
const simple = (t: StepTariff, francs: number) => tariffFraction(t, chf(francs)) / t.denominator;

// [taxable income in CHF, einfache Steuer in CHF as printed, page of the table]
const ROWS: Record<string, [number, number, number][]> = {
  '2025 married': [
    [100, 1.55, 1],
    [3_300, 51.15, 1],
    [3_400, 52.8, 1],
    [16_400, 384.9, 1],
    [32_500, 972.7, 2],
    [60_500, 2_043.7, 4],
    [246_400, 12_035.85, 14],
  ],
  '2025 other': [
    [100, 1.95, 1],
    [3_400, 67.25, 1],
    [16_400, 512.85, 1],
    [32_500, 1_181.3, 2],
    [35_600, 1_319.25, 2],
    [60_500, 2_435, 4],
    [246_400, 13_254.4, 14],
  ],
  '2026 married': [
    [100, 1.55, 1],
    [25_400, 713.4, 2],
    [32_500, 972.55, 2],
    [60_500, 2_042.05, 4],
    [246_400, 12_021.2, 14],
    [1_000_000, 60_459, 19],
    [3_000_000, 190_459, 20],
  ],
  '2026 other': [
    [100, 1.95, 1],
    [32_500, 1_181, 2],
    [35_600, 1_318.95, 2],
    [46_100, 1_786.2, 3],
    [50_900, 1_999.8, 3],
    [1_000_000, 61_929.4, 19],
    [3_000_000, 191_929.4, 20],
  ],
};

describe('income tariffs (StG Art. 42) against the canton’s tables', () => {
  for (const [name, rows] of Object.entries(ROWS)) {
    const [year, kind] = name.split(' ') as [string, 'married' | 'other'];
    const tariff = beParamsFor(Number(year)).incomeTariff[kind].value;
    for (const [income, tax, page] of rows) {
      it(`${name}: CHF ${income} gives CHF ${tax} (table p. ${page})`, () => {
        expect(simple(tariff, income)).toBe(chf(tax));
      });
    }
  }

  it('the 2026 steps are the 2025 steps adjusted for cold progression', () => {
    expect(stepsTotal(beParamsFor(2025).incomeTariff.married.value)).toBe(483_000);
    expect(stepsTotal(beParamsFor(2026).incomeTariff.married.value)).toBe(486_000);
    expect(stepsTotal(beParamsFor(2025).incomeTariff.other.value)).toBe(467_600);
    expect(stepsTotal(beParamsFor(2026).incomeTariff.other.value)).toBe(470_600);
    // Above the last step, 6.50 % of every further franc.
    const t = beParamsFor(2026).incomeTariff.other.value;
    expect(simple(t, 470_700) - simple(t, 470_600)).toBe(chf(6.5));
  });
});

describe('wealth tariff (StG Art. 65 Abs. 1), by hand', () => {
  for (const year of [2025, 2026]) {
    const t = beParamsFor(year).wealthTariff.value;
    it(`${year}: per mille by step`, () => {
      expect(simple(t, 36_000)).toBe(0);
      // 41,000 at 0.40 per mille = 16.40.
      expect(simple(t, 77_000)).toBe(chf(16.4));
      // + 139,000 at 0.70 = 97.30: 113.70.
      expect(simple(t, 216_000)).toBe(chf(113.7));
      // + 184,000 at 0.80 = 147.20: 260.90.
      expect(simple(t, 400_000)).toBe(chf(260.9));
      // To 1,359,000: 113.70 + 176.80 + 371 + 661.20 = 1,322.70; + 1,623,000 at 1.30 = 2,109.90.
      expect(simple(t, 2_982_000)).toBe(chf(3_432.6));
      // Above 6,303,000, 1.25 per mille: 1,322.70 + 3,079.70 + 3,476.25 = 7,878.65, + 1.25 a 1,000.
      expect(simple(t, 6_303_000)).toBe(chf(7_878.65));
      expect(simple(t, 6_304_000)).toBe(chf(7_879.9));
    });
  }
});
