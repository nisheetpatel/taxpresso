// Zug's tariffs of the einfache Steuer (StG § 2 Abs. 1), tax year 2025: the income tariffs, single
// (Grundtarif, StG § 35 Abs. 1) and for married couples and single parents (Mehrpersonentarif, § 35
// Abs. 2), and the wealth tariff (§ 44 Abs. 2), each with the brackets the Steuerverwaltung
// indexed for 2025 (§ 45): page 2 of each tariff sheet. The law in force for 2025 is the version of
// 1 January 2024 (zg-2025-law-steuergesetz); the 2026 changes do not touch the tariffs.
// [upper end of the bracket in CHF, rate]: income rates in hundredths of a percent (over 10,000),
// wealth rates in millionths (0.0425 % is 425 over 1,000,000). The last rate applies above the top
// bracket. scripts/zg-tariff.mjs --check compares these with the sheets.
// No imports of values: scripts/zg-tariff.mjs reads this module with Node's type stripping.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';

export const INCOME_2025: Cited<{ single: BracketScale; married: BracketScale }> = {
  source:
    'zg-2026-tariff-grundtarif p. 2 (Einkommenssteuer, gültig Steuerperiode 2025); zg-2026-tariff-mehrpersonentarif p. 2 (Einkommenssteuer, gültig Steuerperiode 2025); zg-2025-law-steuergesetz § 35 Abs. 1 and 2 (p. 26), § 45 Abs. 1 (p. 31)',
  value: {
    single: {
      denominator: 10_000,
      brackets: [
        [1_100, 50],
        [3_300, 100],
        [6_100, 200],
        [10_100, 300],
        [15_300, 325],
        [21_100, 350],
        [26_900, 400],
        [34_900, 450],
        [46_400, 550],
        [59_700, 550],
        [74_700, 650],
        [94_800, 800],
        [120_100, 1_000],
        [149_900, 900],
        [Number.POSITIVE_INFINITY, 800],
      ],
    },
    married: {
      denominator: 10_000,
      brackets: [
        [2_200, 50],
        [6_600, 100],
        [12_200, 200],
        [20_200, 300],
        [30_600, 325],
        [42_200, 350],
        [53_800, 400],
        [69_800, 450],
        [92_800, 550],
        [119_400, 550],
        [149_400, 650],
        [189_600, 800],
        [240_200, 1_000],
        [299_800, 900],
        [Number.POSITIVE_INFINITY, 800],
      ],
    },
  },
};

export const WEALTH_2025: Cited<BracketScale> = {
  source:
    'zg-2026-tariff-grundtarif p. 2 (Vermögenssteuer); zg-2026-tariff-mehrpersonentarif p. 2 (Vermögenssteuer, the same); zg-2025-law-steuergesetz § 44 Abs. 2 (p. 30 and 31), § 45 Abs. 1 (p. 31)',
  value: {
    denominator: 1_000_000,
    brackets: [
      [254_000, 425],
      [508_000, 850],
      [762_000, 1_275],
      [Number.POSITIVE_INFINITY, 1_700],
    ],
  },
};
