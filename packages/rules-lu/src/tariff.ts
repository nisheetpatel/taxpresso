// Lucerne's income tariffs as the tax law prints them (StG § 57 Abs. 1 for single persons, Abs. 2
// for families): a rate for the first amount, a rate for each next amount, and above the last step
// one rate on the whole income ("Bei Einkommen über 2 093 000 Franken beträgt die Steuer je Einheit
// 5,7 Prozent des Einkommens"). The result is the tax per unit (Steuer je Einheit, StG § 2 Abs. 1),
// which the units of the state, the commune and the parish then multiply. The wealth tariff is one
// rate per mille per unit (StG § 60 Abs. 1).

export interface UnitTariff {
  /** [width of the step in CHF, rate in hundredths of a percent]: "5,25 Prozent der nächsten 53 800" is [53_800, 525]. */
  steps: readonly (readonly [number, number])[];
  /** Above this income in CHF (the end of the last step), the tax per unit is `flatRate` of the whole income. */
  flatAbove: number;
  /** In hundredths of a percent (5,7 Prozent -> 570). */
  flatRate: number;
}

/** Where the last step ends, in CHF. */
export const stepsTotal = (t: UnitTariff) => t.steps.reduce((s, [width]) => s + width, 0);

/**
 * The tax per unit on an income in centimes, as a fraction over 10,000: numerator in centimes.
 * Exact, no rounding: on an income in whole CHF 100 (StG § 57 Abs. 3) every step's tax is a whole
 * number of centimes.
 */
export function unitTaxFraction(t: UnitTariff, centimes: number): number {
  if (centimes <= 0) return 0;
  if (centimes > t.flatAbove * 100) return centimes * t.flatRate;
  let rest = centimes;
  let numerator = 0;
  for (const [widthChf, rate] of t.steps) {
    const part = Math.min(rest, widthChf * 100);
    numerator += part * rate;
    rest -= part;
    if (rest === 0) break;
  }
  return numerator;
}

/** The wealth tariff: so many hundred-thousandths of the taxable wealth per unit (0,75 Promille -> 75). */
export interface WealthTariff {
  rate: number;
}

/** The wealth tax per unit as a fraction over 100,000, in centimes; exact on whole CHF 1,000 (StG § 60 Abs. 2). */
export const wealthTaxFraction = (t: WealthTariff, centimes: number) =>
  Math.max(0, centimes) * t.rate;
