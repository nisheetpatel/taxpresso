// "Before 31 December": a pension fund buy-in (rachat LPP), SPEC.md section 8, group B. How much
// the fund allows comes from the user's pension certificate (the fund states it: LPP art. 79b
// al. 1); the tax saved for the amount they choose is the engine run with and without it, on top
// of the 3a they already paid. An amount above what the fund allows gets no figure.
import { LPP_BUYIN_FACTS } from '@taxpresso/rules-ch';
import {
  type Assumption,
  type Deduction,
  estimateSources,
  type HouseholdInput,
  noTaxOf,
  ordinaryTaxEstimator,
  savingOf,
  type TaxEstimate,
} from './tax-with.js';

export interface LppBuyInPerson {
  person: 'p1' | 'p2';
  /** What the pension certificate says can still be bought in, if the user gave it. */
  capacityCentimes?: number;
  /** The buy-in the user is considering this year. */
  amountCentimes?: number;
}

export type LppBuyInProblem =
  /** The amount is more than the fund allows: the fund wouldn't accept it. */
  | 'over_capacity'
  /** No salary known: nothing to compute the tax from. */
  | 'no_income'
  /** The canton's tax can't be computed for the year (its rates are not published). */
  | 'no_tax';

export interface LppBuyInResult {
  people: (LppBuyInPerson & { overCapacity: boolean })[];
  /** The amounts considered, all people together. */
  amountCentimes: number;
  /** Tax saved by paying them in by 31 December, on top of the 3a already paid. */
  saving?: TaxEstimate;
  problem?: LppBuyInProblem;
  /** Some amounts were given without what the fund allows: the certificate says it. */
  capacityUnknown: boolean;
  assumptions: Assumption[];
  facts: typeof LPP_BUYIN_FACTS;
  sources: string[];
}

export function lppBuyInPlan(h: HouseholdInput, people: readonly LppBuyInPerson[]): LppBuyInResult {
  const rows = people.map((p) => ({
    ...p,
    overCapacity:
      p.capacityCentimes !== undefined &&
      p.amountCentimes !== undefined &&
      p.amountCentimes > p.capacityCentimes,
  }));
  const amountCentimes = rows.reduce((sum, p) => sum + (p.amountCentimes ?? 0), 0);
  const result: LppBuyInResult = {
    people: rows,
    amountCentimes,
    capacityUnknown: rows.some((p) => p.amountCentimes && p.capacityCentimes === undefined),
    assumptions: [],
    facts: LPP_BUYIN_FACTS,
    sources: [LPP_BUYIN_FACTS.capacityFromFund, LPP_BUYIN_FACTS.deductible, ...estimateSources(h)],
  };
  if (rows.some((p) => p.overCapacity)) return { ...result, problem: 'over_capacity' };
  if (amountCentimes === 0) return result;
  const noTax = noTaxOf(h);
  if (noTax) return { ...result, problem: 'no_tax', assumptions: [noTax] };
  const estimator = ordinaryTaxEstimator(h);
  if (!estimator) return { ...result, problem: 'no_income' };
  const base: Deduction[] = h.people.map((p) => ({
    person: p.person,
    kind: 'pillar3a',
    centimes: p.paidCentimes,
  }));
  const buyIn: Deduction[] = rows
    .filter((p) => p.amountCentimes)
    .map((p) => ({ person: p.person, kind: 'lpp_buyin', centimes: p.amountCentimes! }));
  return {
    ...result,
    saving: savingOf(estimator.taxWith, base, buyIn),
    assumptions: estimator.assumptions,
  };
}
