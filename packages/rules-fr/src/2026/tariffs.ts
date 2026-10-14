// Fribourg scales and cantonal coefficients, tax year 2026.
// - Income and wealth: the same LICD articles as for 2025 (fr-2025-law-licd-consolidee, the version
//   in force from 1 January 2025; the BDLF lists no later one, so it governs 2026) and the SCC's
//   current tariffs, listed for 2026 (fr-2026-bareme-revenu and fr-2026-bareme-fortune: the same
//   files as for 2025, "valable dès l'année 2023" and "à partir de la période fiscale 2021", état au
//   01.01.2026). scripts/fr-tariff.mjs --check compares every row of fr-2026-bareme-revenu too.
// - Coefficients: the 2026 coefficient law, art. 1; the 2026 source-tax bases print the same 96 %.
// No imports of values: scripts/fr-tariff.mjs reads this module with Node's type stripping.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import type { IncomeScale } from '../tariff.js';

/** The income scale at 100 %: rates in ten-thousandths of a percent. */
export const INCOME_2026: Cited<IncomeScale> = {
  source:
    'fr-2025-law-licd-consolidee art. 37 al. 1 (p. 27 and 28), al. 3 and 4 (p. 28); fr-2026-bareme-revenu p. 1 to 106; fr-2026-bases-calcul-cantonales p. 1 (barème applicable, seuil imposable)',
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
export const WEALTH_2026: Cited<BracketScale> = {
  source: 'fr-2025-law-licd-consolidee art. 62 al. 1a and 2 (p. 37); fr-2026-bareme-fortune p. 1',
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
export const COEFFICIENTS_2026: Cited<{ income: number; wealth: number }> = {
  source:
    'fr-2026-law-coefficient-annuel art. 1 al. 1 and 2 (p. 1); fr-2026-bases-calcul-cantonales p. 1 (coefficients, impôt cantonal)',
  value: { income: 9_600, wealth: 10_000 },
};
