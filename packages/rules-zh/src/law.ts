// Rules of the Zurich Steuergesetz whose amounts are in the law itself, not indexed: the same
// text in the versions in force on 1 January 2025 and 1 April 2026 (same paragraphs, same pages).
import type { Cited } from '@taxpresso/rules-ch';
import type { ZhTaxYear } from './params.js';

const LAW: Record<ZhTaxYear, string> = {
  2025: 'zh-2025-law-steuergesetz-631-1-stand-2025',
  2026: 'zh-2026-law-steuergesetz-631-1-stand-2026',
};

/**
 * Personalsteuer (§ 199, § 200): 24 francs a year from each taxpayer of age living in the
 * commune; spouses each owe the full amount (§ 199 Abs. 2).
 */
export function personalTax(taxYear: ZhTaxYear): Cited<{ perPerson: number }> {
  return { value: { perPerson: 2_400 }, source: `${LAW[taxYear]} § 199 and § 200 (p. 74)` };
}

/**
 * Kirchensteuer of spouses (§ 202): when both belong to a church with a church tax, each church
 * levies half; when only one does, half of the church tax is levied. So each member spouse
 * carries half of their church's multiplier; a single taxpayer, all of it.
 */
export function churchSplit(taxYear: ZhTaxYear): Cited<{ spouseShareBp: number }> {
  return { value: { spouseShareBp: 5000 }, source: `${LAW[taxYear]} § 202 (p. 74)` };
}

/** The einfache Staatssteuer is the tax from the tariffs; multipliers are percent of it. */
export function multipliers(taxYear: ZhTaxYear): Cited<null> {
  return { value: null, source: `${LAW[taxYear]} § 2 Abs. 1 and 2 (p. 1), § 188 (p. 73)` };
}

/**
 * The married tariff (Verheiratetentarif) applies to spouses living together and to widowed,
 * separated, divorced and single taxpayers living with children for whom they have the child
 * deduction; with joint authority and the child deduction shared, to the parent who mainly
 * supports the children (§ 35 Abs. 2 and 2bis, § 47 Abs. 2 and 2bis; Weisung ZStB 34.1).
 */
export function tariffRule(taxYear: ZhTaxYear): Cited<null> {
  const page = taxYear === 2025 ? 'p. 20, 21, 24 and 25' : 'p. 21 and 25';
  const weisung =
    taxYear === 2025
      ? 'zh-2025-tariff-weisung-sozialabzuege p. 10 to 12'
      : 'zh-2026-tariff-weisung-sozialabzuege p. 7 and 8 (Rz 52 to 61)';
  return {
    value: null,
    source: `${LAW[taxYear]} § 35 Abs. 2 and 2bis, § 47 Abs. 2 and 2bis (${page}); ${weisung}`,
  };
}
