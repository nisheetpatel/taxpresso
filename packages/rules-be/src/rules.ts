// The Bern deduction rules with a cap, a floor or a threshold, as small pure functions on centimes,
// each tested against the official specimen (be-2025-steuererklaerung-formulare-de), the canton's
// worked examples (TaxInfo) or the rule as the law states it. The meal and flat-share rules are
// every canton's (packages/rules-ch, core/rules.ts).
import { roundFranc, shareFranc } from '@taxpresso/rules-ch';

export { flatProfessional as flatShare, mealsDeduction } from '@taxpresso/rules-ch';

/**
 * A share of an amount in whole francs, the centimes dropped: the 5 % of the medical costs and the
 * 20 % of the donations. The specimen's TaxMe summary drops them (federal column: 5 % of 41,994 =
 * 2,099.70 is taken as 2,099, be-2025-steuererklaerung-formulare-de p. 11); its cantonal column
 * (5 % of 41,344 = 2,067.20, 2,067, p. 9) is the same either way.
 */
export const shareFloor = (amount: number, bp: number) =>
  Math.floor((Math.max(0, amount) * bp) / 1_000_000) * 100;

/** Medical costs above a share of the Reineinkommen (StG Art. 38a Abs. 1 lit. b). */
export function medicalDeduction(costs: number, netIncome: number, thresholdBp: number) {
  const threshold = shareFloor(netIncome, thresholdBp);
  return { threshold, deduction: Math.max(0, costs - threshold) };
}

/** Donations: none under the minimum in the year, at most a share of the Reineinkommen (Art. 38a Abs. 1 lit. a). */
export function donationDeduction(
  gifts: number,
  netIncome: number,
  p: { min: number; shareBp: number },
) {
  const cap = shareFloor(netIncome, p.shareBp);
  return { cap, deduction: gifts < p.min ? 0 : Math.min(gifts, cap) };
}

/** Driving to work when public transport can't be used: there and back each day, per km. */
export function drivingCost(kmOneWay: number, days: number, centimesPerKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * centimesPerKm);
}

/**
 * Insurance premiums and savings interest (StG Art. 38 Abs. 1 lit. g; be-na-deductions-taxinfo-
 * versicherungsabzug): with contributions to a pension fund or pillar 3a, the fixed amount whatever
 * was paid; without, what was paid up to the higher maximum, but at least the fixed amount (the
 * law: the deduction "erhöht sich ... auf höchstens"; the canton's page: a fixed minimum). Plus so
 * much per child with the child deduction, half for a half child deduction (Art. 40 Abs. 8).
 */
export function insuranceDeduction(
  p: { married: number; other: number; marriedNone: number; otherNone: number; perChild: number },
  a: { couple: boolean; contributing: boolean; childWeight: number; paid: number },
) {
  const children = Math.round(p.perChild * a.childWeight);
  const fixed = (a.couple ? p.married : p.other) + children;
  if (a.contributing) return { fixed, cap: fixed, deduction: fixed, floorApplied: false };
  const cap = (a.couple ? p.marriedNone : p.otherNone) + children;
  const deduction = Math.max(fixed, Math.min(a.paid, cap));
  return { fixed, cap, deduction, floorApplied: a.paid < fixed };
}

/**
 * Both spouses earn (StG Art. 38 Abs. 2 lit. a; be-na-deductions-taxinfo-zweiverdienerabzug): a
 * share of both earned incomes (the net salaries), at most the maximum, and at most the lower
 * earned income less its professional costs and contributions; nothing when that is zero or less.
 */
export function twoEarnerDeduction(
  bothEarned: number,
  lowerLeft: number,
  p: { shareBp: number; max: number },
): number {
  if (lowerLeft <= 0) return 0;
  return Math.min(shareFranc(Math.max(0, bothEarned), p.shareBp), p.max, lowerLeft);
}

/**
 * Modest incomes (StG Art. 40 Abs. 6 and 7): the full deduction (more per child, half for a half
 * child deduction, Abs. 8) up to the limit of assessable income (the taxable income without this
 * deduction plus a share of the taxable wealth), then cut by a fixed amount per full CHF 2,000
 * above it. `stepped` says the cut applied: the law does not say how a part of CHF 2,000 counts.
 */
export function modestIncomeDeduction(
  p: {
    other: { max: number; limit: number; cut: number };
    married: { max: number; limit: number; cut: number };
    step: number;
    perChild: number;
  },
  a: { couple: boolean; childWeight: number; assessable: number },
) {
  const own = a.couple ? p.married : p.other;
  const full = own.max + Math.round(p.perChild * a.childWeight);
  if (a.assessable <= own.limit) return { full, deduction: full, stepped: false };
  const steps = Math.floor((a.assessable - own.limit) / p.step);
  const deduction = Math.max(0, full - steps * own.cut);
  return { full, deduction, stepped: deduction > 0 };
}

/** Pillar 3a without a pension fund and its limit: every canton's (packages/rules-ch). */
export { pillar3aCapWithoutFund } from '@taxpresso/rules-ch';
