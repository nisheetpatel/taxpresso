// Rules of the Basel-Landschaft texts that carry no yearly amount, with their pages: the tax law
// (StG, SGS 331, Stand 1 January 2023, current for both years), the guide of the year, the forms,
// the canton's practice (Baselbieter Steuerbuch, Band 1), the tariff's rules of application and the
// table of communal and church rates.
import type { Cited } from '@taxpresso/rules-ch';
import type { BlTaxYear } from './params.js';

const LAW = 'bl-na-steuergesetz-331';
const BOOK = 'bl-na-steuerbuch';
const guide = (y: BlTaxYear) => `bl-${y}-wegleitung`;
const rule = (source: string): Cited<null> => ({ value: null, source });

/** The return takes whole francs (CHF ohne Rappen), income, deductions and wealth. */
export const wholeFrancs = (y: BlTaxYear) =>
  rule(`bl-${y}-steuererklaerung-form p. 2, p. 3 and p. 4 (CHF ohne Rappen); ${guide(y)} p. 9`);

/**
 * Vollsplitting: married couples, and single parents living with a child who gets the child
 * reduction, pay the rate of half their taxable income, at least the minimum rate (StG § 34 Abs.
 * 2); half the income is rounded down to the franc (Anwendungsregeln, Ziffer 5).
 */
export const splittingRule = (y: BlTaxYear) =>
  rule(
    `${LAW} § 34 Abs. 2 (p. 27); bl-${y}-tariff-staatssteuer p. 1 (Einheitstarif mit Vollsplitting); bl-na-tariff-anwendungsregeln (Ziffer 5 to 7); ${BOOK} p. 215 (34 Nr. 2)`,
  );

/**
 * The child reduction: CHF 750 off the income tax for each minor child, or one in training or
 * unable to work, who lives with you and in your parental care; with joint custody, for the parent
 * who mainly bears the child's upkeep; none when the child's own income is above the tax-free limit
 * (StG § 34 Abs. 4; guide 750). The same children raise the insurance deduction (630).
 */
export const childRule = (y: BlTaxYear) =>
  rule(
    `${LAW} § 34 Abs. 4 (p. 28); ${guide(y)} p. 37 (750, Staatssteuer); ${BOOK} p. 210 and 211 (34 Nr. 1, Ziffer 2 and 3)`,
  );

/**
 * Joint custody of parents taxed apart: the child (the child reduction, Vollsplitting, the higher
 * wealth allowance) counts for the parent who mainly bears its upkeep; the one who receives child
 * support is taken to bear it in full, the one who pays it deducts the support; without child
 * support, the parent with the higher income (StG § 34 Abs. 4; Steuerbuch 34 Nr. 1, Ziffer 5 and 7).
 */
export const sharedCustody = () =>
  rule(
    `${LAW} § 34 Abs. 2 and 4 (p. 27 and 28), § 50 Abs. 1 lit. a (p. 31); ${BOOK} p. 211 (34 Nr. 1, Ziffer 5), p. 212 and 213 (Ziffer 7)`,
  );

/** The family situation at the end of the tax year decides the tariff and the social deductions. */
export const familySituation = () => rule(`${LAW} § 34 Abs. 3 (p. 27); ${BOOK} p. 204 (33 Nr. 1)`);

/**
 * The commune levies its income and wealth tax in percent of the normal state tax, the tax computed
 * under §§ 34 ff. (StG § 18bis, § 19 Abs. 2); the canton its income tax at its own multiplier
 * (§ 19bis, the Steuerfussdekret of the year).
 */
export const communalTax = (y: BlTaxYear) =>
  rule(
    `${LAW} § 18bis (p. 11), § 19 Abs. 2 (p. 11), § 19bis (p. 11); bl-na-law-steuerfussdekret-331-2 § ${y === 2025 ? 17 : 18} (p. 2)`,
  );

/**
 * The commune where you lived on 31 December taxes the whole year; a move inside the canton does not
 * split the communal tax (guide, Umzug innerhalb des Kantons).
 */
export const communeAtYearEnd = (y: BlTaxYear) =>
  rule(`${guide(y)} p. 3 (Umzug innerhalb des Kantons Basel-Landschaft)`);

/**
 * The Roman Catholic church tax is a percentage of the state tax (the table's footnote 2), as the
 * canton's own example adds the communal and church tax "in Prozent vom Staatssteuerbetrag".
 */
export const churchRule = () =>
  rule(
    `bl-2026-communal-steuerfuesse (column Röm.-kath. Kirche, footnote 2: in % der Staatssteuer); ${BOOK} p. 229 (36 Nr. 1, Ziffer 1.4.5, Beispiel 1)`,
  );

/** Illness and accident costs: what you bear yourself, with no threshold for the state tax. */
export const medicalRule = (y: BlTaxYear) =>
  rule(
    `${LAW} § 29 Abs. 1 lit. n (p. 24); ${guide(y)} p. 35 (720, Staatssteuer); ${BOOK} p. 190 (29 Nr. 17, Ziffer 1.1)`,
  );

/** Donations to tax-exempt bodies: deductible with no upper limit (keine Begrenzung). */
export const donationsRule = (y: BlTaxYear) =>
  rule(`${LAW} § 29 Abs. 1 lit. l (p. 24); ${guide(y)} p. 36 (738); ${BOOK} p. 196 (29 Nr. 18)`);

/** Insurance premiums and savings interest: the maximum is deducted, whatever was paid. */
export const insuranceFlat = () => rule(`${BOOK} p. 184 (29 Nr. 15, Ziffer 1 and 2)`);

/** Alternating custody: each parent deducts the childcare they paid (Steuerbuch 29 Nr. 5). */
export const childcareShared = () => rule(`${BOOK} p. 143 (29 Nr. 5, Ziffer 1.3)`);

/**
 * The pensioners' deduction: from the income before all deductions (499), none when there is
 * taxable wealth of CHF 10,000 or more (StG § 33 Abs. 1 lit. c; guide 770).
 */
export const pensionerRule = (y: BlTaxYear) =>
  rule(
    `${LAW} § 33 Abs. 1 lit. c (p. 27); ${guide(y)} ${y === 2025 ? 'p. 38 and 39 (770)' : 'p. 39 (770), p. 40 (771)'}`,
  );

/** The higher wealth allowance follows Vollsplitting (StG § 50 Abs. 1). */
export const wealthAllowance = (y: BlTaxYear) =>
  rule(
    `${LAW} § 50 Abs. 1 (p. 31); ${guide(y)} p. ${y === 2025 ? 42 : 45} (900, 905); ${BOOK} p. 271 (50 Nr. 1)`,
  );
