// A tax constant as every engine uses it (SPEC.md section 7): the value, the official document it
// comes from (manifest id plus page, article or paragraph) and, when the value for the tax year is
// not published yet, why it is an estimate (SPEC.md section 9: estimates are flagged everywhere).
// No imports: the website reads these modules with Node's type stripping (site/src/geneva-data.ts).

export interface Cited<T> {
  value: T;
  source: string;
}

/**
 * A cited constant as an engine reads it. `R` names why it can be an estimate; each canton has its
 * own reasons (Geneva: 'ge-2026-unpublished'), each with its plain-words text in that canton.
 */
export interface Param<T, R extends string = string> extends Cited<T> {
  estimate?: R;
}

/** The same cited value, flagged as an estimate for a later year. */
export function estimated<T, R extends string>(param: Cited<T>, reason: R): Param<T, R> {
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
