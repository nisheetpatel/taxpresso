// Exact integer arithmetic on centimes, the official rounding rules, the two kinds of scale, and
// the trace that collects, for each figure, the sources, estimates and facts it rests on.
import type { BracketScale, EstimateReason, FederalStep, Param } from './param.js';
import type { Amount, Line, Text } from './types.js';

/** num / den to the nearest multiple of `step` centimes, halves up. num >= 0, den > 0. */
export function roundTo(num: number, den: number, step: number): number {
  if (num < 0) return -roundTo(-num, den, step);
  return Math.floor((2 * num + step * den) / (2 * step * den)) * step;
}

/** Nearest 5 centimes: the precision of every amount in the Geneva tariff (ge-2025-icc-tariff-pdf). */
export const round5 = (num: number, den = 1) => roundTo(num, den, 5);

/** Nearest franc: deductions computed as a share (guide p. 19: 65,033 x 3 % is taken as 1,951). */
export const roundFranc = (num: number, den = 1) => roundTo(num, den, 100);

/** Whole francs, centimes dropped: incomes on the form are in francs (guide p. 9). */
export const floorFranc = (centimes: number) => Math.floor(centimes / 100) * 100;

/** amount x bp / 10,000 to the nearest franc. */
export const shareFranc = (amount: number, bp: number) => roundFranc(amount * bp, 10_000);

/** amount x bp / 10,000 to the nearest 5 centimes. */
export const share5 = (amount: number, bp: number) => round5(amount * bp, 10_000);

/**
 * Tax on an amount by brackets: each bracket's tax rounded to 5 centimes, as the tariff's
 * "impôt maximum de la tranche" column and its worked examples are (ge-2025-icc-tariff-pdf p. 2, 3,
 * 5 and 6).
 */
export function bracketTax(scale: BracketScale, centimes: number): number {
  if (centimes <= 0) return 0;
  let previous = 0;
  let total = 0;
  for (const [upperChf, rate] of scale.brackets) {
    const upper = upperChf === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : upperChf * 100;
    if (centimes <= upper) return total + round5((centimes - previous) * rate, scale.denominator);
    total += round5((upper - previous) * rate, scale.denominator);
    previous = upper;
  }
  return total;
}

/**
 * The federal scale at an income already rounded down to the CHF 100 (Form. 58c note 1): the tax
 * where the step starts plus so much per further CHF 100.
 */
export function federalScaleTax(steps: readonly FederalStep[], incomeCentimes: number): number {
  const chf = Math.floor(Math.max(0, incomeCentimes) / 100);
  let tax = 0;
  for (const [start, base, per100] of steps) {
    if (chf >= start) tax = base + Math.floor((chf - start) / 100) * per100;
  }
  return tax;
}

/** "CHF 1’234.56", the Swiss way of writing it in both languages. */
export function chf(centimes: number): string {
  const abs = Math.abs(centimes);
  const francs = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `${centimes < 0 ? '-' : ''}CHF ${francs}.${String(abs % 100).padStart(2, '0')}`;
}

/** Basis points as a percentage: 4750 -> "47.5 %", "47,5 %" in French. */
export function percent(bp: number, lang: 'en' | 'fr'): string {
  const s = String(bp / 100);
  return `${lang === 'fr' ? s.replace('.', ',') : s}\u00a0%`;
}

/**
 * What one figure rests on. `p` reads a constant (and records its source and, for a later year,
 * that it is an estimate); `a` reads an input amount (and records its facts and status).
 */
export class Trace {
  readonly sources = new Set<string>();
  readonly estimates = new Set<string>();
  readonly facts = new Set<string>();
  needsOk = false;

  p<T>(param: Param<T>): T {
    this.sources.add(param.source);
    if (param.estimate) this.estimates.add(param.estimate);
    return param.value;
  }

  a(amount: Amount | undefined): number {
    if (!amount) return 0;
    for (const f of amount.facts ?? []) this.facts.add(f);
    if (amount.status === 'estimate') this.estimates.add('input-estimate');
    if (amount.status === 'extracted') this.needsOk = true;
    return amount.value;
  }

  src(...sources: string[]): this {
    for (const s of sources) this.sources.add(s);
    return this;
  }

  /**
   * The estimates and facts of the figures this one is computed from, e.g. a subtotal's items.
   * Their sources stay on them: each line cites only the rule it applies.
   */
  from(...lines: (Line | undefined)[]): this {
    for (const line of lines) {
      if (!line) continue;
      for (const e of line.estimates ?? []) this.estimates.add(e);
      for (const f of line.facts ?? []) this.facts.add(f);
      if (line.needsOk) this.needsOk = true;
    }
    return this;
  }

  /** The inputs other traces read (their estimates and facts, not their sources). */
  with(...traces: Trace[]): this {
    for (const tr of traces) {
      for (const e of tr.estimates) this.estimates.add(e);
      for (const f of tr.facts) this.facts.add(f);
      if (tr.needsOk) this.needsOk = true;
    }
    return this;
  }

  line(amount: number, label: Text, how: Text): Line {
    return {
      amount,
      label,
      how,
      sources: [...this.sources],
      ...(this.estimates.size ? { estimates: [...this.estimates] } : {}),
      ...(this.needsOk ? { needsOk: true } : {}),
      ...(this.facts.size ? { facts: [...this.facts] } : {}),
    };
  }
}

export type { EstimateReason };
