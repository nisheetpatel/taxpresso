// Every constant of one Ticino tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026: the income tariffs (LT art. 35 as each year's executive decree rewrote
// it), the wealth tariff (LT art. 49), the communes' multipliers (the canton's table) and the
// amounts of the deductions, the cantonal coefficient and the personal tax. None of them is an
// estimate. Any other year fails closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import { INCOME_FAMILY_2025, INCOME_SINGLE_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import { INCOME_FAMILY_2026, INCOME_SINGLE_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { TiAmounts } from './amounts.js';
import type { TiCommune } from './communes.js';
import type { CategoryTariff } from './tariff.js';

export const TI_TAX_YEARS = [2025, 2026] as const;
export type TiTaxYear = (typeof TI_TAX_YEARS)[number];

export interface TiYearParams {
  taxYear: TiTaxYear;
  income: { single: Cited<CategoryTariff>; family: Cited<CategoryTariff> };
  wealth: Cited<CategoryTariff>;
  amounts: TiAmounts;
  communes: Cited<readonly TiCommune[]>;
}

const PARAMS: Record<TiTaxYear, TiYearParams> = {
  2025: {
    taxYear: 2025,
    income: { single: INCOME_SINGLE_2025, family: INCOME_FAMILY_2025 },
    wealth: WEALTH_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    income: { single: INCOME_SINGLE_2026, family: INCOME_FAMILY_2026 },
    wealth: WEALTH_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isTiTaxYear(year: number): year is TiTaxYear {
  return (TI_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Ticino tax year; any other year fails closed. */
export function tiParamsFor(taxYear: number): TiYearParams {
  if (!isTiTaxYear(taxYear)) {
    throw new RangeError(`Ticino tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
