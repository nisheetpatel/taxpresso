// Every constant of one Basel-Landschaft tax year, as the engine reads them, each cited (SPEC.md
// section 7). Tax years 2025 and 2026: the income tariff (the formula of StG § 34 with the year's
// parameters from the canton's tariff workbook), the wealth tariff (§ 51), the cantonal multiplier
// (the Steuerfussdekret), the deduction amounts (the law, the ordinance, the guide of the year) and
// the communes with their multipliers (the canton's table of rates). Any other year fails closed.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import { INCOME_2025, MULTIPLIER_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import { INCOME_2026, MULTIPLIER_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { BlAmounts } from './amounts.js';
import type { BlCommune } from './communes.js';
import type { IncomeFormula } from './tariff.js';

export const BL_TAX_YEARS = [2025, 2026] as const;
export type BlTaxYear = (typeof BL_TAX_YEARS)[number];

export interface BlYearParams {
  taxYear: BlTaxYear;
  income: Cited<IncomeFormula>;
  wealth: Cited<{ exemptBelow: number; scale: BracketScale }>;
  /** The cantonal multiplier on the income tax, in hundredths of a percent of the normal state tax. */
  multiplier: Cited<number>;
  amounts: BlAmounts;
  communes: Cited<readonly BlCommune[]>;
}

const PARAMS: Record<BlTaxYear, BlYearParams> = {
  2025: {
    taxYear: 2025,
    income: INCOME_2025,
    wealth: WEALTH_2025,
    multiplier: MULTIPLIER_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    income: INCOME_2026,
    wealth: WEALTH_2026,
    multiplier: MULTIPLIER_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isBlTaxYear(year: number): year is BlTaxYear {
  return (BL_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Basel-Landschaft tax year; any other year fails closed. */
export function blParamsFor(taxYear: number): BlYearParams {
  if (!isBlTaxYear(taxYear)) {
    throw new RangeError(
      `Basel-Landschaft tax year ${taxYear} is not supported: no official values for it.`,
    );
  }
  return PARAMS[taxYear];
}
