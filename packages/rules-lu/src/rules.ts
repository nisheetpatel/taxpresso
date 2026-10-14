// The Lucerne deduction rules with a cap, a floor or a threshold, as small pure functions on
// centimes, each tested against the canton's worked examples (Steuerbuch, guide) or the rule as
// the law states it. The meal, flat-share, medical and donation rules are every canton's
// (packages/rules-ch, core/rules.ts). A share is taken to the franc: the return takes whole francs
// ("CHF ohne Rappen", lu-2025-guide-wegleitung p. 15), the method of rounding a share is not
// stated (NOTE.rounding).
import { roundFranc, shareFranc } from '@taxpresso/rules-ch';

export {
  donationDeduction,
  flatProfessional as flatShare,
  mealsDeduction,
  medicalDeduction,
  pillar3aCapWithoutFund,
} from '@taxpresso/rules-ch';

/** Driving to work when public transport can't be used: there and back each day, per km. */
export function drivingCost(kmOneWay: number, days: number, centimesPerKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * centimesPerKm);
}

/**
 * Insurance premiums and savings interest (StG § 40 Abs. 1 lit. g; Steuerbuch § 40 Nr. 6): what
 * was paid, at most the amount for spouses or for others, higher when no pension fund or pillar 3a
 * contributions were paid (for spouses, by neither), plus so much per child with the child
 * deduction (half for a half child deduction, § 42 Abs. 2).
 */
export function insuranceDeduction(
  p: { married: number; other: number; marriedNone: number; otherNone: number; perChild: number },
  a: { couple: boolean; contributing: boolean; childWeight: number; paid: number },
) {
  const withContributions = a.couple ? p.married : p.other;
  const without = a.couple ? p.marriedNone : p.otherNone;
  const base = a.contributing ? withContributions : without;
  const cap = base + Math.round(p.perChild * a.childWeight);
  return { cap, deduction: Math.min(Math.max(0, a.paid), cap) };
}

/**
 * Both spouses earn (StG § 40 Abs. 2; StV § 13 Abs. 3): the fixed amount, but no more than what is
 * left of the lower earned income after its professional costs and its pension fund and pillar 3a
 * contributions; nothing when nothing is left.
 */
export function twoEarnerDeduction(max: number, lowerLeft: number): number {
  return Math.max(0, Math.min(max, lowerLeft));
}

/**
 * The degressive social deduction (StG § 42 Abs. 1 lit. e and f; Steuerbuch § 42 Nr. 6): 14 % of
 * the difference between the tariff's limit and the Reineinkommen (Ziffer 330), nothing at or
 * above the limit.
 */
export function degressiveDeduction(
  p: { shareBp: number; single: number; family: number },
  a: { family: boolean; netIncome: number },
) {
  const limit = a.family ? p.family : p.single;
  const difference = Math.max(0, limit - a.netIncome);
  return { limit, difference, deduction: shareFranc(difference, p.shareBp) };
}

/**
 * The flat costs of keeping securities and accounts (lu-2025-guide-wegleitung p. 40): a share of
 * their tax value up to CHF 3 million and a smaller share above, at most their income.
 */
export function assetManagementFlat(
  p: { bp: number; upTo: number; bpAbove: number },
  a: { value: number; income: number },
): number {
  const value = Math.max(0, a.value);
  const flat = roundFranc(
    Math.min(value, p.upTo) * p.bp + Math.max(0, value - p.upTo) * p.bpAbove,
    10_000,
  );
  return Math.min(flat, Math.max(0, a.income));
}

/**
 * Own care and childcare by others of one child under 14 living with you (StG § 42 Abs. 1 lit. b;
 * StV § 14b for parents taxed apart who both qualify): the own care amount, rising with the
 * childcare costs paid because of work or education to at most the maximum, own care included.
 */
export function careDeduction(
  p: { own: number; max: number },
  a: { childcare: number; childcareAllowed: boolean },
) {
  const thirdPartyCap = p.max - p.own;
  const thirdParty = a.childcareAllowed ? Math.min(Math.max(0, a.childcare), thirdPartyCap) : 0;
  return { own: p.own, thirdPartyCap, thirdParty };
}
