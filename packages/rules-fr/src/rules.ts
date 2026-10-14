// The Fribourg deduction rules with a cap, a floor, a threshold or a taper, as small pure functions
// on centimes, each tested against the guide's tables (fr-2025-guide-instructions-generales) or the
// rule as the law states it.
import { flatProfessional, roundFranc } from '@taxpresso/rules-ch';
import type { FlatShare, FrAmounts, Tapered } from './amounts.js';

/**
 * A deduction that shrinks: the whole amount while the base is at most the limit, then the cut for
 * each started step above it, never below zero (guide p. 37 and 38: "de 20 301 à 21 300", 3,900;
 * p. 39: wealth "de Fr. 75 001.- à Fr. 100 000.-", 45,000). Amounts in centimes.
 */
export function tapered(p: Tapered, base: number): number {
  if (base <= p.limit) return p.amount;
  const steps = Math.ceil((base - p.limit) / p.step);
  return Math.max(0, p.amount - steps * p.cut);
}

/**
 * 6.110, children: for `count` children at your charge, each child's amount (the first two at
 * `first`, then `fromThird`), whole while the net income (4.910) is at most the limit for that many
 * children; above it, each child's amount less the cut for each started step, never below the
 * child's minimum (LICD art. 36 al. 1 let. a; guide p. 35: one child, 65,701 to 66,700, 8,200; two
 * children from 86,801, 14,200). The amounts of each child, in centimes.
 */
export function childAmounts(
  c: FrAmounts['children']['value'],
  count: number,
  netIncome: number,
): number[] {
  if (count <= 0) return [];
  const limit = c.limit + (count - 1) * c.perChild;
  const steps = netIncome > limit ? Math.ceil((netIncome - limit) / c.step) : 0;
  return Array.from({ length: count }, (_, i) => {
    const [whole, min] = i < 2 ? [c.first, c.minFirst] : [c.fromThird, c.minFromThird];
    return Math.max(min, whole - steps * c.cut);
  });
}

/**
 * 2.110, a car when public transport can't be used: there and back each day, each km at the rate of
 * its mileage band (70 ct up to 10,000 km, 60 ct for the next 10,000, 50 ct above), to the franc
 * (fr-na-deductions-frais-professionnels art. 3 al. 3).
 */
export function carCost(
  kmOneWay: number,
  days: number,
  bands: readonly (readonly [number, number])[],
): number {
  const km = Math.max(0, kmOneWay) * 2 * Math.max(0, days);
  let cost = 0;
  let from = 0;
  for (const [upTo, perKm] of bands) {
    if (km <= from) break;
    cost += (Math.min(km, upTo) - from) * perKm;
    from = upTo;
  }
  return roundFranc(cost);
}

/** A yearly amount for `days` of a full year of `yearDays` working days, to the franc. */
export function prorated(perYear: number, days: number, yearDays: number): number {
  return roundFranc(perYear * Math.min(Math.max(0, days), yearDays), yearDays);
}

/**
 * 2.140, a side job: 20 % of its net salary, at least 800 but never more than the salary, at most
 * 2,400 (guide p. 13).
 */
export function sideJobFlat(net: number, p: FlatShare): number {
  return Math.max(0, Math.min(net, flatProfessional(net, p)));
}

/**
 * 2.510, both spouses work: the fixed amount from the lower income, at most that income after its
 * costs 2.110 to 2.140 (guide p. 14: "seul ce montant pourra être déduit").
 */
export function twoEarnerDeduction(lowerLeft: number, amount: number): number {
  return Math.max(0, Math.min(amount, lowerLeft));
}
