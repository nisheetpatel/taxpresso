// The Zug deduction rules with a cap, a floor or a table, as small pure functions on centimes, each
// tested against the rule as the law, the guide or the table of amounts states it.
import { roundFranc, shareFranc } from '@taxpresso/rules-ch';
import type { IncomeRow } from './amounts.js';

/**
 * Flat amounts that are a share of a net income between a minimum and a maximum, and when the
 * income is under the minimum, that income: the other professional costs (3 %, guide p. 32: "Beträgt
 * Ihr Einkommen weniger als Fr. 2 000, entspricht der zulässige Abzug diesem geringeren
 * Einkommen") and a side job's costs (20 %, guide p. 34: "Die Abzüge dürfen die Nettoeinkünfte nicht
 * übersteigen").
 */
export function flatShare(net: number, p: { rateBp: number; min: number; max: number }): number {
  if (net <= 0) return 0;
  if (net < p.min) return net;
  return Math.min(p.max, Math.max(p.min, shareFranc(net, p.rateBp)));
}

/**
 * A car or a white-plate motorbike when public transport can't be used: the km one way, there and
 * back, each working day, at the rate per km, to the franc (guide p. 32).
 */
export function vehicleCost(kmOneWay: number, days: number, perKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * perKm);
}

/** 260, both spouses work: the lower earned income, at most the fixed amount, never below zero. */
export function twoEarnerDeduction(lowerEarned: number, max: number): number {
  return Math.max(0, Math.min(max, lowerEarned));
}

/** 406, AHV/IV pensioners: the first row whose net income limit is not exceeded; none above all. */
export function pensionerAmount(rows: readonly IncomeRow[], netIncome: number): number {
  return rows.find((r) => netIncome <= r.upTo)?.amount ?? 0;
}

/** 407, renters: the share of the net rent, to the franc, at most the yearly maximum. */
export function rentDeduction(rent: number, p: { shareBp: number; max: number }): number {
  return Math.min(p.max, shareFranc(Math.max(0, rent), p.shareBp));
}
