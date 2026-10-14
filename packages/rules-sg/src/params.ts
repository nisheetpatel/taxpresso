// Every constant of one St. Gallen tax year, as the engine reads them, each cited (SPEC.md section
// 7). Tax years 2025 and 2026: the income tariff (StG Art. 50, the tariff of the year), the wealth
// tariff (Art. 65), the cantonal multiplier, the deduction amounts (the law, the ordinance, the
// guide or the 2026 changes) and the communes with their multipliers and church rates (the canton's
// table of the year). Any other year fails closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { CHRIST_CATHOLIC_2025, COMMUNES_2025 } from './2025/communes.js';
import { INCOME_2025, MULTIPLIER_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { CHRIST_CATHOLIC_2026, COMMUNES_2026 } from './2026/communes.js';
import { INCOME_2026, MULTIPLIER_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { SgAmounts } from './amounts.js';
import type { SgCommune } from './communes.js';
import type { IncomeTariff, WealthTariff } from './tariff.js';

export const SG_TAX_YEARS = [2025, 2026] as const;
export type SgTaxYear = (typeof SG_TAX_YEARS)[number];

export interface SgYearParams {
  taxYear: SgTaxYear;
  income: Cited<IncomeTariff>;
  wealth: Cited<WealthTariff>;
  /** The cantonal multiplier, in hundredths of a percent of the einfache Steuer (105 % -> 10500). */
  multiplier: Cited<number>;
  amounts: SgAmounts;
  communes: Cited<readonly SgCommune[]>;
  /** The Christ Catholic church's rate in the whole canton, hundredths of a percent. */
  christCatholic: Cited<number>;
}

const PARAMS: Record<SgTaxYear, SgYearParams> = {
  2025: {
    taxYear: 2025,
    income: INCOME_2025,
    wealth: WEALTH_2025,
    multiplier: MULTIPLIER_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
    christCatholic: CHRIST_CATHOLIC_2025,
  },
  2026: {
    taxYear: 2026,
    income: INCOME_2026,
    wealth: WEALTH_2026,
    multiplier: MULTIPLIER_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
    christCatholic: CHRIST_CATHOLIC_2026,
  },
};

export function isSgTaxYear(year: number): year is SgTaxYear {
  return (SG_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a St. Gallen tax year; any other year fails closed. */
export function sgParamsFor(taxYear: number): SgYearParams {
  if (!isSgTaxYear(taxYear)) {
    throw new RangeError(
      `St. Gallen tax year ${taxYear} is not supported: no official values for it.`,
    );
  }
  return PARAMS[taxYear];
}
