// Every constant of one Lucerne tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026 are published in full: the income tariffs (StG § 57, with the canton's
// tariff tables), the wealth tariff (§ 60), the units of the state, the communes and the parishes
// (the Dienststelle Steuern's table of units of each year) and the deductions (StG, StV, the
// canton's table of indexed deductions, the Steuerbuch and the guide). No value is an estimate.
// Any other year fails closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { CHRIST_CATHOLIC_UNITS_2025, COMMUNES_2025, STATE_UNITS_2025 } from './2025/communes.js';
import { INCOME_FAMILY_2025, INCOME_SINGLE_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { CHRIST_CATHOLIC_UNITS_2026, COMMUNES_2026, STATE_UNITS_2026 } from './2026/communes.js';
import { INCOME_FAMILY_2026, INCOME_SINGLE_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { LuAmounts } from './amounts.js';
import type { LuCommune } from './communes.js';
import type { UnitTariff, WealthTariff } from './tariff.js';

export const LU_TAX_YEARS = [2025, 2026] as const;
export type LuTaxYear = (typeof LU_TAX_YEARS)[number];

export interface LuYearParams {
  taxYear: LuTaxYear;
  /** § 57 Abs. 1 (single persons) and Abs. 2 (families). */
  incomeTariff: { single: Cited<UnitTariff>; family: Cited<UnitTariff> };
  wealthTariff: Cited<WealthTariff>;
  /** The state's units (Staatssteuer), in ten-thousandths (1.55 -> 15500). */
  stateUnits: Cited<number>;
  /** The Christ Catholic parish's units, the same in every commune. */
  christCatholicUnits: Cited<number>;
  amounts: LuAmounts;
  communes: Cited<readonly LuCommune[]>;
}

const PARAMS: Record<LuTaxYear, LuYearParams> = {
  2025: {
    taxYear: 2025,
    incomeTariff: { single: INCOME_SINGLE_2025, family: INCOME_FAMILY_2025 },
    wealthTariff: WEALTH_2025,
    stateUnits: STATE_UNITS_2025,
    christCatholicUnits: CHRIST_CATHOLIC_UNITS_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeTariff: { single: INCOME_SINGLE_2026, family: INCOME_FAMILY_2026 },
    wealthTariff: WEALTH_2026,
    stateUnits: STATE_UNITS_2026,
    christCatholicUnits: CHRIST_CATHOLIC_UNITS_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isLuTaxYear(year: number): year is LuTaxYear {
  return (LU_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Lucerne tax year; any other year fails closed. */
export function luParamsFor(taxYear: number): LuYearParams {
  if (!isLuTaxYear(taxYear)) {
    throw new RangeError(
      `Lucerne tax year ${taxYear} is not supported: no official values for it.`,
    );
  }
  return PARAMS[taxYear];
}
