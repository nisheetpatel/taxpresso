// Rules of the Ticino tax law (LT) and of the yearly executive decree whose figures, if any, are not
// adjusted each year, with where the 2025 instructions explain them. The tax law is cited in its
// consolidated text in force on 1 January 2026 (ti-na-law-lt-640-100), whose notes give each
// article's last change: none of the articles below changed in 2025 or 2026 unless said.
import type { Cited } from '@taxpresso/rules-ch';
import type { TiTaxYear } from './params.js';

const LAW = 'ti-na-law-lt-640-100';
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';
const DECREE: Record<TiTaxYear, string> = {
  2025: 'ti-2025-tariff-decreto-esecutivo-pf',
  2026: 'ti-2026-tariff-decreto-esecutivo-pf',
};
/** The 2025 instructions explain the rules of 2025; for 2026 only the law and the decree count. */
const guide = (y: TiTaxYear, where: string) => (y === 2025 ? `; ${GUIDE} ${where}` : '');

/**
 * Which income tariff: the family tariff (art. 35 cpv. 2) for spouses living together and for
 * widowed, separated, divorced or single people living with minor children, or children in
 * apprenticeship or studies up to 28, whose upkeep they provide (or with people in need they
 * mainly support); for the year of a divorce, a separation or the death of a spouse also without
 * children (cpv. 5); the single tariff (cpv. 1) for everyone else. The situation at the end of the
 * tax period counts (cpv. 4).
 */
export function tariffRule(y: TiTaxYear): Cited<null> {
  const decree =
    y === 2025 ? `${DECREE[y]} p. 7 (art. 35 cpv. 2)` : `${DECREE[y]} p. 5 (art. 35 cpv. 2)`;
  return {
    value: null,
    source: `${decree}; ${LAW} art. 35 cpv. 4 and 5${guide(y, 'p. 11 (Matrimonio, separazione o divorzio), p. 51 (nota 2)')}`,
  };
}

/**
 * The cantonal tax: the taxes by the tariffs are the cantonal base tax (imposta cantonale base);
 * the tax due is the base tax times the cantonal coefficient (art. 1a).
 */
export function cantonalTax(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 1a cpv. 1 and 2${guide(y, 'p. 51 (coefficiente d’imposta cantonale)')}`,
  };
}

/**
 * The communal tax: the commune's multiplier applied to the cantonal base tax of the same year, in
 * the commune of residence at the end of the tax period (art. 276 cpv. 1 and 2, art. 277 cpv. 1).
 */
export function communalTax(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 276 cpv. 1 and 2, art. 277 cpv. 1${guide(y, 'p. 9, p. 49 (Imposta comunale 2025)')}`,
  };
}

/**
 * The child deduction is for each minor child, or child in apprenticeship or studies up to 28,
 * whose upkeep the taxpayer provides; parents taxed apart with joint parental authority share it
 * half and half when no child support is paid (art. 34 cpv. 1 lett. a). The social deductions
 * follow the situation at the end of the tax period (art. 34 cpv. 3).
 */
export function childRule(y: TiTaxYear): Cited<null> {
  const decree = y === 2025 ? `${DECREE[y]} p. 6 (art. 34 cpv. 1 lett. a); ` : '';
  return {
    value: null,
    source: `${decree}${LAW} art. 34 cpv. 1 lett. a and cpv. 3${guide(y, 'p. 30 (25.1)')}`,
  };
}

/**
 * Spouses' income and wealth are added together, and so are those of minor children, except their
 * earnings, with the parent who has parental authority (art. 8 cpv. 1 to 3).
 */
export function familyTaxation(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 8 cpv. 1 to 3${guide(y, 'p. 6 and 7 (Obbligo fiscale), p. 33 (sostanza di figli minorenni)')}`,
  };
}

/**
 * The salary on the return is the net salary: the gross salary less the ordinary AVS, AI, IPG, AD,
 * AINP and pension fund contributions; buy-ins into the pension fund (and, from 2026, into pillar
 * 3a) go on 10.3 (art. 32 cpv. 1 lett. d and e).
 */
export function salaryRule(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 16 cpv. 1, art. 32 cpv. 1 lett. d and e${guide(y, 'p. 13 (1.1), p. 25 (10.3); ti-2025-form-modulo-1-de p. 2 (Ziffer 1.1, Nettolohn)')}`,
  };
}

/**
 * Professional costs of employees (art. 25): travel, meals away from home and other costs, set by
 * the executive decree (art. 2 to 8); the flat amounts are for a whole year of work, and in
 * proportion for part of it.
 */
export function professionalRule(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${DECREE[y]} art. 2 to 8 (p. 1 to 3); ${LAW} art. 25 cpv. 1 and 2${guide(y, 'p. 23 to 25 (9.); ti-2025-form-modulo-4 p. 1 (1. to 7.)')}`,
  };
}

/**
 * Wealth: everything at its market value, life insurance at its surrender value, household goods
 * and personal effects exempt, debts deducted, at the end of the tax period (art. 40, 41, 44 cpv.
 * 2, 46 cpv. 1, 47, 52 cpv. 1). The instructions count motor vehicles as taxable (p. 33).
 */
export function wealthRule(y: TiTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} art. 40 cpv. 1, art. 41, art. 44 cpv. 2, art. 46 cpv. 1, art. 47 cpv. 1, art. 52 cpv. 1${guide(y, 'p. 33 and 34 (29.), p. 36 (33.)')}`,
  };
}

/**
 * The brake on the wealth tax (art. 49a): on request, the cantonal and communal income and wealth
 * taxes are cut to 60 % of the taxable income, the net income from wealth counted at least 1 % of
 * the net wealth. Taxpresso does not compute the request: it checks whether it could apply.
 */
export function wealthBrakeRule(y: TiTaxYear): Cited<{ shareBp: number }> {
  return {
    value: { shareBp: 6_000 },
    source: `${LAW} art. 49a cpv. 1 to 3${guide(y, 'p. 38 (Freno all’imposta sulla sostanza)')}`,
  };
}
