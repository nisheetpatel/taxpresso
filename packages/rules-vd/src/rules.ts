// The Vaud deduction rules with a cap, a floor, a threshold or a reduction, and the quotient
// familial, as small pure functions on centimes, each tested against the guide's worked examples
// (vd-2025-guide) or the rule as the law states it.
import { flatProfessional, roundFranc, shareFranc } from '@taxpresso/rules-ch';
import type { FlatShare } from './amounts.js';

/**
 * 140, public transport: the yearly flat amount for the shortest one-way distance in whole km, at
 * most the last entry (vd-2025-guide p. 19 and 20: 19 km, CHF 2,976).
 */
export function publicTransportFlat(t: { fromKm: number; byKm: readonly number[] }, km: number) {
  const i = Math.min(t.byKm.length - 1, Math.max(0, Math.round(km) - t.fromKm));
  return t.byKm[i]!;
}

/**
 * 140, driving when public transport can't be used: there and back each day, per km up to the
 * yearly mileage, at the lower rate above it, to the franc (vd-2025-guide p. 21: 19 km x 2 x 240
 * days = 9,120 km x 70 ct = 6,384; 45 km: 21,600 km, 15,000 x 70 ct + 6,600 x 35 ct = 12,810).
 */
export function drivingCost(
  kmOneWay: number,
  days: number,
  car: { perKm: number; kmLimit: number; abovePerKm: number },
) {
  const km = Math.max(0, kmOneWay) * 2 * Math.max(0, days);
  const low = Math.min(km, car.kmLimit);
  return roundFranc(low * car.perKm + (km - low) * car.abovePerKm);
}

/** A yearly amount for `days` of a full year of `yearDays` working days, to the franc. */
export function prorated(perYear: number, days: number, yearDays: number) {
  return roundFranc(perYear * Math.min(Math.max(0, days), yearDays), yearDays);
}

/**
 * 160 and 165: a share of the net salary between a minimum and a maximum, never more than that
 * salary (vd-2025-guide p. 22; p. 23: 300 -> 300, 6,000 -> 1,200, 15,000 -> 2,400).
 */
export function flatShare(net: number, p: FlatShare) {
  return Math.max(0, Math.min(net, flatProfessional(net, p)));
}

/**
 * 235, both spouses work: the fixed amount, at most the lower income after its professional costs
 * and pension contributions; nothing when that is zero or less (vd-2025-guide p. 26: 800 -> 800).
 */
export function twoEarnerDeduction(lowerLeft: number, amount: number) {
  return Math.max(0, Math.min(amount, lowerLeft));
}

/**
 * 660, housing: the rent counted (at most the cap) above a share of the net income (650), at most
 * the maximum (vd-2025-guide p. 44: a couple with two children, rent 22,000, 650 at 60,000:
 * 21,100 - 12,000 = 9,100, at most 6,800).
 */
export function housingDeduction(
  rent: number,
  netIncome: number,
  rentCap: number,
  p: { max: number; incomeShareBp: number },
) {
  const share = shareFranc(Math.max(0, netIncome), p.incomeShareBp);
  return Math.max(0, Math.min(p.max, Math.min(rent, rentCap) - share));
}

/**
 * 695, modest taxpayers: the maximum deduction, never more than the income (690); above the
 * maximum, less half the excess rounded to the hundred (from 50 up, vd-2025-guide p. 47: 49,295
 * less 29,700 is 19,595, half 9,798, rounded 9,800: 19,900). LI art. 42 al. 3 says the same: 100
 * less per CHF 200 of income above the limit, which is the maximum plus 99 (al. 1).
 */
export function modestDeduction(income: number, max: number) {
  if (income <= max) return Math.max(0, income);
  const cut = Math.floor((income - max + 10_000) / 20_000) * 10_000;
  return Math.max(0, max - cut);
}

