// Every constant of one Basel-Stadt tax year, as the engine reads them, each cited (SPEC.md section
// 7). Tax years 2025 and 2026: the income and wealth tariffs (the tariff book and the guides'
// tables), the communes' shares and multipliers (the canton's table of rates) and the deduction
// amounts (the table and the guide of the year). The one 2026 value the documents print as
// provisional is an estimate, flagged wherever it is used (./2026/amounts.ts). Any other year fails
// closed.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import { INCOME_A_2025, INCOME_B_2025, WEALTH_A_2025, WEALTH_B_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import { INCOME_A_2026, INCOME_B_2026, WEALTH_A_2026, WEALTH_B_2026 } from './2026/tariffs.js';
import type { BsAmounts } from './amounts.js';
import type { BsCommune } from './communes.js';

export const BS_TAX_YEARS = [2025, 2026] as const;
export type BsTaxYear = (typeof BS_TAX_YEARS)[number];

export interface BsYearParams {
  taxYear: BsTaxYear;
  income: { A: Cited<BracketScale>; B: Cited<BracketScale> };
  wealth: { A: Cited<BracketScale>; B: Cited<BracketScale> };
  amounts: BsAmounts;
  communes: Cited<readonly BsCommune[]>;
}

const PARAMS: Record<BsTaxYear, BsYearParams> = {
  2025: {
    taxYear: 2025,
    income: { A: INCOME_A_2025, B: INCOME_B_2025 },
    wealth: { A: WEALTH_A_2025, B: WEALTH_B_2025 },
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    income: { A: INCOME_A_2026, B: INCOME_B_2026 },
    wealth: { A: WEALTH_A_2026, B: WEALTH_B_2026 },
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isBsTaxYear(year: number): year is BsTaxYear {
  return (BS_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Basel-Stadt tax year; any other year fails closed. */
export function bsParamsFor(taxYear: number): BsYearParams {
  if (!isBsTaxYear(taxYear)) {
    throw new RangeError(
      `Basel-Stadt tax year ${taxYear} is not supported: no official values for it.`,
    );
  }
  return PARAMS[taxYear];
}
