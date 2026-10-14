// Every constant of one Vaud tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026: the income and wealth scales (the canton's summary tables of the base
// tax, checked against its detailed tables), the cantonal coefficient (annual tax law art. 2), the
// LRIPP reduction of the cantonal base income tax, the communal rates (the arrêtés d'imposition
// tables) and the deductions (the canton's table of deductions and guide of the year). What the
// 2026 documents do not print is null or a lower bound (./2026/amounts.ts); nothing is an estimate.
// Any other year fails closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import {
  CANTONAL_COEFFICIENT_2025,
  INCOME_2025,
  LRIPP_REDUCTION_2025,
  WEALTH_2025,
} from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import {
  CANTONAL_COEFFICIENT_2026,
  INCOME_2026,
  LRIPP_REDUCTION_2026,
  WEALTH_2026,
} from './2026/tariffs.js';
import type { VdAmounts } from './amounts.js';
import type { VdCommune } from './communes.js';
import type { StepScale } from './tariff.js';

export const VD_TAX_YEARS = [2025, 2026] as const;
export type VdTaxYear = (typeof VD_TAX_YEARS)[number];

export interface VdYearParams {
  taxYear: VdTaxYear;
  incomeScale: Cited<StepScale>;
  wealthScale: Cited<StepScale>;
  /** The annual coefficient of the cantonal tax, in hundredths of a percent of the base tax. */
  cantonalCoefficient: Cited<number>;
  /** LRIPP: the cut of the cantonal base income tax, in basis points; not of the communal tax. */
  lrippReductionBp: Cited<number>;
  amounts: VdAmounts;
  communes: Cited<readonly VdCommune[]>;
}

const PARAMS: Record<VdTaxYear, VdYearParams> = {
  2025: {
    taxYear: 2025,
    incomeScale: INCOME_2025,
    wealthScale: WEALTH_2025,
    cantonalCoefficient: CANTONAL_COEFFICIENT_2025,
    lrippReductionBp: LRIPP_REDUCTION_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeScale: INCOME_2026,
    wealthScale: WEALTH_2026,
    cantonalCoefficient: CANTONAL_COEFFICIENT_2026,
    lrippReductionBp: LRIPP_REDUCTION_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isVdTaxYear(year: number): year is VdTaxYear {
  return (VD_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Vaud tax year; any other year fails closed. */
export function vdParamsFor(taxYear: number): VdYearParams {
  if (!isVdTaxYear(taxYear)) {
    throw new RangeError(`Vaud tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
