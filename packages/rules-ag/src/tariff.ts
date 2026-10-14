// Aargau's tariffs as the law prints them (StG § 43 income, § 55 wealth): a rate for the first
// amount, a rate for each further amount, and a rate for every amount above the last step ("für
// Einkommensteile über", "für Vermögensteile über"). They give the einfache (100%ige) Steuer, which
// the canton, the commune and the church each multiply by their Steuerfuss (StG § 2, § 155).
// No imports of values: scripts/ag-tariff.mjs reads this module with Node's type stripping.

export interface StepTariff {
  /**
   * The rates' denominator: 1,000 for the income tariff (percent with one decimal: 8,5 % is 85),
   * 10,000 for the wealth tariff (per mille with one decimal: 0,7 ‰ is 7).
   */
  denominator: number;
  /** [width of the step in CHF, rate numerator]: "1 % für die weiteren Fr. 3'800.–". */
  steps: readonly (readonly [number, number])[];
  /** Rate numerator for every amount above the last step. */
  above: number;
}

/** Where the last step ends, in CHF. */
export const stepsTotal = (t: StepTariff) => t.steps.reduce((s, [width]) => s + width, 0);

/**
 * The tax on an amount in centimes, as a fraction: numerator over `denominator`, in centimes.
 * Exact: no rounding happens here.
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

/**
 * The einfache Einkommenssteuer in centimes on a taxable income already in whole CHF 100 (StG § 43
 * Abs. 3). Tarif A: the tariff on the income. Tarif B (§ 43 Abs. 2): the rate of half the income
 * applied to the whole income, which is twice the tax on half the income. Either is rounded down to
 * the franc (ag-2025-tariff-einkommenssteuer p. 2, 5. Rundung): the canton's tables give exactly
 * this on each of their 3,701 rows (scripts/ag-tariff.mjs --check).
 */
export function incomeSimpleTax(t: StepTariff, centimes: number, tarif: 'A' | 'B'): number {
  if (centimes <= 0) return 0;
  // Twice the tax on half the income is the tariff on the half, doubled: half of an amount in
  // whole CHF 100 is a whole number of centimes.
  const numerator =
    tarif === 'A' ? tariffFraction(t, centimes) : 2 * tariffFraction(t, centimes / 2);
  return Math.floor(numerator / (t.denominator * 100)) * 100;
}

/**
 * The einfache Vermögenssteuer in centimes on a taxable wealth already in whole CHF 1,000 (StG § 55
 * Abs. 2): exact, a whole number of centimes on such amounts (the canton's table prints it to the
 * centime, ag-2025-tariff-vermoegenssteuer p. 3 to 37).
 */
export function wealthSimpleTax(t: StepTariff, centimes: number): number {
  const numerator = tariffFraction(t, centimes);
  if (numerator % t.denominator !== 0) {
    throw new RangeError(`Wealth ${centimes} is not in whole CHF 1,000.`);
  }
  return numerator / t.denominator;
}
