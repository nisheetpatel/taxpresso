// The Basel-Landschaft deduction rules with a cap, a floor or a taper, as small pure functions on
// centimes, each tested against the guide's tables (bl-<year>-wegleitung) or the rule as the law and
// the ordinance state it.
import { roundFranc, shareFranc } from '@taxpresso/rules-ch';
import type { PensionerLimits } from './amounts.js';

/**
 * 530/535, a side job: 20 % of its net income, at least CHF 800 and at most CHF 2,400; when the
 * income is under CHF 800, only that income (Verordnung § 3 Abs. 3; guide p. 28).
 */
export function sideJobFlat(net: number, p: { rateBp: number; min: number; max: number }): number {
  if (net <= 0) return 0;
  if (net < p.min) return net;
  return Math.min(p.max, Math.max(p.min, shareFranc(net, p.rateBp)));
}

/**
 * 500/505, a car or a white-plate motorbike when public transport can't be used: the km one way,
 * there and back, each working day, at the rate per km, to the franc (Verordnung § 3 Abs. 1 lit. a
 * Ziff. 3; the form's Einzelweg x Fahrten pro Tag x Arbeitstage x Ansatz pro km).
 */
export function vehicleCost(kmOneWay: number, days: number, perKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * perKm);
}

/**
 * 680, both spouses work: the lower earned income, at most the fixed amount (StG § 8 Abs. 3).
 */
export function twoEarnerDeduction(lowerEarned: number, max: number): number {
  return Math.max(0, Math.min(max, lowerEarned));
}

/**
 * 770/771, the pensioners' deduction (StG § 33 Abs. 1 lit. c): up to the maximum pension, 40 % of
 * the income (60 % for a couple who both receive one); above it, 1 % less for each started CHF 100
 * (CHF 250 for a couple), never below zero; the deduction to the franc. The guide's tables print it
 * row by row (2025 p. 38: 30,241 gives 39 % and 11,794; 2026 p. 39: 49,141 gives 59 % and 28,993).
 */
export function pensionerDeduction(
  limits: PensionerLimits,
  p: { singleBp: number; singleStep: number; coupleBp: number; coupleStep: number },
  income: number,
  couple: boolean,
): { percent: number; deduction: number; max: number } {
  const max = couple ? limits.couple : limits.single;
  const full = (couple ? p.coupleBp : p.singleBp) / 100;
  const step = couple ? p.coupleStep : p.singleStep;
  if (income <= 0) return { percent: full, deduction: 0, max };
  const percent = income <= max ? full : Math.max(0, full - Math.ceil((income - max) / step));
  return { percent, deduction: roundFranc(income * percent, 100), max };
}
