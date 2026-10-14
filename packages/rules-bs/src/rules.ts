// The Basel-Stadt rules with a cap, a share or a reduction, as small pure functions on centimes,
// each tested against the guide's worked example (bs-2025-guide-wegleitung p. 11 to 17) or the
// rule as the documents state it.
import { bracketTax, round5, roundFranc, shareFranc, type BracketScale } from '@taxpresso/rules-ch';

/**
 * 500, the cantonal flat amount for professional costs: whole above the part-time limit; at the
 * limit or below, cut in proportion to the work rate, to the franc, never below the minimum
 * (bs-2025-guide-wegleitung p. 30; the example, p. 14: a work rate of 25 % gives CHF 1,050).
 * The work rate in percent.
 */
export function professionalFlat(
  workRate: number,
  p: { amount: number; partTimeRate: number; minimum: number },
) {
  if (!(workRate > 0)) throw new RangeError('The work rate is a percentage above zero.');
  if (workRate > p.partTimeRate) return p.amount;
  return Math.max(p.minimum, shareFranc(p.amount, Math.round(workRate * 100)));
}

/**
 * 503, driving to work when public transport can't reasonably be used: there and back each day at
 * so much a km, to the franc (bs-2025-guide-wegleitung p. 30; form B: km a day x days = km a year
 * x CHF 0.70).
 */
export function drivingCost(kmOneWay: number, days: number, perKm: number) {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * perKm);
}

/** 504, lunch away from home: days (at most the yearly number) at the day rate, at most a year. */
export function mealsCost(days: number, perDay: number, perYear: number, maxDays: number) {
  return Math.min(perYear, Math.min(Math.max(0, days), maxDays) * perDay);
}

/**
 * 725, illness costs above a share of the net income II (719), the share to the nearest franc
 * (form K: 11,175 less 5 % of 115,886, that is 5,794: 5,381; bs-2025-guide-wegleitung p. 14).
 */
export function illnessDeduction(costs: number, netIncome2: number, thresholdBp: number) {
  const threshold = shareFranc(Math.max(0, netIncome2), thresholdBp);
  return { threshold, deduction: Math.max(0, costs - threshold) };
}

/** 732, donations from the minimum in the year, at most a share of the net income (709). */
export function donationDeduction(
  gifts: number,
  netIncome: number,
  p: { shareBp: number; min: number },
) {
  const cap = shareFranc(Math.max(0, netIncome), p.shareBp);
  return { cap, deduction: gifts < p.min ? 0 : Math.min(gifts, cap) };
}

/**
 * Accounts and securities (800): the market value, or the mean of the market value and the yield
 * value when lower; the yield value is the gross income times the factor (form W lines 11 to 16).
 * Whole francs in, whole francs out: the mean is cut to the franc.
 */
export function securitiesValue(market: number, grossIncome: number, factor: number) {
  const yieldValue = grossIncome * factor;
  const mean = Math.floor((market + yieldValue) / 200) * 100;
  return { yieldValue, mean, value: Math.min(market, mean) };
}

/** The tax by a tariff on an amount rounded down to the step (CHF 100 or CHF 1,000). */
export function tariffTax(scale: BracketScale, centimes: number, step: number) {
  return bracketTax(scale, Math.floor(Math.max(0, centimes) / step) * step);
}

/** A share of a tax, in hundredths of a percent, to the nearest 5 centimes. */
export function shareOfTax(tax: number, hundredths: number) {
  return round5(tax * hundredths, 10_000);
}

/**
 * StG § 51, a low income: the reduction of the wealth tax in basis points, by the first band whose
 * upper bound the wealth does not exceed (bands: [wealth up to, basis points]); 0 above the last.
 */
export function lowIncomeReductionBp(
  wealth: number,
  bands: readonly (readonly [number, number])[],
) {
  for (const [upTo, bp] of bands) if (wealth <= upTo) return bp;
  return 0;
}