/**
 * 725, family deduction: whole up to the limit of net income (650), then less `cut` per full
 * `step` above it up to `upper`, then less `cut` per full `upperStep` above `upper`
 * (vd-2025-guide p. 50: 3,300 whole up to 128,399; 3,200 from 128,400; 1,500 at 164,100; 1,400
 * from 165,100; nothing from 179,100).
 */
export function familyDeduction(
  full: number,
  netIncome: number,
  p: { limit: number; step: number; upper: number; upperStep: number; cut: number },
) {
  if (netIncome <= p.limit) return full;
  const below = Math.floor((Math.min(netIncome, p.upper) - p.limit) / p.step);
  const above = netIncome > p.upper ? Math.floor((netIncome - p.upper) / p.upperStep) : 0;
  return Math.max(0, full - (below + above) * p.cut);
}

/**
 * 710, medical costs above a share of the intermediate income (700); 720, donations up to a share
 * of it, none under the minimum. Shares to the nearest franc.
 */
export function medicalDeduction(costs: number, intermediate: number, thresholdBp: number) {
  const threshold = shareFranc(Math.max(0, intermediate), thresholdBp);
  return { threshold, deduction: Math.max(0, costs - threshold) };
}

export function donationDeduction(
  gifts: number,
  intermediate: number,
  p: { shareBp: number; min: number },
) {
  const cap = shareFranc(Math.max(0, intermediate), p.shareBp);
  return { cap, deduction: gifts < p.min ? 0 : Math.min(gifts, cap) };
}

/**
 * 820, the rate-determining income: the taxable income divided by the parts, in whole CHF 100
 * (LI art. 43 al. 1, art. 46). With children, above the threshold for their number the income
 * divided by the parts without children less the table's maximum instead (art. 43 al. 3;
 * vd-2025-guide p. 52 to 54: 300,000 / 1.8 = 166,666 less 82,953 = 83,713, taken as 83,700).
 * Amounts in centimes, parts in hundredths.
 */
export function rateDeterminingIncome(
  taxable: number,
  parts: number,
  cap?: { baseParts: number; threshold: number; max: number },
) {
  const step = 10_000;
  if (cap && taxable > cap.threshold) {
    const capped = Math.floor((taxable * 100) / cap.baseParts) - cap.max;
    return Math.floor(Math.max(0, capped) / step) * step;
  }
  return Math.floor((taxable * 100) / parts / step) * step;
}

/**
 * The rate of the scale at the rate-determining income, in millionths of a percent, half up (the
 * guide's example prints 750.00 x 100 / 17,200 = 4.360465 %, vd-2025-guide p. 61). Both amounts in
 * centimes, the income in whole CHF 100.
 */
export function ratePpm(taxAtRateIncome: number, rateIncome: number) {
  if (rateIncome <= 0) return 0;
  const hundreds = rateIncome / 10_000;
  if (!Number.isInteger(hundreds))
    throw new RangeError('The rate-determining income is in whole CHF 100.');
  // tax / (hundreds x CHF 100) x 100 % x 10^6 = tax x 10^4 / hundreds, half up.
  const num = taxAtRateIncome * 10_000;
  if (!Number.isSafeInteger(2 * num + hundreds)) throw new RangeError('Amount too large.');
  return Math.floor((2 * num + hundreds) / (2 * hundreds));
}

/**
 * The taxable income (centimes, whole CHF 100) at a rate in millionths of a percent, as a fraction
 * of centimes for the 5-centime rounding: hundreds x CHF 100 x ppm / 10^8 = hundreds x ppm / 10^4.
 */
export function atRate(taxable: number, ppm: number): { num: number; den: number } {
  const hundreds = taxable / 10_000;
  if (!Number.isInteger(hundreds)) throw new RangeError('The taxable income is in whole CHF 100.');
  const num = hundreds * ppm;
  if (!Number.isSafeInteger(2 * num)) throw new RangeError('Amount too large.');
  return { num, den: 10_000 };
}
