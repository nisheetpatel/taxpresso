// Basel-Landschaft's income tariff (Einheitstarif, StG § 34 Abs. 1 and 2): a formula, not brackets.
// Above the tax-free limit (Steuerfreigrenze, the first Eckwert) the tax at an income x is
// F(x) = b x + c x (ln x - 1) + D, with one set of b, c, D for each of three segments between the
// Eckwerte; above the last Eckwert, F(max) plus the maximum rate on the rest (Anwendungsregeln,
// Ziffer 4). The Eckwerte and parameters are indexed every year (§ 20) and published in the
// canton's tariff workbook (Tariftabelle) of the year, the parameters to six decimals.
//
// How the tax is found (bl-na-tariff-anwendungsregeln, Ziffer 5 to 7): the income that sets the rate
// (satzbestimmendes Einkommen) is the taxable income, or for Vollsplitting half of it rounded down
// to the franc; the rate is F of that income divided by it, never below the minimum rate for
// Vollsplitting (§ 34 Abs. 2); the rate, unrounded, times the taxable income, rounded to the nearest
// 5 centimes, is the tax. scripts/bl-tariff.mjs --check runs this module against every row of each
// year's workbook table; test/tariffs.test.ts keeps a sample with the tariff sheet's page.
//
// The formula has a natural logarithm, so it is computed in floating point, as the canton's own
// tables are; its inputs (francs) and its result (centimes) are integers. No imports of values:
// scripts/bl-tariff.mjs reads this module with Node's type stripping.

/** b, c and D of one segment, in millionths (the workbook prints six decimals). */
export interface Segment {
  b: number;
  c: number;
  d: number;
}

export interface IncomeFormula {
  /** The Eckwerte in CHF: no tax below `min` (Steuerfreigrenze); then three segments up to `max`. */
  min: number;
  medium1: number;
  medium2: number;
  max: number;
  /** The segments from `min` to `medium1`, to `medium2` and to `max`. */
  segments: readonly [Segment, Segment, Segment];
  /** The minimum rate (Minimaler Steuersatz) for Vollsplitting, in millionths. */
  minRate: number;
  /** The rate on the income above `max` (Grenzsteuersatz maximal), in millionths. */
  maxRate: number;
}

const M = 1_000_000;

/** F(x): the formula's tax in CHF (a double) at an income of x CHF, from the first Eckwert on. */
export function formulaTax(f: IncomeFormula, x: number): number {
  if (x > f.max) return formulaTax(f, f.max) + (f.maxRate / M) * (x - f.max);
  const s = x <= f.medium1 ? f.segments[0] : x <= f.medium2 ? f.segments[1] : f.segments[2];
  return (s.b / M) * x + (s.c / M) * x * (Math.log(x) - 1) + s.d / M;
}

/** The income that sets the rate, in CHF: the taxable income, or half of it rounded down. */
export function rateIncome(taxableChf: number, splitting: boolean): number {
  return splitting ? Math.floor(taxableChf / 2) : taxableChf;
}

export interface IncomeTariffTax {
  /** The tax in centimes, a multiple of 5. */
  tax: number;
  /** The income that set the rate, in CHF. */
  rateIncome: number;
  /** The rate applied (a fraction, unrounded); 0 under the tax-free limit. */
  rate: number;
  /** Vollsplitting at the minimum rate: half the income is under the first Eckwert, or its rate below. */
  atMinimumRate: boolean;
}

/**
 * The income tax of the tariff (Steuerbetrag) on a taxable income in centimes, whole francs taken:
 * none under the tax-free limit; otherwise the rate of the income that sets it, applied unrounded,
 * to the nearest 5 centimes.
 */
export function incomeTariffTax(
  f: IncomeFormula,
  taxableCentimes: number,
  splitting: boolean,
): IncomeTariffTax {
  const x = Math.floor(Math.max(0, taxableCentimes) / 100);
  const xs = rateIncome(x, splitting);
  if (x < f.min) return { tax: 0, rateIncome: xs, rate: 0, atMinimumRate: false };
  let rate = xs < f.min ? 0 : formulaTax(f, xs) / xs;
  const atMinimumRate = splitting && rate < f.minRate / M;
  if (atMinimumRate) rate = f.minRate / M;
  if (!Number.isSafeInteger(x * 20)) throw new RangeError('Income too large.');
  return { tax: Math.round(rate * x * 20) * 5, rateIncome: xs, rate, atMinimumRate };
}
