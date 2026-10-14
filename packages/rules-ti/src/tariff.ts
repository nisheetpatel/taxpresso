// Ticino's tariffs, as the tax law prints them (LT art. 35 for income, art. 49 for wealth): for
// each category (categoria), its top amount, its rate (aliquota di ogni categoria) and the tax due
// at its top (imposta dovuta per il reddito, la sostanza, massimo di ogni categoria); the last
// category has a rate and no top. Below a threshold no tax is due, and fractions under CHF 100 of
// income and CHF 1,000 of wealth are not counted.
//
// How the tax between two tops is found: the law gives the tax at each top and the rate of each
// category, rounded to three decimals, so the rate applied to the width of a category does not
// always land on the tax the law prints at its top (17,400 by the rate: 276.35; the law: 276.40).
// Taxpresso keeps every amount the law prints: between two tops, the tax on a straight line from
// one to the other; above the last top, the last rate. To 5 centimes, the precision of every
// amount in the law and in the canton's tables. The canton's own table of 2025
// (ti-2025-guide-istruzioni-pf-pdf p. 51) differs by 5 to 50 centimes at some incomes: its method
// is not published (docs/sources/ti/NOTES.md, Open points), and test/tariffs.test.ts pins every
// difference.
import { roundTo } from '@taxpresso/rules-ch';

export interface CategoryTariff {
  /** Fractions under this are not counted (centimes): CHF 100 of income, CHF 1,000 of wealth. */
  step: number;
  /** Below this amount (centimes), no tax. */
  exemptBelow: number;
  /**
   * The rates' denominator: income rates in thousandths of a percent (14.500 % -> 14_500, over
   * 100_000), wealth rates in thousandths of a per mille (2.500 per mille -> 2_500, over 1_000_000).
   */
  denominator: number;
  /**
   * [top of the category in CHF (Infinity for the last), rate, tax due at the top in centimes (null
   * for the last)].
   */
  categories: readonly (readonly [number, number, number | null])[];
}

/** The amount the tariff reads: rounded down to the step, nothing below the threshold. */
export function tariffBase(t: CategoryTariff, centimes: number): number {
  const rounded = Math.floor(Math.max(0, centimes) / t.step) * t.step;
  return rounded < t.exemptBelow ? 0 : rounded;
}

/** The tax by a tariff, in centimes, to 5 centimes (see the note at the top of this file). */
export function categoryTax(t: CategoryTariff, centimes: number): number {
  const x = tariffBase(t, centimes);
  if (x === 0) return 0;
  let prevTop = 0;
  let prevTax = 0;
  for (const [topChf, rate, taxAtTop] of t.categories) {
    const top = topChf === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : topChf * 100;
    if (x <= top) {
      if (taxAtTop === null) return prevTax + roundTo((x - prevTop) * rate, t.denominator, 5);
      return prevTax + roundTo((x - prevTop) * (taxAtTop - prevTax), top - prevTop, 5);
    }
    if (taxAtTop === null) throw new RangeError('Only the last category has no top.');
    prevTop = top;
    prevTax = taxAtTop;
  }
  throw new RangeError('The last category must have no top.');
}

/** The category an amount falls in, 1 for the first: for the explanation. */
export function categoryOf(t: CategoryTariff, centimes: number): number {
  const x = tariffBase(t, centimes);
  const i = t.categories.findIndex(([top]) => x <= top * 100);
  return i + 1;
}
