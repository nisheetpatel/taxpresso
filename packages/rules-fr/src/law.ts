// Rules of the Fribourg texts that carry no yearly amount, with their pages: the tax law (LICD, the
// version in force from 2025, which also governs 2026), the communal tax law (LICo), the 2025 guide
// and the SCC's source-tax documents where they state the practice for shared custody.
import type { Cited } from '@taxpresso/rules-ch';
import type { FrTaxYear } from './params.js';

const LAW = 'fr-2025-law-licd-consolidee';
const GUIDE = 'fr-2025-guide-instructions-generales';

/** Taxable income in whole CHF 100 (LICD art. 37 al. 4), taxable wealth in whole CHF 1,000 (art. 62 al. 2). */
export function amountSteps(): Cited<{ income: number; wealth: number }> {
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LAW} art. 37 al. 4 (p. 28), art. 62 al. 2 (p. 37)`,
  };
}

/**
 * Married couples living together, and widowed, separated, divorced or single taxpayers who live
 * with children (or needy people) whose upkeep they mainly bear, pay the rate of half their income,
 * the minimum rate kept (LICD art. 37 al. 3; guide p. 39, "splitting intégral"). The same
 * households have the larger social deduction on wealth (art. 61 al. 1).
 */
export function familyRate(): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 37 al. 3 (p. 28), art. 61 al. 1 (p. 37); ${GUIDE} p. 39 (code 7.910)`,
  };
}

/**
 * Children at your charge: minors, or in apprenticeship or studies; the situation at the end of the
 * tax period decides (LICD art. 36 al. 1 let. a, al. 4; guide
 * p. 34). A child who lives in your household is box A* of the return, one who lives with the other
 * parent B*, one who alternates between the two C* (guide p. 7).
 */
export function childrenAtCharge(): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 36 al. 1 let. a (p. 25), al. 4 (p. 27); ${GUIDE} p. 7, p. 34 (code 6.110)`,
  };
}

/**
 * Shared custody of a minor child (garde alternée): the SCC gives the child (the child deductions
 * and the single-parent tariff) to the parent who receives child support, not to the one who pays
 * it, who deducts the support; without child support, to the parent with the higher income (the
 * SCC's source-tax documents). The law splits the child deduction in proportion when several
 * taxpayers bear the child's upkeep (LICD art. 36 al. 3), taxes the support received (art. 24
 * let. f) and lets the payer deduct it (art. 34 al. 1 let. c).
 */
export function sharedCustody(): Cited<null> {
  return {
    value: null,
    source: `fr-2024-pis-guide p. 7 (question 18); fr-2024-instructions-employeurs-source p. 11 and 12 (ch. 4.3.4); ${LAW} art. 24 let. f (p. 17), art. 34 al. 1 let. c (p. 23), art. 36 al. 3 (p. 27)`,
  };
}

/**
 * The communal tax on income and wealth is the commune's coefficient, the same for both, in percent
 * of the cantonal base tax (LICo art. 3 al. 3, art. 4 al. 3); the church tax is the parish's
 * coefficients in percent of the same base (guide p. 46).
 */
export function communalTax(): Cited<null> {
  return {
    value: null,
    source: `fr-na-law-lico art. 3 al. 3, art. 4 al. 3 (p. 2); ${GUIDE} p. 46 (B. Impôt communal et ecclésiastique)`,
  };
}

/** A move between Fribourg communes splits the communal tax by the time in each (LICo art. 9 al. 2). */
export function communeMove(): Cited<null> {
  return { value: null, source: 'fr-na-law-lico art. 9 al. 2 (p. 3)' };
}

/** The family situation at the end of the tax period decides the social deductions (LICD art. 36 al. 4). */
export function familySituation(): Cited<null> {
  return { value: null, source: `${LAW} art. 36 al. 4 (p. 27)` };
}

/**
 * The cantonal coefficient applies to the rates of the law (LICD art. 2; the annual law). The base
 * tax is rounded to 5 centimes as the detailed tariff prints it; the documents don't say how the
 * cantonal, communal and church taxes are rounded.
 */
export function coefficientRule(taxYear: FrTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 2 al. 1 (p. 1); fr-${taxYear}-law-coefficient-annuel art. 1 (p. 1); fr-${taxYear}-bareme-revenu p. 1`,
  };
}
