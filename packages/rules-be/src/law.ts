// Rules of the Bern Steuergesetz whose figures are in the law itself and not indexed: the same text,
// on the same pages, in the versions in force in 2025 (be-2025-stg-de) and from 2026
// (be-2026-stg-de).
import type { Cited } from '@taxpresso/rules-ch';
import type { BeTaxYear } from './params.js';

const LAW: Record<BeTaxYear, string> = {
  2025: 'be-2025-stg-de',
  2026: 'be-2026-stg-de',
};

/** The Steueranlagen are multiples of the einfache Steuer (Art. 2), set yearly (Art. 3 Abs. 1). */
export function multipliers(taxYear: BeTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} Art. 2 Abs. 1 and 2 (p. 1), Art. 3 Abs. 1 (p. 2)`,
  };
}

/**
 * The church tax rates are fractions of the einfache Steuer too (the tables' heading: "Bruchteil der
 * einfachen Steuer"; the Kirchensteuergesetz itself is not in the sources library).
 */
export function churchRates(taxYear: BeTaxYear): Cited<null> {
  return {
    value: null,
    source: `be-${taxYear}-steueranlagen-gemeinden-de p. 13 (table 2.1, heading); ${LAW[taxYear]} Art. 247 Abs. 2 (p. 125)`,
  };
}

/** Income below CHF 100 is not counted for the tariff (Art. 42 Abs. 4), wealth below CHF 1,000 (Art. 65 Abs. 4). */
export function tariffSteps(taxYear: BeTaxYear): Cited<{ income: number; wealth: number }> {
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LAW[taxYear]} Art. 42 Abs. 4 (p. 33), Art. 65 Abs. 4 (p. 42)`,
  };
}

/** No wealth tax when the rate-determining wealth is under CHF 100,000 (Art. 65 Abs. 3). */
export function wealthFreeBelow(taxYear: BeTaxYear): Cited<number> {
  const column = taxYear === 2025 ? 'H' : 'J';
  return {
    value: 10_000_000,
    source: `${LAW[taxYear]} Art. 65 Abs. 3 (p. 42); be-na-deductions-abzuege-freigrenzen sheet 2022-2027 (row 52, column ${column})`,
  };
}

/**
 * Höchstbelastung (Art. 66): when the wealth tax of the canton, the commune and the church is more
 * than 25 % of the income from wealth (less the costs of managing it and the debt interest), it is
 * cut to that amount, but not below 2.4 per mille of the taxable wealth; for spouses, on their
 * joint wealth and income.
 */
export function maxBurden(taxYear: BeTaxYear): Cited<{ yieldShareBp: number; floorBp: number }> {
  return {
    value: { yieldShareBp: 2500, floorBp: 24 },
    source: `${LAW[taxYear]} Art. 66 Abs. 1 to 4 (p. 42)`,
  };
}

/**
 * Art. 42 Abs. 1 (the tariff for married couples) also applies to widowed, separated, divorced and
 * single taxpayers who live with children or people in need and mainly bear their upkeep; the
 * situation at the end of the year decides (Art. 67 Abs. 3). With shared custody, the parent who
 * receives child support has it; without child support, the canton's practice page names only
 * parents living together (the one with the higher taxable income).
 */
export function tariffRule(taxYear: BeTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} Art. 42 Abs. 1 (p. 31), Art. 67 Abs. 3 (p. 42); be-na-tariff-taxinfo-tarif-einkommenssteuer (1 Tarif für Verheiratete und Einelternfamilien, 3 Scheidung, Trennung)`,
  };
}

/**
 * Separated parents: the parent who receives child support for a child counts it in full; the one
 * who pays it deducts the support and has no child deductions (Art. 40 Abs. 4); with joint parental
 * authority and no child support, each has half the child deduction (Art. 40 Abs. 3 lit. a) and
 * half of the insurance, education and modest-income amounts per child (Abs. 8).
 */
export function sharedChildren(taxYear: BeTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW[taxYear]} Art. 40 Abs. 3 lit. a, Abs. 4 (p. 30), Abs. 8 (p. 31); be-2025-wegleitung-np-de p. 30 (Seite 21)`,
  };
}
