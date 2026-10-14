// Every constant of one Fribourg tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026: the income and wealth scales (LICD art. 37 and 62, the SCC's tariffs),
// the cantonal coefficients (the annual coefficient laws), the deduction amounts (the LICD, two
// ordinances, the 2025 guide) and the communes with their communal and parish coefficients (the
// canton's tables). The communal coefficients of 2026 are not in any document of the sources library:
// each 2026 commune's rate is null, and the engine says so instead of computing (./compute.ts). Any
// other year fails closed.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import { COEFFICIENTS_2025, INCOME_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import { COEFFICIENTS_2026, INCOME_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { FrAmounts } from './amounts.js';
import type { FrCommune } from './communes.js';
import type { IncomeScale } from './tariff.js';

export const FR_TAX_YEARS = [2025, 2026] as const;
export type FrTaxYear = (typeof FR_TAX_YEARS)[number];

export interface FrYearParams {
  taxYear: FrTaxYear;
  incomeScale: Cited<IncomeScale>;
  wealthScale: Cited<BracketScale>;
  /** The annual coefficients of the cantonal tax, in hundredths of a percent of the base tax. */
  coefficients: Cited<{ income: number; wealth: number }>;
  amounts: FrAmounts;
  communes: Cited<readonly FrCommune[]>;
}

const PARAMS: Record<FrTaxYear, FrYearParams> = {
  2025: {
    taxYear: 2025,
    incomeScale: INCOME_2025,
    wealthScale: WEALTH_2025,
    coefficients: COEFFICIENTS_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeScale: INCOME_2026,
    wealthScale: WEALTH_2026,
    coefficients: COEFFICIENTS_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isFrTaxYear(year: number): year is FrTaxYear {
  return (FR_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Fribourg tax year; any other year fails closed. */
export function frParamsFor(taxYear: number): FrYearParams {
  if (!isFrTaxYear(taxYear)) {
    throw new RangeError(
      `Fribourg tax year ${taxYear} is not supported: no official values for it.`,
    );
  }
  return PARAMS[taxYear];
}
