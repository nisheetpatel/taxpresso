// Rules of the Basel-Stadt tax law (StG) and ordinance (StV) whose figures, if any, are in the
// law itself and not adjusted each year, with the pages of the versions in force in 2025
// (bs-2025-law-stg) and 2026 (bs-na-law-stg, Stand 1 January 2026; the same pages), and the
// guide's page where it explains them (bs-2025-guide-wegleitung, bs-2026-guide-wegleitung-b: the
// same pages).
import type { Cited } from '@taxpresso/rules-ch';
import type { BsTaxYear } from './params.js';

const LAW: Record<BsTaxYear, string> = { 2025: 'bs-2025-law-stg', 2026: 'bs-na-law-stg' };
const GUIDE: Record<BsTaxYear, string> = {
  2025: 'bs-2025-guide-wegleitung',
  2026: 'bs-2026-guide-wegleitung-b',
};
const STV = 'bs-na-law-stv';

/**
 * The tariffs read the taxable income in whole CHF 100 and the taxable wealth in whole CHF 1,000,
 * the rest dropped (StG § 36 al. 3, § 50 al. 3; the tables' notes, guide p. 45, 47, 48 and 49).
 * Amounts in centimes.
 */
export function amountSteps(y: BsTaxYear): Cited<{ income: number; wealth: number }> {
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LAW[y]} § 36 al. 3 (p. 17), § 50 al. 3 (p. 21); ${GUIDE[y]} p. 45 and 47 (Restbeträge unter CHF 100), p. 48 and 49 (unter CHF 1’000)`,
  };
}

/**
 * Which tariff: income tariff B for spouses living together and for single people who live with
 * children (or people needing support) whose upkeep they mainly bear, A for everyone else (StG § 36
 * al. 1 and 2); wealth tariff B for spouses only, so single parents pay wealth tax by tariff A
 * (§ 50 al. 1 and 2; guide p. 9). The yearly income tax is 100 % of the tariff's (§ 36a).
 */
export function tariffRule(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 36 al. 1 and 2, § 36a (p. 17), § 50 al. 1 and 2 (p. 21); ${GUIDE[y]} p. 9 (Tarif A, Tarif B)`,
  };
}

/**
 * How the tax is split: in the city of Basel the canton levies the full tax and no communal tax;
 * from residents of Riehen and Bettingen the canton levies its share (Kantonssteuerquote) and the
 * commune its own tax in percent of the tax computed under the law (StG § 2 al. 2 and 3, § 228 al.
 * 1; guide p. 9).
 */
export function communalTax(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 2 al. 2 and 3 (p. 1), § 228 al. 1 (p. 73); ${GUIDE[y]} p. 9 (Steuerberechnung)`,
  };
}

/**
 * The child deduction is for each minor child, or child in education or unable to work, whose
 * upkeep the taxpayer mainly bears; parents taxed apart with joint parental authority share it
 * half and half when neither claims child support for the child (StG § 35 al. 1 lit. a; guide
 * p. 38).
 */
export function childRule(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 35 al. 1 lit. a (p. 16); ${GUIDE[y]} p. 38 (750 Abzug für Kinder)`,
  };
}

/**
 * The deduction for single parents (765) and the wealth allowance of CHF 150,000 go to a single
 * person keeping a household alone with minor children (or children in education or unable to
 * work) whose upkeep they mainly bear, with their own income and wealth and the child support they
 * are taxed on, and who does not live in a cohabiting couple (StG § 35 al. 1 lit. e, § 49 al. 1 lit.
 * a; StV § 42; guide p. 39 and 43; the return asks about cohabiting, page 1, section 3).
 */
export function singleParentRule(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 35 al. 1 lit. e (p. 16), § 49 al. 1 lit. a (p. 20); ${STV} § 42 (p. 11); ${GUIDE[y]} p. 39 (765), p. 43 (890)`,
  };
}

/**
 * The deduction for single retirees (770), on top of the one for everyone else (767) and never
 * with the one for single parents (765): for unmarried, divorced, separated or widowed people who
 * reached the AHV reference age, or whose income is at least half pensions of the first, second or
 * third pillar (StG § 35 al. 1 lit. f and al. 2; StV § 43; guide p. 39).
 */
export function retireeRule(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 35 al. 1 lit. f and al. 2 (p. 16); ${STV} § 43 (p. 12); ${GUIDE[y]} p. 39 (770)`,
  };
}

/** The social deductions and allowances follow the situation at the end of the tax period. */
export function familySituation(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 35 al. 3 (p. 16), § 49 al. 2 (p. 20)`,
  };
}

/**
 * Accounts and securities are taxed at their market value, or at the mean of the market value and
 * the yield value (Ertragswert, the gross income capitalised) when that is lower (StG § 46 al. 2;
 * StV § 48 lit. d, § 49; form W lines 11 to 16; guide p. 40).
 */
export function securitiesRule(y: BsTaxYear): Cited<null> {
  const form = y === 2025 ? 'bs-2025-form-w-wertschriftenverzeichnis p. 4 (lines 11 to 16); ' : '';
  return {
    value: null,
    source: `${form}${LAW[y]} § 46 al. 2 (p. 20); ${STV} § 48 lit. d and § 49 (p. 13); ${GUIDE[y]} p. 40 (800 Guthaben und Wertschriften)`,
  };
}

/**
 * Household goods and personal effects are tax-free (StG § 48), and the guide counts the motor
 * vehicles of daily use among them (p. 40).
 */
export function exemptGoods(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[y]} § 48 (p. 20); ${GUIDE[y]} p. 40 (Hausrat, Motorfahrzeuge für den täglichen Gebrauch)`,
  };
}

/**
 * Wealth with a low yield (StG § 52): when the wealth tax and the income tax on the income from
 * wealth together exceed half that income, the wealth tax is reduced to that amount, but at most
 * down to 5 per mille of the taxable wealth (in basis points of the wealth: 50).
 */
export function lowYieldRule(y: BsTaxYear): Cited<{ yieldShareBp: number; floorBp: number }> {
  return {
    value: { yieldShareBp: 5_000, floorBp: 50 },
    source: `${LAW[y]} § 52 (p. 21); ${GUIDE[y]} p. 43 (Ermässigung bei Vermögen mit geringer Rendite)`,
  };
}

/**
 * Professional costs: none without earned income, and never more than the earned income (StV § 19
 * al. 1; guide p. 30); the flat amount replaces every actual cost, travel, meals and a side job's
 * costs included (guide p. 30, 500/520).
 */
export function professionalRule(y: BsTaxYear): Cited<null> {
  return {
    value: null,
    source: `${STV} § 19 al. 1 (p. 5); ${GUIDE[y]} p. 30 (519/539, 500/520); ${LAW[y]} § 27 (p. 12)`,
  };
}
