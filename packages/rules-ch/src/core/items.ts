// Building blocks for a canton's items: reading amounts into a trace, and the deductions whose rule
// has the same shape in the cantonal and the federal tax (each tax passes its own cited parameter).
// A shared rule returns a Deduction keyed by concept, not by a form's code: each canton puts it on
// its own line (Geneva: '71.00'; Zurich: '320') and records the limits it applied.
import { chf, roundFranc, Trace } from './calc.js';
import type { Param } from './cited.js';
import { medicalDeduction, mealsDeduction } from './rules.js';
import type { Amount, LimitApplied, Line, Text } from './types.js';
import type { MealAmounts } from '../ifd/2025.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = '\u00a0';

/** A deduction as a shared rule computes it: the canton gives it its form's code and label. */
export interface Deduction<C extends string = string> {
  concept: C;
  /** Negative: a deduction, in centimes. */
  amount: number;
  how: Text;
  /** What it rests on. The canton adds its form's line as a source, then makes the line. */
  trace: Trace;
}

/** A limit a shared rule applied: LimitApplied without the line, the person and the tax. */
export interface RuleLimit<C extends string = string> {
  concept: C;
  /** The constant that sets the limit (its source, and whether it is an estimate). */
  param: Pick<Param<unknown>, 'source' | 'estimate'>;
  kind: LimitApplied['kind'];
  given: number;
  limit: number;
  counted: number;
}

/** What a shared rule gives: at most one deduction, the limits it applied, and notes for the result. */
export interface RuleResult<C extends string = string> {
  deduction?: Deduction<C>;
  limits: RuleLimit<C>[];
  /** For the result's notCounted. */
  notCounted: Text[];
  /** For the result's unverifiedRules. */
  unverified: Text[];
}

/** The base a share is taken of, as the canton's form names it (Geneva: the subtotal 92.20). */
export interface FormBase {
  line: Line;
  /** With its article: { en: 'the subtotal 92.20', fr: 'du sous-total 92.20' }. */
  name: Text;
}

/** Sum of amounts read into a trace, to the franc (the form takes whole francs, guide p. 9). */
export function francTotal(tr: Trace, amounts: readonly (Amount | undefined)[]): number {
  return roundFranc(amounts.reduce((s, a) => s + tr.a(a), 0));
}

/** A trace that carries the facts of answers (counts of days, ways to work): no amount of its own. */
export function answered(facts: readonly string[] | undefined, status?: Amount['status']): Trace {
  const tr = new Trace();
  tr.a({ value: 0, facts: facts ?? [], ...(status ? { status } : {}) });
  return tr;
}

/** How a meals deduction was found, with the day rate and the yearly limit. */
export function mealsHow(m: MealAmounts, v: number, days: number, canteen: boolean): Text {
  const [perDay, perYear] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
  return t(
    `${days} days of lunch away from home x ${chf(perDay)}${canteen ? ' (half: your employer pays part of it, box G)' : ''}, at most ${chf(perYear)} a year: ${chf(v)}.`,
    `${days} jours de repas hors du domicile x ${chf(perDay)}${canteen ? ' (moitié${NB}: l’employeur en paie une partie, case G)' : ''}, au plus ${chf(perYear)} par an${NB}: ${chf(v)}.`,
  );
}

/**
 * Meals away from home (meal days at the day rate, half with a canteen, at most the yearly limit),
 * for someone with a salary. `meals` is the tax's own constant (Geneva ICC: guide p. 19; IFD:
 * the federal circular).
 */
export function mealsCosts(
  meals: Param<MealAmounts>,
  { days, canteen, facts }: { days: number; canteen: boolean; facts?: readonly string[] },
): RuleResult<'meals'> {
  const tr = answered(facts);
  const m = tr.p(meals);
  const v = mealsDeduction(days, canteen, m);
  if (!v) return { limits: [], notCounted: [], unverified: [] };
  const [day, year] = canteen ? [m.halfPerDay, m.halfPerYear] : [m.perDay, m.perYear];
  return {
    deduction: { concept: 'meals', amount: -v, how: mealsHow(m, v, days, canteen), trace: tr },
    limits: [
      { concept: 'meals', param: meals, kind: 'cap', given: days * day, limit: year, counted: v },
    ],
    notCounted: [],
    unverified: [],
  };
}

/**
 * Medical costs above a share of the form's base (Geneva: the subtotal 92.20). `tax` names the
 * tax in the note when nothing is deducted ('ICC', 'IFD').
 */
export function medicalCosts(
  threshold: Param<number>,
  costs: number,
  base: FormBase,
  input: Trace,
  tax: string,
): RuleResult<'medical'> {
  const tr = new Trace().with(input).from(base.line);
  const rate = tr.p(threshold);
  const { threshold: floor, deduction: v } = medicalDeduction(costs, base.line.amount, rate);
  const limits: RuleLimit<'medical'>[] = [
    {
      concept: 'medical',
      param: threshold,
      kind: 'threshold',
      given: costs,
      limit: floor,
      counted: v,
    },
  ];
  if (v > 0)
    return {
      deduction: {
        concept: 'medical',
        amount: -v,
        trace: tr,
        how: t(
          `Costs ${chf(costs)} less ${rate / 100} % of ${base.name.en} (${chf(base.line.amount)}), that is ${chf(floor)}: ${chf(v)}.`,
          `Frais ${chf(costs)} moins ${String(rate / 100).replace('.', ',')}${NB}% ${base.name.fr} (${chf(base.line.amount)}), soit ${chf(floor)}${NB}: ${chf(v)}.`,
        ),
      },
      limits,
      notCounted: [],
      unverified: [],
    };
  return {
    limits,
    notCounted: [
      t(
        `Medical costs (${tax}): below the threshold, nothing to deduct.`,
        `Frais médicaux (${tax})${NB}: sous le seuil, rien à déduire.`,
      ),
    ],
    unverified: [],
  };
}
