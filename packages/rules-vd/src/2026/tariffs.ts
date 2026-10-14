// Vaud scales, cantonal coefficient and income tax reduction, tax year 2026.
// - The scales are the canton's summary tables of the cantonal base tax for 2026 (vd-2026-deductions
//   p. 2, "Barèmes sommaires de l'impôt cantonal de base 2026"): LI art. 47 (income) and art. 59
//   (wealth) adjusted to the cost of living (art. 60). They give the tax of every row of the
//   canton's detailed tables (vd-2026-tariff-revenu p. 1 to 30, CHF 100 to 300,000, and the rule
//   above it on p. 31; vd-2026-tariff-fortune p. 1 to 20, CHF 50,000 to 2,000,000): all 3,000
//   income rows and every wealth row from CHF 60,000 were compared when the scales were written
//   (test/tariffs.test.ts keeps a sample with pages). From CHF 74,400 of income on, and from CHF
//   711,000 of wealth, the steps differ from 2025's.
// - The cantonal coefficient: the annual tax law, art. 2.
// - The reduction of the cantonal base income tax: LRIPP art. 4 al. 2.
import type { Cited } from '@taxpresso/rules-ch';
import type { StepScale } from '../tariff.js';

export const INCOME_2026: Cited<StepScale> = {
  source:
    'vd-2026-deductions p. 2 (barèmes sommaires, impôt sur le revenu); vd-2026-tariff-revenu p. 1 to 31',
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
      [74_400, 577_300, 1_100],
      [91_200, 762_100, 1_200],
      [108_100, 964_900, 1_250],
      [135_000, 1_301_150, 1_300],
      [162_000, 1_652_150, 1_350],
      [192_500, 2_063_900, 1_400],
      [223_000, 2_490_900, 1_450],
      [256_000, 2_969_400, 1_500],
      [291_700, 3_504_900, 1_550],
    ],
  },
};

export const WEALTH_2026: Cited<StepScale> = {
  source:
    'vd-2026-deductions p. 2 (barèmes sommaires, impôt sur la fortune); vd-2026-tariff-fortune p. 1 to 20',
  value: {
    unit: 1_000,
    steps: [
      [60_000, 3_265, 97],
      [95_000, 6_660, 169],
      [120_000, 10_885, 169],
      [177_000, 20_520, 242],
      [355_000, 63_595, 315],
      [711_000, 175_735, 339],
    ],
  },
};

/** The annual coefficient: 155 % of the base tax, in hundredths of a percent. */
export const CANTONAL_COEFFICIENT_2026: Cited<number> = {
  source: 'vd-2026-law-impot-annuel art. 2 (p. 1); vd-2026-deductions p. 2',
  value: 15_500,
};

/** The cantonal base income tax is reduced by 5 % for 2026 (basis points). */
export const LRIPP_REDUCTION_2026: Cited<number> = {
  source: 'vd-2026-law-lripp art. 4 al. 2 (p. 2), art. 2 al. 2 (p. 1)',
  value: 500,
};
