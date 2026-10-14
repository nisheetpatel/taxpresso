// Rules of the Lucerne Steuergesetz whose figures are in the law itself and not indexed: the same
// text, on the same pages, in the versions in force in 2025 (lu-2025-law-steuergesetz) and from
// 2026 (lu-2026-law-steuergesetz). The Steuerbuch chapters that explain them moved by a few pages
// between its 2025 and 2026 editions.
import type { Cited } from '@taxpresso/rules-ch';
import type { LuTaxYear } from './params.js';

const LAW: Record<LuTaxYear, string> = {
  2025: 'lu-2025-law-steuergesetz',
  2026: 'lu-2026-law-steuergesetz',
};
const BOOK: Record<LuTaxYear, string> = {
  2025: 'lu-2025-deductions-steuerbuch-band1',
  2026: 'lu-2026-deductions-steuerbuch-band1',
};
const GUIDE: Record<LuTaxYear, string> = {
  2025: 'lu-2025-guide-wegleitung',
  2026: 'lu-2026-guide-wegleitung-unterjaehrig',
};
/** A page of the Steuerbuch, in the 2025 or the 2026 edition. */
const page = (year: LuTaxYear, p2025: number, p2026: number) => (year === 2025 ? p2025 : p2026);

/**
 * The tariffs give the tax per unit (§ 2 Abs. 1); the state levies so many units of it (§ 2
 * Abs. 2), the commune so many (§ 236 Abs. 2), and the parish so many from its members (§ 240
 * Abs. 1). The same units for income and wealth.
 */
export function multipliers(taxYear: LuTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} § 2 Abs. 1 and 2 (p. 1 and 2), § 236 Abs. 2 (p. 95), § 240 Abs. 1 (p. 96); ${GUIDE[taxYear]} p. 58 and 60`,
  };
}

/** Income under CHF 100 is not counted (§ 57 Abs. 3), wealth under CHF 1,000 (§ 60 Abs. 2). */
export function tariffSteps(taxYear: LuTaxYear): Cited<{ income: number; wealth: number }> {
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LAW[taxYear]} § 57 Abs. 3 (p. 30), § 60 Abs. 2 (p. 32)`,
  };
}

/**
 * Höchstbelastung (§ 62): the income tax of the state, the commune and the parishes together at
 * most 22,8 % (single tariff) or 22,4 % (family tariff) of the taxable income, in basis points;
 * their wealth tax at most 3,0 per mille of the taxable wealth, in hundred-thousandths.
 */
export function maxBurden(
  taxYear: LuTaxYear,
): Cited<{ singleBp: number; familyBp: number; wealth: number }> {
  return {
    value: { singleBp: 2280, familyBp: 2240, wealth: 300 },
    source: `${LAW[taxYear]} § 62 Abs. 1 and 2 (p. 33); ${BOOK[taxYear]} p. ${page(taxYear, 246, 251)} (§ 62 Nr. 1); ${GUIDE[taxYear]} p. 60`,
  };
}

/**
 * The Personalsteuer (§ 230 to 232): CHF 50 a year from whoever is taxable in the canton at the end
 * of the year, from the year they turn 18; spouses living together pay one; people known to be in
 * need are exempt.
 */
export function personalTax(taxYear: LuTaxYear): Cited<{ amount: number; fromAge: number }> {
  return {
    value: { amount: 5_000, fromAge: 18 },
    source: `${LAW[taxYear]} § 230 Abs. 1 to 3, § 231, § 232 Abs. 1 (p. 94)`,
  };
}

/**
 * The church tax is levied only from members of a recognised church (§ 240 Abs. 1). When the
 * members of a family belong to different confessions, the claim is shared in proportion of each
 * confession's members to all the family's members (§ 240 Abs. 2). The return asks the confession
 * of each taxpayer and of each child (Ziffer 2 and 3 of page 1).
 */
export function churchShares(taxYear: LuTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} § 240 Abs. 1 and 2 (p. 96); ${GUIDE[taxYear]} p. 20 (Konfession)`,
  };
}

/**
 * § 57 Abs. 2 (the family tariff) applies to married couples, and to widowed, separated, divorced
 * and single persons who live with children or people in need and mainly bear their upkeep; the
 * situation at the end of the year decides (§ 57 Abs. 4). With joint parental authority, the guide
 * gives it to the parent who receives child support; without child support, to the parent who
 * bears more of the children's costs or cares for them longer (rules in the guide).
 */
export function familyTariff(taxYear: LuTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} § 57 Abs. 2 and 4 (p. 30); ${BOOK[taxYear]} p. ${page(taxYear, 236, 241)} (§ 57 Nr. 1); ${GUIDE[taxYear]} p. 20`,
  };
}

/**
 * Parents taxed apart: the parent who receives child support for a child counts it; the one who
 * pays deducts the support and has no child deduction (Kumulationsverbot); with joint parental
 * authority and no child support, each has half the child deduction, half the insurance amount per
 * child and half the tax-free wealth per child (§ 42 Abs. 2).
 */
export function sharedChildren(taxYear: LuTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} § 42 Abs. 2 (p. 24); ${BOOK[taxYear]} p. ${page(taxYear, 188, 193)} (§ 42 Nr. 2 Ziff. 1.4); ${GUIDE[taxYear]} p. 20 and 34`,
  };
}
