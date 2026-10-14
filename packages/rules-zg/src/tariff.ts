// Zug's tariffs give the einfache Steuer (the simple tax at a Steuerfuss of 100 %, StG § 2 Abs. 1)
// by brackets: so much percent for the first francs, so much for the next, and a last rate above
// the top bracket (StG § 35 for income, § 44 Abs. 2 for wealth). The brackets are indexed every
// year (§ 45), so each year's amounts are those of the Steuerverwaltung's tariff sheets
// (zg-2026-tariff-grundtarif, zg-2026-tariff-mehrpersonentarif: page 1 is 2026, page 2 is 2025).
//
// The tax is computed exactly on whole francs (the return takes no Rappen, zg-2025-guide-wegleitung
// p. 4), then rounded to the centime: the documents print every bracket's tax in centimes but do
// not say how a tax between two bracket ends is rounded (NOTE.rounding).
// scripts/zg-tariff.mjs --check compares each year's brackets with the sheets and this function
// with every amount they print. No imports of values: the script reads this module with Node's
// type stripping.
import type { BracketScale } from '@taxpresso/rules-ch';

/**
 * The einfache Steuer on an amount in centimes, francs only: each bracket's part at its rate,
 * added up exactly, then to the nearest centime (halves up). Rates are over `denominator`: income
 * in hundredths of a percent (3.25 % is 325 / 10,000), wealth in millionths (0.0425 % is
 * 425 / 1,000,000).
 */
export function simpleTax(scale: BracketScale, centimes: number): number {
  const chf = Math.floor(Math.max(0, centimes) / 100);
  let previous = 0;
  let numerator = 0; // CHF x rate; over the denominator, CHF
  for (const [upper, rate] of scale.brackets) {
    const top = Math.min(chf, upper);
    if (top > previous) numerator += (top - previous) * rate;
    if (chf <= upper) break;
    previous = upper;
  }
  if (!Number.isSafeInteger(numerator * 100)) throw new RangeError('Amount too large.');
  // numerator / denominator CHF = numerator x 100 / denominator centimes, halves up.
  return Math.floor((2 * numerator * 100 + scale.denominator) / (2 * scale.denominator));
}

/** The einfache Steuer as a share of the amount (the sheets' "Einfache Steuer in %"), unrounded. */
export function simpleRate(scale: BracketScale, centimes: number): number {
  const chf = Math.floor(Math.max(0, centimes) / 100);
  return chf ? simpleTax(scale, chf * 100) / 100 / chf : 0;
}
