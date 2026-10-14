// Every constant of one Aargau tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026: the income tariff (StG § 43 with the Progressionsverordnung 2025), the
// wealth tariff (§ 55), the cantonal Steuerfuss (the canton's table of multipliers), the communal and
// church Steuerfüsse (the canton's list of each year) and the deductions (StG, the 2025 guide, the
// canton's table of deductions, the StGV with the federal flat amounts). No value is an estimate:
// the 2026 tariffs are the ones in force for 2026 (./2026/tariffs.ts says why). Any other year fails
// closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import { CANTONAL_RATE_2025, INCOME_2025, WEALTH_2025 } from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import { CANTONAL_RATE_2026, INCOME_2026, WEALTH_2026 } from './2026/tariffs.js';
import type { AgAmounts } from './amounts.js';
import type { AgCommune } from './communes.js';
import type { StepTariff } from './tariff.js';

export const AG_TAX_YEARS = [2025, 2026] as const;
export type AgTaxYear = (typeof AG_TAX_YEARS)[number];

export interface AgYearParams {
  taxYear: AgTaxYear;
  /** StG § 43 Abs. 1 as adjusted: Tarif A on the income, Tarif B on half of it (Abs. 2). */
  incomeTariff: Cited<StepTariff>;
  wealthTariff: Cited<StepTariff>;
  /** The canton's Steuerfuss for natural persons, in percent of the einfache Steuer. */
  cantonalRate: Cited<number>;
  amounts: AgAmounts;
  communes: Cited<readonly AgCommune[]>;
}

const PARAMS: Record<AgTaxYear, AgYearParams> = {
  2025: {
    taxYear: 2025,
    incomeTariff: INCOME_2025,
    wealthTariff: WEALTH_2025,
    cantonalRate: CANTONAL_RATE_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeTariff: INCOME_2026,
    wealthTariff: WEALTH_2026,
    cantonalRate: CANTONAL_RATE_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isAgTaxYear(year: number): year is AgTaxYear {
  return (AG_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of an Aargau tax year; any other year fails closed. */
export function agParamsFor(taxYear: number): AgYearParams {
  if (!isAgTaxYear(taxYear)) {
    throw new RangeError(`Aargau tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
