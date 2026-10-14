// Every constant of one Zug tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026: the income tariffs (Grundtarif and Mehrpersonentarif) and the wealth
// tariff, indexed by the Steuerverwaltung for the year; the Steuerfüsse of the canton, the communes,
// the parishes and the Bürgergemeinden (the Steuerverwaltung's table of the year); the deduction
// amounts (the law, the indexed amounts of the year, the guide). Any other year fails closed.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { CANTON_2025, COMMUNES_2025, REFORMED_2025 } from './2025/communes.js';
import { INCOME_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { CANTON_2026, COMMUNES_2026, REFORMED_2026 } from './2026/communes.js';
import { INCOME_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { ZgAmounts } from './amounts.js';
import type { ZgCommune } from './communes.js';

export const ZG_TAX_YEARS = [2025, 2026] as const;
export type ZgTaxYear = (typeof ZG_TAX_YEARS)[number];

export interface ZgYearParams {
  taxYear: ZgTaxYear;
  /** The einfache Steuer on income: Grundtarif (single) and Mehrpersonentarif (married). */
  income: Cited<{ single: BracketScale; married: BracketScale }>;
  /** The einfache Steuer on wealth. */
  wealth: Cited<BracketScale>;
  /** The canton's Steuerfuss, in hundredths of a percent of the einfache Steuer. */
  canton: Cited<number>;
  /** The Evangelical Reformed parish's Steuerfuss (one for the canton). */
  reformed: Cited<number>;
  amounts: ZgAmounts;
  communes: Cited<readonly ZgCommune[]>;
}

const PARAMS: Record<ZgTaxYear, ZgYearParams> = {
  2025: {
    taxYear: 2025,
    income: INCOME_2025,
    wealth: WEALTH_2025,
    canton: CANTON_2025,
    reformed: REFORMED_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    income: INCOME_2026,
    wealth: WEALTH_2026,
    canton: CANTON_2026,
    reformed: REFORMED_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isZgTaxYear(year: number): year is ZgTaxYear {
  return (ZG_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Zug tax year; any other year fails closed. */
export function zgParamsFor(taxYear: number): ZgYearParams {
  if (!isZgTaxYear(taxYear)) {
    throw new RangeError(`Zug tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
