// Fribourg's scales and the tax at 100 % they give (impôt cantonal de base), which the canton's
// annual coefficient (LICD art. 2) and the commune's and the parish's percentages (LICo art. 3
// al. 3; fr-2025-guide-instructions-generales p. 46) then scale.
//
// Income (LICD art. 37): the rate rises by classes, from 1 % at CHF 5,200 to 13.5 % from CHF
// 207,100, by a fixed step per CHF 100 inside each class, and the tax is the whole taxable income
// at that rate. The SCC's detailed tariff prints every CHF 100 from 5,200 to 414,200, for a single
// person and for a married couple or a single parent, whose rate is the one of half their income
// (art. 37 al. 3), never below the minimum rate. Every rate and tax of that table was compared with
// these rules (scripts/fr-tariff.mjs --check): all rates are equal, and the taxes are income x rate
// rounded to the nearest 5 centimes, except a few exact halves the table rounds down, listed in the
// scale. Wealth (LICD art. 62): brackets in per mille.
import { bracketTax, roundTo, type BracketScale } from '@taxpresso/rules-ch';

export interface IncomeScale {
  /** No tax below this taxable income, in CHF: the scale starts there (art. 37 al. 1). */
  threshold: number;
  /**
   * The classes of art. 37 al. 1: [CHF where the class starts, the rate there, the rate added per
   * further CHF 100], rates in ten-thousandths of a percent (1.0259 % -> 10_259). The last class
   * has the top rate and adds nothing.
   */
  classes: readonly (readonly [number, number, number])[];
  /** Married couples and single parents: the rate of this share of the income, in basis points. */
  familyShareBp: number;
  /** The minimum rate, which stays applicable to them (art. 37 al. 3), ten-thousandths of a percent. */
  minimumRate: number;
  /** The detailed tariff's last row, in CHF; above it, the top rate on the whole income. */
  lastRow: number;
  /**
   * Rows of the detailed tariff whose tax is 5 centimes below income x rate rounded to the nearest
   * 5 centimes (exact halves the table rounds down): [CHF, column]. The table is the law's
   * "barème détaillé" (art. 37 al. 1), so its figure is the one applied.
   */
  roundedDown: readonly (readonly [number, 'single' | 'family'])[];
}

/** Whole CHF 100 of an amount in centimes (art. 37 al. 4: fractions under CHF 100 dropped). */
export const hundreds = (centimes: number) => Math.floor(Math.max(0, centimes) / 10_000) * 100;

/** The rate of the classes at an income in CHF (whole CHF 100), ten-thousandths of a percent. */
export function classRate(scale: IncomeScale, chf: number): number {
  let rate = 0;
  for (const [from, start, per100] of scale.classes) {
    if (chf >= from) rate = start + Math.floor((chf - from) / 100) * per100;
  }
  return rate;
}

/**
 * The rate applied to a taxable income in centimes: none under the threshold; a single person's at
 * the income itself; a family's at the share of the income (in whole CHF 100), at least the
 * minimum rate.
 */
export function incomeRate(scale: IncomeScale, taxable: number, family: boolean): number {
  const chf = hundreds(taxable);
  if (chf < scale.threshold) return 0;
  if (!family) return classRate(scale, chf);
  const share = Math.floor((chf * scale.familyShareBp) / 10_000 / 100) * 100;
  return Math.max(classRate(scale, share), scale.minimumRate);
}

/** The income the rate is read at: the income, or for a family its share, in whole CHF 100. */
export function rateIncome(scale: IncomeScale, taxable: number, family: boolean): number {
  const chf = hundreds(taxable);
  return (family ? Math.floor((chf * scale.familyShareBp) / 10_000 / 100) * 100 : chf) * 100;
}

/**
 * The base tax on income (100 %), in centimes: the taxable income in whole CHF 100 at the rate,
 * to the nearest 5 centimes, as the detailed tariff prints it.
 */
export function incomeBaseTax(scale: IncomeScale, taxable: number, family: boolean): number {
  const chf = hundreds(taxable);
  const rate = incomeRate(scale, taxable, family);
  if (!rate) return 0;
  // CHF x rate / 10^4 % = chf x 100 centimes x rate / 10^6 = chf x rate / 10^4 centimes.
  if (!Number.isSafeInteger(2 * chf * rate)) throw new RangeError('Income too large.');
  const tax = roundTo(chf * rate, 10_000, 5);
  const column = family ? 'family' : 'single';
  const down =
    chf <= scale.lastRow && scale.roundedDown.some(([c, k]) => c === chf && k === column);
  return down ? tax - 5 : tax;
}

/** The base tax on wealth (100 %), in centimes, on the taxable wealth in whole CHF 1,000. */
export function wealthBaseTax(scale: BracketScale, taxableWealth: number): number {
  return bracketTax(scale, Math.floor(Math.max(0, taxableWealth) / 100_000) * 100_000);
}
