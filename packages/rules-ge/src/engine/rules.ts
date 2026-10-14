// Geneva's own deduction rules with a cap, as small pure functions on centimes, so each can be
// tested against the worked examples of the official documents. The rules every canton shares (flat
// professional costs, medical threshold, donations, two earners, 3a without a fund, meals) are in
// packages/rules-ch (core/rules.ts).
import type { DecreasingRow } from '../2025/icc-amounts.js';

/**
 * ICC life insurance and savings interest limit (52.15, guide p. 28). The base (single or spouses)
 * plus the amount per family charge, both x1 when everyone pays into a 2nd pillar or 3a, x1.5 when
 * one spouse doesn't, x2 when nobody does. Returns the exact limit in centimes (may hold a half
 * franc) and the limit in whole francs, rounded down.
 */
export function lifeInsuranceCap(
  p: { single: number; married: number; perCharge: number },
  couple: boolean,
  contributing: number,
  charges: number,
): { exact: number; cap: number } {
  // In halves: 2 is x1, 3 is x1.5, 4 is x2.
  let halves = contributing ? 2 : 4;
  if (couple) halves = contributing >= 2 ? 2 : contributing === 1 ? 3 : 4;
  const base = couple ? p.married : p.single;
  const exact = ((base + p.perCharge * charges) * halves) / 2;
  return { exact, cap: Math.floor(exact / 100) * 100 };
}

/**
 * AVS/AI pensioners' deduction (61.30, guide p. 16): the row whose upper bound (in CHF) is not
 * below the subtotal 92.40; [upper, one pensioner, two pensioners] or [upper, amount].
 */
export function avsDeduction(
  rows: readonly DecreasingRow[],
  subtotal9240: number,
  twoPensioners: boolean,
) {
  const row = rows.find((r) => subtotal9240 <= r[0] * 100);
  if (!row) return 0;
  return (twoPensioners && row.length > 2 ? row[2] : row[1]) ?? 0;
}
