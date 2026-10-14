// Rules of the Aargau Steuergesetz and its documents whose figures are not indexed: the same text in
// both tax years (the StG in force, ag-na-law-steuergesetz, Stand 1 January 2025, with no later
// version), with the year's own documents where they state the rule.
import type { Cited } from '@taxpresso/rules-ch';
import type { AgTaxYear } from './params.js';

const LAW = 'ag-na-law-steuergesetz';
const GUIDE = 'ag-2025-guide-wegleitung';
const LIST: Record<AgTaxYear, string> = {
  2025: 'ag-2025-communal-steuerfuesse',
  2026: 'ag-2026-communal-steuerfuesse',
};
const TARIFF: Record<AgTaxYear, string> = {
  2025: 'ag-2025-tariff-einkommenssteuer p. 1 (3. Tarif B, 4. Massgebende Verhältnisse)',
  2026: 'ag-na-tariff-steuern-berechnen (Tarif für die Einkommenssteuer, gültig ab 2025); ag-2025-tariff-einkommenssteuer p. 1 (3. Tarif B, 4. Massgebende Verhältnisse)',
};

/**
 * The canton, the commune and the church each levy their Steuerfuss in percent of the einfache
 * Steuer on income and wealth (§ 2 Abs. 1 and 2, § 155 Abs. 1); the guide's Anhang II multiplies
 * the einfache Steuer by each of them.
 */
export function multipliers(taxYear: AgTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} § 2 Abs. 1 and 2 (p. 1 and 2), § 155 Abs. 1 (p. 70), § 157 Abs. 1 (p. 70); ${GUIDE} p. 45 (Anhang II); ${LIST[taxYear]} p. 1 (title)`,
  };
}

/**
 * The taxes of the canton, the commune and the church to 10 centimes, halves up. No document states
 * how they are rounded; the guide's worked example prints 2,146.70 for 1,934 x 111 % (2,146.74) and
 * 1,818.00 for 1,934 x 94 % (1,817.96), which rounding to the nearest 10 centimes gives (and
 * rounding to the centime or to 5 centimes does not). The result says so (unverifiedRules).
 */
export function taxRounding(): Cited<number> {
  return { value: 10, source: `${GUIDE} p. 45 (Anhang II, Beispiel)` };
}

/**
 * Income below CHF 100 is not counted for the tariff (§ 43 Abs. 3), wealth below CHF 1,000
 * (§ 55 Abs. 2); the einfache Einkommenssteuer is rounded down to the franc.
 */
export function tariffSteps(taxYear: AgTaxYear): Cited<{ income: number; wealth: number }> {
  const tables =
    taxYear === 2025
      ? 'ag-2025-tariff-einkommenssteuer p. 2 (5. Rundung); ag-2025-tariff-vermoegenssteuer p. 1 (2. Rundung)'
      : 'ag-2025-tariff-einkommenssteuer p. 2 (5. Rundung); ag-2025-tariff-vermoegenssteuer p. 1 (2. Rundung); ag-na-tariff-steuern-berechnen (both tariffs gültig ab 2025)';
  return {
    value: { income: 10_000, wealth: 100_000 },
    source: `${LAW} § 43 Abs. 3 (p. 29), § 55 Abs. 2 (p. 33); ${tables}`,
  };
}

/**
 * Tarif B (§ 43 Abs. 2): married couples, and widowed, separated, divorced and single taxpayers who
 * live with children and mainly bear their upkeep; the guide: as a rule, a parent living with a
 * child for whom the child deduction is granted. The situation at the end of the year decides
 * (§ 43 Abs. 4).
 */
export function tariffRule(taxYear: AgTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} § 43 Abs. 2 and 4 (p. 29); ${TARIFF[taxYear]}; ${GUIDE} p. 44 (Anhang I, 1 and 2)`,
  };
}

/**
 * Parents not taxed together who share parental authority: the parent who mainly bears the child's
 * upkeep has the child deduction; the one who can deduct child support as a rule has none (guide
 * 19.1). The child's income and wealth go to the parent with the child deduction (StGV § 3).
 */
export function sharedChildren(): Cited<null> {
  return {
    value: null,
    source: `${GUIDE} p. 32 (19.1: Üben nicht gemeinsam veranlagte Eltern die elterliche Sorge gemeinsam aus); ag-2026-law-steuerverordnung § 3 Abs. 1 (p. 2); ${LAW} § 42 Abs. 1 lit. a Ziff. 4 (p. 27)`,
  };
}

/**
 * The church tax: the Kirchgemeinden of the recognised churches levy it on their members as a
 * Steuerfuss of the einfache Steuer (§ 154 Abs. 1, the list's columns); a family of several
 * confessions is taxed by each church after the number of its members (Abs. 3).
 */
export function churchRule(taxYear: AgTaxYear): Cited<null> {
  return {
    value: null,
    source: `${LAW} § 154 Abs. 1 to 3 (p. 69 and 70); ${LIST[taxYear]} p. 1 (Kirche ev.-ref., röm.-kt., christ-kt.), p. 9 (Zusatzkirchen); ${GUIDE} p. 45 (Anhang II: Kirchensteuer, einfache Steuer x 15 %)`,
  };
}

/**
 * Höchstbelastung (§ 56 Abs. 1): the income and wealth taxes of the canton, the commune and the
 * church are cut to 70 % of the Reineinkommen, by at most half of the wealth taxes; the Reineinkommen
 * is raised by extraordinary deductions such as pension fund buy-ins.
 */
export function maxBurden(): Cited<{ incomeShareBp: number; wealthShareBp: number }> {
  return {
    value: { incomeShareBp: 7000, wealthShareBp: 5000 },
    source: `${LAW} § 56 Abs. 1 (p. 33)`,
  };
}

/**
 * The low-income deduction's steps (§ 42 Abs. 1bis): the marginal burden at a change of step is
 * never more than 100 % (§ 43 Abs. 3). The documents don't say how this is applied.
 */
export function lowIncomeSteps(): Cited<null> {
  return { value: null, source: `${LAW} § 42 Abs. 1bis (p. 28), § 43 Abs. 3 (p. 29)` };
}
