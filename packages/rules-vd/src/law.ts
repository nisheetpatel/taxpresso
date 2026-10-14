// Rules of the Vaud laws whose figures are in the law itself and not adjusted each year, with the
// pages of the versions in force in 2025 (vd-2025-law-li) and 2026 (vd-2026-law-li, from 1 May
// 2026), the communal tax law (vd-na-law-licom), the family regulation (vd-na-law-rifam) and the
// annual tax laws.
import type { Cited } from '@taxpresso/rules-ch';
import type { VdTaxYear } from './params.js';

const LI: Record<VdTaxYear, string> = { 2025: 'vd-2025-law-li', 2026: 'vd-2026-law-li' };
/** The page of an article or paragraph in each year's LI. */
const P = (y: VdTaxYear, p2025: number, p2026: number) => (y === 2025 ? p2025 : p2026);

/**
 * The parts of the quotient familial (LI art. 43 al. 2), in hundredths: 1 for a single, widowed,
 * divorced or separated taxpayer; 1.8 for spouses living together; 1.3 for a single, widowed,
 * divorced or separated taxpayer keeping a household alone with a child they fully support (not in
 * a couple living together); 0.5 per child (minor, or in apprenticeship or studies) fully supported.
 */
export function parts(taxYear: VdTaxYear): Cited<{
  single: number;
  married: number;
  singleParent: number;
  child: number;
}> {
  return {
    value: { single: 100, married: 180, singleParent: 130, child: 50 },
    source: `${LI[taxYear]} art. 43 al. 2 (p. ${P(taxYear, 25, 26)}); vd-${taxYear}-deductions p. 2 (quotient familial)`,
  };
}

/**
 * Separated parents with joint parental authority over a minor child (RIFam art. 5 and 6): the
 * parent taxed on the child support received has the part of 0.5, and the 1.3 when keeping a
 * household alone with the child; the parent who pays it deducts it and has no part. Without
 * deductible child support and with comparable custody, each has half the part (0.25), the 1.3
 * goes to the parent who mainly bears the child's upkeep (when keeping a household alone with it),
 * and the insurance and savings, modest-taxpayer and family deductions for the child are shared the
 * same way. Childcare: each parent up to the shared limit, child support or not (art. 4 al. 2).
 */
export function sharedChildren(taxYear: VdTaxYear): Cited<null> {
  return {
    value: null,
    source: `vd-na-law-rifam art. 4 al. 2 (p. 2), art. 5 and 6 (p. 3); ${LI[taxYear]} art. 43 al. 2 lit. d (p. ${P(taxYear, 25, 26)}), art. 45 (p. 26)`,
  };
}

/**
 * The taxable income and the rate-determining income drop fractions under CHF 100 (LI art. 46),
 * the taxable wealth fractions under CHF 1,000 (art. 59 al. 3).
 */
export function amountSteps(taxYear: VdTaxYear): Cited<{ income: number; wealth: number }> {
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LI[taxYear]} art. 46 (p. ${P(taxYear, 26, 27)}), art. 59 al. 3 (p. 30)`,
  };
}

/**
 * The rate-determining income is the taxable income divided by the parts (LI art. 43 al. 1); the
 * tax is the taxable income at the rate of the scale for that income, computed to six decimals of a
 * percent, and the cantonal base tax, the LRIPP reduction, the cantonal and the communal tax are
 * each rounded to 5 centimes (the guide's worked examples, vd-2025-guide p. 61).
 */
export function rateRule(taxYear: VdTaxYear): Cited<{ rateDecimals: number; roundTo: number }> {
  return {
    value: { rateDecimals: 6, roundTo: 5 },
    source: `${LI[taxYear]} art. 43 al. 1 (p. ${P(taxYear, 25, 26)}), art. 47 (p. ${P(taxYear, 26, 27)}); vd-2025-guide p. 52 (code 820), p. 61 (exemples de calcul)`,
  };
}

/**
 * The communal income and wealth tax is levied on the same bases as the cantonal tax, in percent
 * of the cantonal base tax, plus any special earmarked tax in percent of the same base (LICom
 * art. 5 al. 1, art. 6 al. 1 to 3), in the commune where the cantonal tax is paid, the situation
 * on 31 December deciding (art. 9, art. 15 al. 1). The LRIPP reduction does not reach it (LRIPP
 * art. 2 al. 2).
 */
export function communalTax(taxYear: VdTaxYear): Cited<null> {
  return {
    value: null,
    source: `vd-na-law-licom art. 5 al. 1, art. 6 al. 1 (p. 4), art. 6 al. 2 and 3 (p. 5), art. 9 (p. 6), art. 15 al. 1 (p. 7); vd-${taxYear}-law-lripp art. 2 al. 2 (p. 1)`,
  };
}

/** Communes and fractions of communes levy the taxes (LICom art. 1). */
export function fractions(): Cited<null> {
  return { value: null, source: 'vd-na-law-licom art. 1 al. 1 (p. 1)' };
}

/**
 * The maxima of the cantonal and communal tax (LICom art. 8): together, at most 30 % of the income
 * on income and 10 per mille of the wealth on wealth (al. 1, special taxes included); income and
 * wealth tax together at most 60 % of the net income (art. 29 LI plus the medical, disability,
 * donation and party deductions), the net income from wealth counting at least the rate of the
 * annual tax law (al. 3 and 3bis, annual law art. 7: 1 %); the wealth tax then at least 3 per mille
 * (al. 3ter). Rates in basis points of the base, wealth per mille in basis points of wealth.
 */
export function maxima(taxYear: VdTaxYear): Cited<{
  incomeBp: number;
  wealthBp: number;
  totalShareBp: number;
  wealthYieldBp: number;
  wealthFloorBp: number;
}> {
  return {
    value: {
      incomeBp: 3_000,
      wealthBp: 100,
      totalShareBp: 6_000,
      wealthYieldBp: 100,
      wealthFloorBp: 30,
    },
    source: `vd-na-law-licom art. 8 al. 1 to 4 (p. 5); vd-${taxYear}-law-impot-annuel art. 7 (p. 2)`,
  };
}

/** The fixed personal tax: at most CHF 10 a year per adult domiciled in the commune on 1 January. */
export function personalTax(): Cited<null> {
  return { value: null, source: 'vd-na-law-licom art. 21 (p. 9)' };
}

/** The family situation and charges at the end of the tax period decide (LI art. 44 al. 1). */
export function familySituation(taxYear: VdTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LI[taxYear]} art. 44 al. 1 (p. ${P(taxYear, 25, 26)})`,
  };
}
