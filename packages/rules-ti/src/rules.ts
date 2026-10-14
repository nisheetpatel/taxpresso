// The Ticino rules with a cap, a share or a band, as small pure functions on centimes, each tested
// against the instructions' examples or tables (ti-2025-guide-istruzioni-pf-pdf) or the rule as the
// documents state it. The tariffs are in ./tariff.ts.
import { roundFranc, roundTo } from '@taxpresso/rules-ch';

/**
 * Modulo 4, 2.2: driving to work when no public transport can be used, there and back each day at
 * so much a km, to the franc (km a day x days x CHF 0.60).
 */
export function drivingCost(kmOneWay: number, days: number, perKm: number) {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * perKm);
}

/** Modulo 4, 3.1: days at the day rate, at most the yearly amount. */
export function mealsCost(days: number, perDay: number, perYear: number) {
  return Math.min(perYear, Math.max(0, days) * perDay);
}

/**
 * Modulo 4, 5: the flat amount for other professional costs, halved under the work rate or the
 * months given (decree art. 7 cpv. 3; from 2026 LT art. 25 cpv. 2): "meno di 6 mesi" and "inferiore
 * al 50%". Work rate in percent, months 1 to 12.
 */
export function otherFlat(
  p: { amount: number; halfBelowRate: number; halfBelowMonths: number },
  workRate: number,
  months: number,
) {
  return workRate < p.halfBelowRate || months < p.halfBelowMonths ? p.amount / 2 : p.amount;
}

/**
 * 12, insurance premiums and savings interest: at most the cap for spouses or for other
 * taxpayers, raised when no contribution was paid to a pension fund or pillar 3a, plus so much per
 * child or dependant (Modulo 6, 2.). `children` may be fractional only if a reading asks for it.
 */
export function insuranceCap(
  p: {
    married: number;
    other: number;
    marriedNoPension: number;
    otherNoPension: number;
    perChild: number;
  },
  a: { married: boolean; noPension: boolean; children: number },
) {
  const base = a.married ? p.married : p.other;
  const extra = a.noPension ? (a.married ? p.marriedNoPension : p.otherNoPension) : 0;
  return base + extra + Math.round(p.perChild * a.children);
}

/**
 * 13.2, private debt interest: up to the gross income from movable and immovable wealth (cifre 4
 * and 5) plus a fixed amount (the instructions' examples, p. 27: 44,000 + 50,000 = 94,000; 80,000
 * paid, 80,000 deducted; 120,000 paid, 94,000 deducted).
 */
export function debtInterestDeduction(paid: number, wealthIncome: number, extra: number) {
  const cap = Math.max(0, wealthIncome) + extra;
  return { cap, deduction: Math.min(Math.max(0, paid), cap) };
}

/**
 * 27, the exemption for AVS and AI pensioners (LT art. 34 cpv. 2): the full amount up to the
 * income limit of the tariff, then so much less for each step of income above it, begun; never
 * more than the pension itself (a partial pension). The instructions' table (p. 32): up to 21,000,
 * 8,000; 21,001 to 24,000, 7,000; ... from 42,001, nothing (single tariff); the family tariff from
 * 27,000. The net income (cifra 26) in centimes, whole francs.
 */
export function avsExemption(
  p: { amount: number; singleUpTo: number; familyUpTo: number; step: number; reduction: number },
  netIncome: number,
  family: boolean,
  pension: number,
) {
  const limit = family ? p.familyUpTo : p.singleUpTo;
  const above = Math.max(0, netIncome - limit);
  const steps = Math.ceil(above / p.step);
  return Math.max(0, Math.min(p.amount - steps * p.reduction, Math.max(0, pension)));
}

/**
 * 15.5, both spouses work: at most the amount, never more than the lower of the two incomes
 * (ti-2025-guide-istruzioni-pf-pdf p. 29). Nothing when one spouse has none.
 */
export function twoEarnerDeduction(incomes: readonly number[], max: number) {
  if (incomes.length !== 2 || incomes.some((v) => v <= 0)) return 0;
  return Math.min(max, ...incomes);
}

/** A tax times a coefficient or multiplier in hundredths of a percent, to 5 centimes. */
export function shareOfTax(tax: number, hundredths: number) {
  return roundTo(tax * hundredths, 10_000, 5);
}
