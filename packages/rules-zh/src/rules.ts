// The Zurich deduction rules with a cap or a threshold, as small pure functions on centimes, each
// tested against the official worked example (zh-2025-guide-natuerliche-personen p. 33 to 38)
// or the rule as the document states it. Shares are rounded to the nearest franc (./calc.ts).
import { roundFranc, shareFranc } from './calc.js';

/**
 * Meals away from home (per working day, at most per year, the reduced rate with a canteen) and
 * medical costs above a share of the Nettoeinkommen (line 310): the same rules as every canton's,
 * packages/rules-ch (core/rules.ts).
 */
export { mealsDeduction, medicalDeduction } from '@taxpresso/rules-ch';

/** A share of an amount, to the franc, between a minimum and a maximum (3 % flat, 20 % side job). */
export function flatShare(amount: number, p: { rateBp: number; min: number; max: number }): number {
  return Math.min(p.max, Math.max(p.min, shareFranc(Math.max(0, amount), p.rateBp)));
}

/** Driving to work when public transport can't be used: there and back each day, per km. */
export function drivingCost(kmOneWay: number, days: number, centimesPerKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * centimesPerKm);
}

/**
 * The insurance and savings interest limit (StG § 31 Abs. 1 lit. g; Versicherungsprämien form,
 * part B): spouses or others; half as much again when nobody in the household pays into a pension
 * fund or pillar 3a; plus the amount per child, half of it for a half child deduction.
 */
export function insuranceCap(
  p: { married: number; other: number; noPensionBp: number; perChild: number },
  couple: boolean,
  contributing: boolean,
  fullChildren: number,
  halfChildren: number,
): number {
  const base = couple ? p.married : p.other;
  const raised = contributing ? base : (base * p.noPensionBp) / 10_000;
  return raised + p.perChild * fullChildren + (p.perChild / 2) * halfChildren;
}

/** Pillar 3a: what was paid, at most the limit; without a pension fund, a share of earned income. */
export function pillar3aCap(
  hasPensionFund: boolean,
  earned: number,
  p: { withFund: number; withoutFundMax: number; withoutFundShareBp: number },
): number {
  if (hasPensionFund) return p.withFund;
  return Math.min(p.withoutFundMax, shareFranc(Math.max(0, earned), p.withoutFundShareBp));
}

/**
 * Both spouses earn (StG § 31 Abs. 2; Wegleitung 2025 p. 18, Ziffer 17): the lower of the two
 * earned incomes left after their professional costs, pillar 3a and pension buy-ins, at most the
 * fixed amount; nothing when it is zero or less.
 */
export function twoEarner(lowerEarned: number, max: number): number {
  return lowerEarned <= 0 ? 0 : Math.min(max, lowerEarned);
}

/** Donations: none under the minimum in the year, at most a share of the Nettoeinkommen (310). */
export function donationDeduction(
  gifts: number,
  base310: number,
  p: { min: number; shareBp: number },
) {
  const cap = shareFranc(Math.max(0, base310), p.shareBp);
  return { cap, deduction: gifts < p.min ? 0 : Math.min(gifts, cap) };
}
