// Bern's tariffs as the law prints them (StG Art. 42 income, Art. 65 wealth): a rate for the first
// amount, a rate for each further amount, and a rate for every amount above the last step ("für
// jedes weitere Einkommen", "für jedes weitere Vermögen"). The result is the einfache Steuer, which
// the cantonal, communal and church multipliers then scale (StG Art. 2).

export interface StepTariff {
  /**
   * The rates' denominator: 10,000 for the income tariff (percent with two decimals: 1,55 % is 155),
   * 100,000 for the wealth tariff (per mille with two decimals: 0,40 ‰ is 40).
   */
  denominator: number;
  /** [width of the step in CHF, rate numerator]: "1,55 für die ersten 3300", "1,65 für die weiteren 3300". */
  steps: readonly (readonly [number, number])[];
  /** Rate numerator for every amount above the last step. */
  above: number;
}

/** Where the last step ends, in CHF. */
export const stepsTotal = (t: StepTariff) => t.steps.reduce((s, [width]) => s + width, 0);

/**
 * The tax on an amount in centimes, as a fraction: numerator over `denominator`, in centimes. Exact:
 * no rounding happens here. On the amounts the law taxes (income in whole CHF 100, wealth in whole
 * CHF 1,000: StG Art. 42 Abs. 4, Art. 65 Abs. 4) the fraction is a whole number of centimes.
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
  return numerator + rest * t.above;
}
