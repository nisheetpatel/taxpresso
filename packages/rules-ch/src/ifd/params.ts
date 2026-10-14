// The federal constants of one tax year, as every canton's engine reads them: the deductions and
// the two scales (art. 36 LIFD). Each is cited (SPEC.md section 7). Federal amounts change every
// year and are never carried from one year to the next (SPEC.md section 7): a year without its
// circular and Form. 58c fails closed.
// Tax year 2025: ch-2025-ifd-frais-professionnels-progression, Form. 58c 2025 (./2025.ts).
// Tax year 2026: ch-2026-ifd-progression-deductions, Form. 58c 2026 (./2026.ts, ./2026-amounts.ts).
import type { Cited, FederalStep, Param } from '../core/cited.js';
import { IFD_2025, IFD_2025_MARRIED, IFD_2025_SINGLE, type IfdAmounts } from './2025.js';
import { IFD_2026_MARRIED, IFD_2026_SINGLE } from './2026.js';
import { IFD_2026, IFD_2026_SIDE_JOB } from './2026-amounts.js';

export const IFD_TAX_YEARS = [2025, 2026] as const;
export type IfdTaxYear = (typeof IFD_TAX_YEARS)[number];

type Params<T> = { [K in keyof T]: T[K] extends Cited<infer V> ? Param<V> : never };

export type IfdParams = Params<IfdAmounts> & {
  singleScale: Param<readonly FederalStep[]>;
  marriedScale: Param<readonly FederalStep[]>;
};

const PARAMS: Record<IfdTaxYear, IfdParams> = {
  2025: { ...IFD_2025, singleScale: IFD_2025_SINGLE, marriedScale: IFD_2025_MARRIED },
  2026: { ...IFD_2026, singleScale: IFD_2026_SINGLE, marriedScale: IFD_2026_MARRIED },
};

export function isIfdTaxYear(year: number): year is IfdTaxYear {
  return (IFD_TAX_YEARS as readonly number[]).includes(year);
}

/** The federal constants of a tax year; any other year fails closed. */
export function ifdParamsFor(taxYear: number): IfdParams {
  if (!isIfdTaxYear(taxYear)) {
    throw new RangeError(
      `Tax year ${taxYear} is not supported: no official federal values for it.`,
    );
  }
  return PARAMS[taxYear];
}

/**
 * The flat deduction of an employee's side job for the federal tax (Form. 2a): 2026 only. The 2025
 * circular in the library gives its minimum and maximum (ch-2026-ifd-progression-deductions p. 2,
 * 2025 column) but no 2025 document gives its rate: undefined, so a canton fails closed.
 */
export function ifdSideJobFlat(
  taxYear: number,
): Cited<{ rateBp: number; min: number; max: number }> | undefined {
  return taxYear === 2026 ? IFD_2026_SIDE_JOB : undefined;
}
