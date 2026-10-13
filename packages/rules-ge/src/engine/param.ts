// A tax constant as the engine uses it (SPEC.md section 7): the value, the official document it
// comes from (manifest id plus page or article) and, when the value for the tax year is not
// published yet, why it is an estimate (SPEC.md section 9: estimates are flagged everywhere).
import type { Cited } from '../2025/icc.js';

/** Why a constant is an estimate. Each reason has its plain-words text in ./explain.ts. */
export type EstimateReason = 'ge-2026-unpublished';

export interface Param<T> extends Cited<T> {
  estimate?: EstimateReason;
}

/** The same cited value, flagged as an estimate for a later year. */
export function estimated<T>(param: Cited<T>, reason: EstimateReason): Param<T> {
  return { value: param.value, source: param.source, estimate: reason };
}

/**
 * A progressive scale by brackets (barème par tranches): [upper bound of the bracket in CHF,
 * rate numerator]. The rate is numerator / denominator: 730 / 10_000 is 7.30 %, 149 / 100_000 is
 * 1.49 per mille. The last bracket's upper bound is Infinity.
 */
export interface BracketScale {
  denominator: number;
  brackets: readonly (readonly [number, number])[];
}

/**
 * The federal scale (art. 36 LIFD): [income in CHF where the step starts, tax there in centimes,
 * centimes per further CHF 100].
 */
export type FederalStep = readonly [number, number, number];
