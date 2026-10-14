// Rules of Geneva's laws on a property in the canton that the engine applies (./../engine/property.ts).
// Not indexed: the amounts are in the laws themselves, the same for tax years 2025 and 2026
// (LIPP, ge-na-law-lipp, and LCP, ge-na-law-lcp, consolidated on 1 January 2026; the 2025 guide,
// ge-2025-guide-declaration-pp, says the same for 2025).
import type { Cited } from '@taxpresso/rules-ch';

/**
 * The abattement for continuous use by the same owner: the estimate of a villa or a flat in PPE is
 * lowered by 4 % for each year of continuous use, at most 40 % (LIPP art. 50 let. e). The guide
 * counts the years from the year the owner moved in to the tax year, both included ("Villa occupée
 * de 2010 à 2025, soit 16 ans", 16 x 4 % = 64 %, at most 40 %), and applies the same percentage to
 * the rental value for the cantonal tax ("ICC - Valeur locative après abattement", p. 33 and 34).
 * In basis points.
 */
export const ABATTEMENT: Cited<{ perYearBp: number; maxBp: number }> = {
  value: { perYearBp: 400, maxBp: 4000 },
  source: 'ge-na-law-lipp art. 50 let. e; ge-2025-guide-declaration-pp p. 33 and 34',
};

/**
 * The impôt immobilier complémentaire (LCP art. 76): a yearly tax on the value of every property in
 * the canton, 1 per mille (al. 1), 0.2 per mille for property of individuals that is their main
 * home (al. 5, from tax period 2025: ge-2025-guide-declaration-pp p. 36), on the estimate of LIPP
 * art. 50 without the abattement and without deducting any debt (al. 2), at its value on 31
 * December (al. 7), due by the owner registered on that date (al. 6); no cantonal or communal
 * centimes on it (art. 79). In per mille x 10 (10 = 1 per mille).
 */
export const IIC: Cited<{ rate: number; mainHome: number; denominator: number }> = {
  value: { rate: 10, mainHome: 2, denominator: 10_000 },
  source:
    'ge-na-law-lcp art. 76 al. 1, 2, 5, 6 and 7, art. 79; ge-na-iic-page (Vous êtes un particulier)',
};

/**
 * The taux d'effort (LIPP art. 24 al. 2): the cantonal rental value of the main home can't exceed
 * 20 % of the gross income (revenus bruts totaux), taken at least at the first tax-free bracket of
 * the scale (art. 41 al. 1) for a single person, twice that for spouses and single parents with
 * full splitting (art. 41 al. 2 and 3), and 1.8 times that with partial splitting (art. 41 al. 4);
 * the limited value counts only if the interest that finances the home is not higher than it.
 * The guide (p. 51) names the gross income 91.00 and the minimum 18,649 for 2025.
 */
export const EFFORT: Cited<{
  shareBp: number;
  factor: { none: number; full: number; partial: number };
}> = {
  value: { shareBp: 2000, factor: { none: 10, full: 20, partial: 18 } },
  source: 'ge-na-law-lipp art. 24 al. 2; ge-2025-guide-declaration-pp p. 51',
};
