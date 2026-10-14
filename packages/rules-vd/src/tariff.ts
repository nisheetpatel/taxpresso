// Vaud's scales as the canton prints them in its summary tables ("Barèmes sommaires de l'impôt
// cantonal de base", vd-<year>-deductions p. 2; vd-2025-guide p. 60): from an amount on, the tax
// there and so much per further CHF 100 of income or CHF 1,000 of wealth. The result is the
// cantonal base tax (impôt cantonal de base, 100 %), which the cantonal and communal coefficients
// then scale (LI art. 2, LICom art. 6).
import { round5 } from '@taxpresso/rules-ch';

export interface StepScale {
  /** CHF per step: 100 for income (LI art. 46), 1,000 for wealth (LI art. 59 al. 3). */
  unit: number;
  /**
   * [amount in CHF where the step starts, tax there in centimes, centimes per further unit], as
   * printed: "40 500 | 2'550.00 | 9.00".
   */
  steps: readonly (readonly [number, number, number])[];
}

/**
 * The base tax on an amount in centimes: the step's tax plus so much per whole further unit,
 * rounded to 5 centimes, as the canton's detailed tables print every row (vd-<year>-tariff-revenu,
 * vd-<year>-tariff-fortune). Nothing below the first step.
 */
export function scaleTax(scale: StepScale, centimes: number): number {
  const chf = Math.floor(Math.max(0, centimes) / 100);
  let tax = 0;
  for (const [start, base, perUnit] of scale.steps) {
    if (chf >= start) tax = base + Math.floor((chf - start) / scale.unit) * perUnit;
  }
  return round5(tax);
}
