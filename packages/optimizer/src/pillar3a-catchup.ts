// "Before 31 December": pillar 3a catch-up payments (rachat 3a), new from 2026 (SPEC.md section 8,
// group B). Who paid less than the 2025 maximum may make up that gap in 2026, at most the "small"
// 3a limit, once the full 2026 payment is made (OPP 3 art. 7a; ch-2026-ifd-instructions p. 8).
// Gaps before 2025 can never be made up (OPP 3, transitional provision).
import { PILLAR3A_2025, PILLAR3A_CATCHUP_2026, PILLAR3A_CATCHUP_FACTS } from '@taxpresso/rules-ch';
import {
  type Assumption,
  type Deduction,
  ESTIMATE_SOURCES,
  type HouseholdInput,
  ordinaryTaxEstimator,
  savingOf,
  type TaxEstimate,
} from './tax-with.js';

export interface CatchUpPerson {
  person: 'p1' | 'p2';
  /** What the person paid into 3a in 2025, if they said. */
  paid2025Centimes?: number;
  /** Whether they had a pension fund; taken as in 2026 (assumption shown). */
  hasPensionFund: boolean;
  /** 2026 3a room still open (./pillar3a.ts): it comes first. */
  room2026Centimes: number;
  /**
   * The person's own 2025 limit, when it is known: without a pension fund, 20 % of the 2025 earned
   * income read from last year's declaration (./last-year-review.ts). Default: the 2025 maximum.
   */
  limit2025Centimes?: number;
}

export type CatchUpStatus =
  /** 2025 payment not given: nothing to compute. */
  | 'unknown'
  /** The 2025 maximum was paid: no gap. */
  | 'no_gap'
  /** A gap exists, but the 2026 3a payment must be made in full first. */
  | 'pay_this_year_first'
  | 'possible';

export interface CatchUpPersonResult {
  person: 'p1' | 'p2';
  status: CatchUpStatus;
  /** The 2025 gap (2025 limit minus what was paid). */
  gapCentimes?: number;
  /**
   * Without a pension fund the 2025 limit was 20 % of the 2025 earned income, which Taxpresso
   * doesn't know: the gap and the catch-up are then the most they can be.
   */
  isMaximum: boolean;
  /** The most that can be paid in 2026 as a catch-up: the gap, within the yearly cap. */
  catchUpCentimes: number;
}

export type CatchUpAssumption = Assumption | 'pension_fund_2025_same';

export interface CatchUpResult {
  people: CatchUpPersonResult[];
  catchUpCentimes: number;
  /** The most a person can pay as catch-up in the year. */
  capInYearCentimes: number;
  /** Tax saved by the catch-ups, on top of the full 2026 payment (which comes first). */
  saving?: TaxEstimate;
  assumptions: CatchUpAssumption[];
  facts: typeof PILLAR3A_CATCHUP_FACTS;
  sources: string[];
}

function personResult(p: CatchUpPerson): CatchUpPersonResult {
  const cap = PILLAR3A_CATCHUP_2026.value.capInYear;
  if (p.paid2025Centimes === undefined) {
    return { person: p.person, status: 'unknown', isMaximum: false, catchUpCentimes: 0 };
  }
  const limit2025 =
    p.limit2025Centimes ??
    (p.hasPensionFund
      ? PILLAR3A_2025.value.capWithPensionFund
      : PILLAR3A_2025.value.capWithoutPensionFund);
  const gap = Math.max(0, limit2025 - p.paid2025Centimes);
  const catchUp = Math.min(gap, cap);
  return {
    person: p.person,
    status: gap === 0 ? 'no_gap' : p.room2026Centimes > 0 ? 'pay_this_year_first' : 'possible',
    gapCentimes: gap,
    isMaximum: !p.hasPensionFund && gap > 0 && p.limit2025Centimes === undefined,
    catchUpCentimes: catchUp,
  };
}

export function pillar3aCatchUpPlan(
  h: HouseholdInput,
  people: readonly CatchUpPerson[],
): CatchUpResult {
  const rows = people.map(personResult);
  const catchUpCentimes = rows.reduce((sum, r) => sum + r.catchUpCentimes, 0);
  const result: CatchUpResult = {
    people: rows,
    catchUpCentimes,
    capInYearCentimes: PILLAR3A_CATCHUP_2026.value.capInYear,
    assumptions: rows.some((r) => r.status !== 'unknown') ? ['pension_fund_2025_same'] : [],
    facts: PILLAR3A_CATCHUP_FACTS,
    sources: [PILLAR3A_CATCHUP_2026.source, PILLAR3A_2025.source, ...ESTIMATE_SOURCES],
  };
  const estimator = catchUpCentimes > 0 ? ordinaryTaxEstimator(h) : undefined;
  if (!estimator) return result;
  // The full 2026 payment first (what was paid plus the room), then the catch-ups on top.
  const full2026: Deduction[] = h.people.map((p) => ({
    person: p.person,
    kind: 'pillar3a',
    centimes: p.paidCentimes + (people.find((c) => c.person === p.person)?.room2026Centimes ?? 0),
  }));
  const catchUps: Deduction[] = rows
    .filter((r) => r.catchUpCentimes > 0)
    .map((r) => ({ person: r.person, kind: 'pillar3a_catchup', centimes: r.catchUpCentimes }));
  return {
    ...result,
    saving: savingOf(estimator.taxWith, full2026, catchUps),
    assumptions: [...result.assumptions, ...estimator.assumptions],
  };
}
