// Exact integer arithmetic on centimes and the trace that collects, for each figure, the sources,
// estimates and facts it rests on. The same helpers as packages/rules-ge/src/engine/calc.ts, kept
// here so this package depends on no canton; both move to packages/rules-ch
// (docs/design/cantons.md, section 1).
import type { Cited } from './cited.js';
import type { Amount, Line, Text } from './types.js';

/** num / den to the nearest multiple of `step` centimes, halves up. den > 0. */
export function roundTo(num: number, den: number, step: number): number {
  if (num < 0) return -roundTo(-num, den, step);
  return Math.floor((2 * num + step * den) / (2 * step * den)) * step;
}

/** Nearest centime. */
export const roundCentime = (num: number, den = 1) => roundTo(num, den, 1);

/**
 * Nearest franc: the form takes whole francs ("CHF ohne Rappen"), and a share it prints is
 * rounded to the nearest franc (zh-2026-guide-unterjaehrig p. 37: 13,600 : 360 x 150 = 5,666.67
 * is printed 5,667).
 */
export const roundFranc = (num: number, den = 1) => roundTo(num, den, 100);

/** amount x bp / 10,000 to the nearest franc. */
export const shareFranc = (amount: number, bp: number) => roundFranc(amount * bp, 10_000);

/** "CHF 1’234.56". */
export function chf(centimes: number): string {
  const abs = Math.abs(centimes);
  const francs = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `${centimes < 0 ? '-' : ''}CHF ${francs}.${String(abs % 100).padStart(2, '0')}`;
}

/** A multiplier in percent: 95 -> "95 %". */
export const pct = (percent: number) => `${String(percent)}\u00a0%`;

/**
 * What one figure rests on. `p` reads a constant (and records its source); `a` reads an input
 * amount (and records its facts and status).
 */
export class Trace {
  readonly sources = new Set<string>();
  readonly estimates = new Set<string>();
  readonly facts = new Set<string>();
  needsOk = false;
  incomplete = false;

  p<T>(param: Cited<T>): T {
    this.sources.add(param.source);
    return param.value;
  }

  a(amount: Amount | undefined): number {
    if (!amount) return 0;
    for (const f of amount.facts ?? []) this.facts.add(f);
    if (amount.status === 'estimate') this.estimates.add('input-estimate');
    if (amount.status === 'extracted') this.needsOk = true;
    if (amount.complete === false) this.incomplete = true;
    return amount.value;
  }

  src(...sources: string[]): this {
    for (const s of sources) this.sources.add(s);
    return this;
  }

  /** The estimates and facts of the figures this one is computed from (not their sources). */
  from(...lines: (Line | undefined)[]): this {
    for (const line of lines) {
      if (!line) continue;
      for (const e of line.estimates ?? []) this.estimates.add(e);
      for (const f of line.facts ?? []) this.facts.add(f);
      if (line.needsOk) this.needsOk = true;
      if (line.incomplete) this.incomplete = true;
    }
    return this;
  }

  /** The inputs other traces read (their estimates and facts, not their sources). */
  with(...traces: Trace[]): this {
    for (const tr of traces) {
      for (const e of tr.estimates) this.estimates.add(e);
      for (const f of tr.facts) this.facts.add(f);
      if (tr.needsOk) this.needsOk = true;
      if (tr.incomplete) this.incomplete = true;
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
      ...(this.incomplete ? { incomplete: true } : {}),
      ...(this.facts.size ? { facts: [...this.facts] } : {}),
    };
  }
}
