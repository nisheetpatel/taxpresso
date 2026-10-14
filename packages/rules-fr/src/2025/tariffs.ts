// Fribourg scales and cantonal coefficients, tax year 2025.
// - Income: LICD art. 37 (fr-2025-law-licd-consolidee, the version in force from 1 January 2025):
//   al. 1 gives the classes with the rate at both ends of each, al. 3 the rate of half the income
//   for married couples and single parents with the minimum rate kept, al. 4 the CHF 100 steps.
//   The rate added per CHF 100 inside a class is its two end rates' difference over its steps, and
//   the SCC's detailed tariff (fr-2025-bareme-revenu, "valable dès l'année 2023", état au
//   01.01.2026) prints exactly those rates for every CHF 100 from 5,200 to 414,200, then the top
//   rate (p. 106). scripts/fr-tariff.mjs --check compares every one of its 4,091 rows, both
//   columns, with this scale; test/tariffs.test.ts keeps a sample with pages.
// - Wealth: LICD art. 62 al. 1a and 2, the same as the SCC's wealth tariff (fr-2025-bareme-fortune,
//   from 2021, état au 01.01.2026) and the guide's table.
// - Coefficients: the 2025 coefficient law, art. 1.
// No imports of values: scripts/fr-tariff.mjs reads this module with Node's type stripping.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import type { IncomeScale } from '../tariff.js';

/** The income scale at 100 %: rates in ten-thousandths of a percent. */
export const INCOME_2025: Cited<IncomeScale> = {
  source:
    'fr-2025-law-licd-consolidee art. 37 al. 1 (p. 27 and 28), al. 3 and 4 (p. 28); fr-2025-bareme-revenu p. 1 to 106; fr-2025-guide-instructions-generales p. 39 (code 7.910), p. 45 and 46',
  value: {
    threshold: 5_200,
    classes: [
      [5_200, 10_000, 259],
      [17_500, 41_745, 147],
      [31_400, 62_139, 108],
      [48_300, 80_352, 69],
      [63_800, 91_042, 64],
      [77_600, 99_846, 36],
      [102_100, 108_662, 32],
      [128_700, 117_172, 30],
      [156_000, 125_355, 23],
      [181_000, 131_097, 15],
      [207_100, 135_000, 0],
    ],
    familyShareBp: 5_000,
    minimumRate: 10_000,
    lastRow: 414_200,
    roundedDown: [
      [12_500, 'family'],
      [25_000, 'family'],
      [32_500, 'family'],
      [52_500, 'single'],
      [55_000, 'single'],
      [55_000, 'family'],
      [62_500, 'single'],
      [75_000, 'family'],
      [77_500, 'single'],
      [87_500, 'single'],
      [91_500, 'single'],
      [96_500, 'single'],
      [101_500, 'single'],
      [105_100, 'family'],
      [107_500, 'single'],
      [110_500, 'single'],
      [188_100, 'family'],
      [211_100, 'family'],
      [212_500, 'family'],
    ],
  },
};

/** The wealth scale at 100 %: per mille in ten-thousandths (0.5 ‰ -> 5 / 10,000). */
export const WEALTH_2025: Cited<BracketScale> = {
  source:
    'fr-2025-law-licd-consolidee art. 62 al. 1a and 2 (p. 37); fr-2025-bareme-fortune p. 1; fr-2025-guide-instructions-generales p. 46',
  value: {
    denominator: 10_000,
    brackets: [
      [50_000, 5],
      [100_000, 11],
      [200_000, 18],
      [400_000, 25],
      [700_000, 31],
      [1_000_000, 35],
      [1_200_000, 37],
      [Number.POSITIVE_INFINITY, 29],
    ],
  },
};

/**
 * The annual coefficients of the cantonal tax, in hundredths of a percent of the base tax: income
 * 96 %, wealth 100 %.
 */
export const COEFFICIENTS_2025: Cited<{ income: number; wealth: number }> = {
  source:
    'fr-2025-law-coefficient-annuel art. 1 al. 1 and 2 (p. 1); fr-2025-guide-instructions-generales p. 2, p. 45',
  value: { income: 9_600, wealth: 10_000 },
};
