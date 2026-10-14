// Every constant of one Zurich tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026 are published in full: tariffs (StG § 35, § 47 and the cold-progression
// ordinances), the cantonal multiplier (Kantonsrat decisions), the communal multipliers (statistics
// office table, 2026 marked definitive) and the deductions (StG, professional-costs ordinances). No
// value is an estimate. Any other year fails closed.
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import {
  CANTONAL_RATE_2025,
  INCOME_BASIC_2025,
  INCOME_MARRIED_2025,
  WEALTH_BASIC_2025,
  WEALTH_MARRIED_2025,
} from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import {
  CANTONAL_RATE_2026,
  INCOME_BASIC_2026,
  INCOME_MARRIED_2026,
  WEALTH_BASIC_2026,
  WEALTH_MARRIED_2026,
} from './2026/tariffs.js';
import type { ZhAmounts } from './amounts.js';
import type { Cited } from '@taxpresso/rules-ch';
import type { CommuneRates } from './communes.js';
import type { StepTariff } from './tariff.js';

export const ZH_TAX_YEARS = [2025, 2026] as const;
export type ZhTaxYear = (typeof ZH_TAX_YEARS)[number];

export interface ZhYearParams {
  taxYear: ZhTaxYear;
  incomeTariff: { basic: Cited<StepTariff>; married: Cited<StepTariff> };
  wealthTariff: { basic: Cited<StepTariff>; married: Cited<StepTariff> };
  /** Staatssteuerfuss, in percent of the einfache Staatssteuer. */
  cantonalRate: Cited<number>;
  amounts: ZhAmounts;
  communes: Cited<readonly CommuneRates[]>;
}

const PARAMS: Record<ZhTaxYear, ZhYearParams> = {
  2025: {
    taxYear: 2025,
    incomeTariff: { basic: INCOME_BASIC_2025, married: INCOME_MARRIED_2025 },
    wealthTariff: { basic: WEALTH_BASIC_2025, married: WEALTH_MARRIED_2025 },
    cantonalRate: CANTONAL_RATE_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeTariff: { basic: INCOME_BASIC_2026, married: INCOME_MARRIED_2026 },
    wealthTariff: { basic: WEALTH_BASIC_2026, married: WEALTH_MARRIED_2026 },
    cantonalRate: CANTONAL_RATE_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isZhTaxYear(year: number): year is ZhTaxYear {
  return (ZH_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Zurich tax year; any other year fails closed. */
export function zhParamsFor(taxYear: number): ZhYearParams {
  if (!isZhTaxYear(taxYear)) {
    throw new RangeError(`Zurich tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
