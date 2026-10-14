// The Aargau deduction rules with a cap, a floor, a threshold or a step, as small pure functions on
// centimes, each tested against the official documents' wording and examples. The flat-share, meal
// and donation rules are every canton's (packages/rules-ch, core/rules.ts).
import { roundFranc, roundTo } from '@taxpresso/rules-ch';

export {
  donationDeduction,
  flatProfessional as flatShare,
  mealsDeduction,
  pillar3aCapWithoutFund,
} from '@taxpresso/rules-ch';

/**
 * Driving to work when public transport can't be used: there and back each day, per km, to the
 * franc; for a car, every km beyond `carKm` in the year at the rate less `carLess` (StGV § 13
 * Abs. 1: "Für jeden weiteren Fahrkilometer wird ein um 20 Rappen tieferer Pauschalabzug gewährt").
 */
export function drivingCost(
  kmOneWay: number,
  days: number,
  rate: number,
  car?: { carKm: number; carLess: number },
): { km: number; cost: number } {
  const km = Math.max(0, kmOneWay) * 2 * Math.max(0, days);
  if (!car) return { km, cost: roundFranc(km * rate) };
  const first = Math.min(km, car.carKm);
  return { km, cost: roundFranc(first * rate + (km - first) * (rate - car.carLess)) };
}

/**
 * Medical and accident costs (StG § 40 Abs. 1 lit. i): deductible above 5 % of the income less the
 * deductions of §§ 35 to 40, which include this deduction itself. The guide solves it as the form
 * does: the costs come off in full (17.1), then the Selbstbehalt is added back (18), the Nettoein-
 * kommen after the costs x 5 : 95 (ag-2025-guide-wegleitung p. 31; the canton's table: "Nettoeink. x
 * 5 : 95"). `base` is the income less every deduction of §§ 35 to 40 but these costs; the Selbstbehalt
 * is taken to the franc, and never more than the costs.
 */
export function medicalDeduction(costs: number, base: number, thresholdBp: number) {
  const selbstbehalt = roundFranc(Math.max(0, base - costs) * thresholdBp, 10_000 - thresholdBp);
  const addBack = Math.min(selbstbehalt, costs);
  return { selbstbehalt, addBack, deduction: costs - addBack };
}

/**
 * Both spouses earn (StG § 40 Abs. 1 lit. h; guide 16.): the fixed amount, at most what the second
 * earner (the lower earned income) has left after professional costs, pillar 3a and buy-ins.
 */
export function twoEarnerDeduction(lowerLeft: number, amount: number): number {
  return Math.max(0, Math.min(amount, lowerLeft));
}

/**
 * Low incomes (StG § 42 Abs. 1bis): the deduction of the step the Reineinkommen less the
 * Sozialabzüge falls in (in whole francs), nothing above the last step. `previous` is the top of the
 * step below and its deduction, when the base is in a later step or above the last: the marginal
 * burden from there must not exceed 100 % (§ 43 Abs. 3).
 */
export function lowIncomeDeduction(
  base: number,
  steps: readonly (readonly [number, number])[],
): { deduction: number; previous?: { top: number; deduction: number } } {
  const francs = Math.floor(base / 100) * 100;
  const k = steps.findIndex(([top]) => francs <= top);
  const deduction = k < 0 ? 0 : steps[k]![1];
  const below = k < 0 ? steps.at(-1) : k > 0 ? steps[k - 1] : undefined;
  return below ? { deduction, previous: { top: below[0], deduction: below[1] } } : { deduction };
}

/** A tax to 10 centimes, halves up (law.ts, taxRounding). */
export const round10 = (num: number, den = 1) => roundTo(num, den, 10);
