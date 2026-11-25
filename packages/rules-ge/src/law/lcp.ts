// Rules of the Geneva general law on public contributions (LCP, rsGE D 3 05, ge-na-law-lcp,
// consolidated to 1 January 2026) that the engine applies. Not indexed: the amounts are in the law
// itself, the same for tax years 2025 and 2026.
import type { Cited } from '@taxpresso/rules-ch';

/**
 * Taxe personnelle (art. 374 to 377): 25 francs a year, one per married couple or registered
 * partnership living together (art. 374 al. 2, art. 375). Exempt (art. 377 let. c): a taxpayer
 * without wealth whose income does not exceed 3,400 francs on the ordinary scale, 5,000 with full
 * splitting (LIPP art. 41 al. 2 or 3), 4,500 with partial splitting (LIPP art. 41 al. 4).
 */
export const PERSONAL_TAX: Cited<{
  amount: number;
  exemptUpTo: { none: number; full: number; partial: number };
}> = {
  source: 'ge-na-law-lcp art. 374, 375 and 377 let. c',
  value: { amount: 2_500, exemptUpTo: { none: 340_000, full: 500_000, partial: 450_000 } },
};

/**
 * Communal tax (art. 293, 295A): the communes levy their centimes on the cantonal base tax. A
 * privileged share (20 % to 80 %, fixed each year per commune) of each base tax goes to the commune
 * of residence; the rest goes to the communes concerned, the commune of residence included, in
 * proportion to the income and wealth attributable to each.
 */
export const COMMUNAL_SPLIT = {
  source: 'ge-na-law-lcp art. 293 let. A, art. 295A al. 1 and 2',
} as const;

/**
 * The share of another commune, where a salary is earned (art. 293 let. A ch. 1 let. c and ch. 2
 * let. c): the Conseil d'Etat's communiqué of each year says the privileged share goes to the
 * commune of residence, "le solde étant attribué à la commune d'activité (au taux de centime de la
 * commune d'activité)"; the guide asks the commune of work on each salary (p. 17). How the rest is
 * measured when there is other income is not spelled out (NOTE.communalSplit, ../engine/explain.ts).
 */
export const WORK_COMMUNE_SHARE: Readonly<Record<2025 | 2026, string>> = {
  2025: 'ge-2025-part-privilegiee-communique p. 8; ge-2025-guide-declaration-pp p. 17',
  2026: 'ge-2026-part-privilegiee-communique p. 12; ge-2025-guide-declaration-pp p. 17',
};
