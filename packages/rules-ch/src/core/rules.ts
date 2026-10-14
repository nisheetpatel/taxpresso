// The deduction rules with a cap or a threshold that every canton and the federal tax share, as
// small pure functions on centimes: each canton passes its own cited parameters, so each can be
// tested against the worked examples of the official documents.
import { shareFranc } from './calc.js';

/**
 * Flat professional expenses: rate x (code 11.00 less 31.10 and 31.12), to the franc, between the
 * minimum and the maximum (ge-2025-guide-declaration-pp p. 19: 65,033 x 3 % = 1,951; ICC at most
 * 1,812, IFD at least 2,000).
 */
export function flatProfessional(
  net: number,
  p: { rateBp: number; min: number; max: number },
): number {
  return Math.min(p.max, Math.max(p.min, shareFranc(net, p.rateBp)));
}

/** Medical costs above a share of the subtotal 92.20 (guide p. 14: 7,000 less 0.5 % of 60,000). */
export function medicalDeduction(costs: number, subtotal9220: number, thresholdBp: number) {
  const threshold = shareFranc(Math.max(0, subtotal9220), thresholdBp);
  return { threshold, deduction: Math.max(0, costs - threshold) };
}

/**
 * Donations up to a share of the subtotal 92.40, and for the federal tax only once they reach a
 * minimum in the year (guide p. 15: 12,200 limited to 20 % of 53,300 = 10,660 for the ICC).
 */
export function donationDeduction(gifts: number, subtotal9240: number, shareBp: number, min = 0) {
  const cap = shareFranc(Math.max(0, subtotal9240), shareBp);
  return { cap, deduction: gifts < min ? 0 : Math.min(gifts, cap) };
}

/**
 * Federal two-earner deduction (LIFD art. 33 al. 2; guide p. 21): 50 % of the lower earned
 * income, at least 8,600 and at most 14,100; under 8,600, that income itself.
 */
export function twoEarnerFederal(earned: number, p: { shareBp: number; min: number; max: number }) {
  if (earned <= 0) return 0;
  if (earned < p.min) return earned;
  return Math.min(p.max, Math.max(p.min, shareFranc(earned, p.shareBp)));
}

/** Pillar 3a without a pension fund: a share of earned income, up to a maximum. */
export function pillar3aCapWithoutFund(
  earned: number,
  p: { withoutFundMax: number; withoutFundShareBp: number },
) {
  return Math.min(p.withoutFundMax, shareFranc(Math.max(0, earned), p.withoutFundShareBp));
}

/** Meals away from home: per day (half with a canteen), at most per year (guide p. 19). */
export function mealsDeduction(
  days: number,
  canteen: boolean,
  p: { perDay: number; perYear: number; halfPerDay: number; halfPerYear: number },
) {
  if (days <= 0) return 0;
  return canteen
    ? Math.min(days * p.halfPerDay, p.halfPerYear)
    : Math.min(days * p.perDay, p.perYear);
}
