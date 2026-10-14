// Zurich's tariffs as the law prints them (StG § 35 income, § 47 wealth): a rate for the first
// amount, a rate for each further amount, and a rate for the parts above the last threshold. The
// result is the einfache Staatssteuer, which the cantonal, communal and church multipliers then
// scale (StG § 2 Abs. 1 and 2, § 188).

export interface StepTariff {
  /**
   * The rates' denominator: 100 for the income tariff (whole percent), 2000 for the wealth
   * tariff, whose rates are in half per mille (½‰ = 1, 3‰ = 6).
   */
  denominator: number;
  /** [width of the step in CHF, rate numerator]: "0 % für die ersten ...", "2 % für die weiteren ...". */
  steps: readonly (readonly [number, number])[];
  /** [CHF, rate numerator]: "13 % für Einkommensteile über ...". */
  above: readonly [number, number];
}

/** The threshold the steps add up to; the law prints it again as the start of the last line. */
export const stepsTotal = (t: StepTariff) => t.steps.reduce((s, [width]) => s + width, 0);

/**
 * The tax on an amount in centimes, as a fraction: numerator over `denominator`, in centimes.
 * Exact: no rounding happens here. Whole francs at whole percent give whole centimes.
 */
export function tariffFraction(t: StepTariff, centimes: number): number {
  if (centimes <= 0) return 0;
  let rest = centimes;
  let numerator = 0;
  for (const [widthChf, rate] of t.steps) {
    const part = Math.min(rest, widthChf * 100);
    numerator += part * rate;
    rest -= part;
    if (rest === 0) return numerator;
  }
  return numerator + rest * t.above[1];
}
