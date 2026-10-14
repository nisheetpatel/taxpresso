// The separate tax on lump sums from the 2nd pillar and pillar 3a (prestations en capital provenant
// de la prévoyance) in Geneva's laws, which the engine applies (../engine/capital.ts). Law, not
// indexed: the same for tax years 2025 and 2026.
//
// - ge-na-law-lipp art. 45: the capital benefits of art. 25 (pension funds, vested benefits, pillar
//   3a) are taxed apart from the other income, a full year's tax (al. 1), at the rate of a fifth of
//   the scale of art. 41 (al. 2); every lump sum of the year is added up for the rate, the spouses'
//   too, with the splitting of art. 41 al. 2 to 4 (al. 3); no social deduction (al. 4).
// - ge-na-law-lcacant art. 2: 47.5 cantonal centimes and 1 for home care on every cantonal tax on
//   income and wealth; ge-na-law-ldirpp art. 1: the cantonal income tax, the communal centimes
//   excepted, is reduced by 12 %. The 2025 tariff applies them in this order (ge-2025-icc-tariff-pdf
//   p. 4), and the AFC's own capital tariffs for people abroad, at a fifth of the LIPP scale with
//   the centimes, give the same rates (ge-2025-source-capital-icc-tariff, ge-2026-source-capital-
//   icc-tariff; packages/rules-ge/test/capital.test.ts checks them).
// - ge-na-law-lcp art. 293 let. A ch. 1: the commune of residence levies its centimes on all its
//   residents' income but what is earned in another commune; a lump sum is not, so the whole base
//   goes to the commune of residence (art. 295A al. 2: the privileged share and the rest alike).
import type { Cited } from '@taxpresso/rules-ch';

/** The rate is a fifth of the scale's (le taux représentant le cinquième du barème). */
export const CAPITAL_FIFTH: Cited<number> = {
  value: 5,
  source: 'ge-na-law-lipp art. 45 al. 2',
};

/** Every lump sum of the year is added up for the rate, the spouses' too; splitting applies. */
export const CAPITAL_ADDED_UP = {
  source: 'ge-na-law-lipp art. 45 al. 1 and 3',
} as const;

/** The centimes and the 12 % reduction on the capital tax, as on the income tax. */
export const CAPITAL_CENTIMES = {
  cantonal: 'ge-na-law-lcacant art. 2 al. 1',
  homeCare: 'ge-na-law-lcacant art. 2 al. 2',
  reduction: 'ge-na-law-ldirpp art. 1',
} as const;

/** The whole base goes to the commune of residence. */
export const CAPITAL_COMMUNE = {
  source: 'ge-na-law-lcp art. 293 let. A, art. 295A al. 2',
} as const;
