// Every constant of one Bern tax year, as the engine reads them, each cited (SPEC.md section 7).
// Tax years 2025 and 2026 are published in full: the income tariffs (StG Art. 42, with the canton's
// tables), the wealth tariff (Art. 65), the cantonal Steueranlage (finance administration document
// 556.6 of each year), the communal Steueranlagen and church tax rates (the tax administration's
// table, checked against document 556.6) and the deductions (StG, the canton's table of deductions
// by year, the Berufskostenverordnung with the federal partial flat amounts). No value is an
// estimate. Any other year fails closed.
import type { Cited } from '@taxpresso/rules-ch';
import { AMOUNTS_2025 } from './2025/amounts.js';
import { COMMUNES_2025 } from './2025/communes.js';
import {
  CANTONAL_RATE_2025,
  INCOME_MARRIED_2025,
  INCOME_OTHER_2025,
  WEALTH_2025,
} from './2025/tariffs.js';
import { AMOUNTS_2026 } from './2026/amounts.js';
import { COMMUNES_2026 } from './2026/communes.js';
import {
  CANTONAL_RATE_2026,
  INCOME_MARRIED_2026,
  INCOME_OTHER_2026,
  WEALTH_2026,
} from './2026/tariffs.js';
import type { BeAmounts } from './amounts.js';
import type { BeCommune } from './communes.js';
import type { StepTariff } from './tariff.js';

export const BE_TAX_YEARS = [2025, 2026] as const;
export type BeTaxYear = (typeof BE_TAX_YEARS)[number];

export interface BeYearParams {
  taxYear: BeTaxYear;
  /** Art. 42 Abs. 1 (married couples and single parents) and Abs. 2 (everyone else). */
  incomeTariff: { married: Cited<StepTariff>; other: Cited<StepTariff> };
  wealthTariff: Cited<StepTariff>;
  /** Steueranlage of the canton for natural persons, in ten-thousandths of the einfache Steuer. */
  cantonalRate: Cited<number>;
  amounts: BeAmounts;
  communes: Cited<readonly BeCommune[]>;
}

const PARAMS: Record<BeTaxYear, BeYearParams> = {
  2025: {
    taxYear: 2025,
    incomeTariff: { married: INCOME_MARRIED_2025, other: INCOME_OTHER_2025 },
    wealthTariff: WEALTH_2025,
    cantonalRate: CANTONAL_RATE_2025,
    amounts: AMOUNTS_2025,
    communes: COMMUNES_2025,
  },
  2026: {
    taxYear: 2026,
    incomeTariff: { married: INCOME_MARRIED_2026, other: INCOME_OTHER_2026 },
    wealthTariff: WEALTH_2026,
    cantonalRate: CANTONAL_RATE_2026,
    amounts: AMOUNTS_2026,
    communes: COMMUNES_2026,
  },
};

export function isBeTaxYear(year: number): year is BeTaxYear {
  return (BE_TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a Bern tax year; any other year fails closed. */
export function beParamsFor(taxYear: number): BeYearParams {
  if (!isBeTaxYear(taxYear)) {
    throw new RangeError(`Bern tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
