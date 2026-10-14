// Vaud scales, cantonal coefficient and income tax reduction, tax year 2025.
// - The scales are the canton's summary tables of the cantonal base tax for 2025 (vd-2025-deductions
//   p. 2, "Barèmes sommaires de l'impôt cantonal de base 2025"; the same in vd-2025-guide p. 60):
//   LI art. 47 (income) and art. 59 (wealth) adjusted to the cost of living (art. 60). They give the
//   tax of every row of the canton's detailed tables (vd-2025-tariff-revenu p. 1 to 30, CHF 100 to
//   300,000, and the rule above it on p. 31; vd-2025-tariff-fortune p. 1 to 20, CHF 50,000 to
//   2,000,000): all 3,000 income rows and every wealth row from CHF 60,000 were compared when the
//   scales were written (test/tariffs.test.ts keeps a sample with pages).
// - The cantonal coefficient: the annual tax law, art. 2.
// - The reduction of the cantonal base income tax: LRIPP art. 4 (it does not reach the communal tax,
//   art. 2 al. 2).
import type { Cited } from '@taxpresso/rules-ch';
import type { StepScale } from '../tariff.js';

/** Income: from 100 francs, 1.00 per CHF 100; from 1,600, 2.00; ... from 291,400, 15.50. */
export const INCOME_2025: Cited<StepScale> = {
  source:
    'vd-2025-deductions p. 2 (barèmes sommaires, impôt sur le revenu); vd-2025-guide p. 60; vd-2025-tariff-revenu p. 1 to 31',
  value: {
    unit: 100,
    steps: [
      [100, 100, 100],
      [1_600, 1_600, 200],
      [3_400, 5_200, 300],
      [5_100, 10_300, 400],
      [8_300, 23_100, 500],
      [11_900, 41_100, 600],
      [15_100, 60_300, 700],
      [23_600, 119_800, 800],
      [40_500, 255_000, 900],
      [57_200, 405_300, 1_000],
      [74_300, 576_300, 1_100],
      [91_100, 761_100, 1_200],
      [108_000, 963_900, 1_250],
      [134_900, 1_300_150, 1_300],
      [161_900, 1_651_150, 1_350],
      [192_300, 2_061_550, 1_400],
      [222_800, 2_488_550, 1_450],
      [255_800, 2_967_050, 1_500],
      [291_400, 3_501_050, 1_550],
    ],
  },
};

/**
 * Wealth: from 60,000 francs, 32.65 and 0.97 per CHF 1,000; ... from 710,000, 3.39. Net wealth
 * under 60,000 (120,000 for spouses) is not taxed at all (./amounts.ts, wealthFree), so the
 * summary table starts there.
 */
export const WEALTH_2025: Cited<StepScale> = {
  source:
    'vd-2025-deductions p. 2 (barèmes sommaires, impôt sur la fortune); vd-2025-guide p. 60; vd-2025-tariff-fortune p. 1 to 20',
  value: {
    unit: 1_000,
    steps: [
      [60_000, 3_265, 97],
      [95_000, 6_660, 169],
      [120_000, 10_885, 169],
      [177_000, 20_520, 242],
      [355_000, 63_595, 315],
      [710_000, 175_420, 339],
    ],
  },
};

/** The annual coefficient: 155 % of the base tax, in hundredths of a percent. */
export const CANTONAL_COEFFICIENT_2025: Cited<number> = {
  source:
    'vd-2025-law-impot-annuel art. 2 (p. 1); vd-2025-deductions p. 2; vd-2025-coefficient-cantonal (Coefficient cantonal, 2025)',
  value: 15_500,
};

/** The cantonal base income tax is reduced by 4 % for 2025 (basis points). */
export const LRIPP_REDUCTION_2025: Cited<number> = {
  source: 'vd-2025-law-lripp art. 4 al. 1 (p. 2), art. 2 al. 2 (p. 1); vd-2025-guide p. 61',
  value: 400,
};
