// Every constant of one tax year, as the engine reads them. Each is cited (SPEC.md section 7); a
// value that is not published yet for the year carries the reason it is an estimate (section 9).
//
// Tax year 2025: all published (Geneva guide and tariff 2025, AFC communal table 2025, federal
// circular and Form. 58c 2025).
// Tax year 2026: federal values published (circular of 11 September 2025, Form. 58c 2026); Geneva
// communal centimes (ArCA-2026) and privileged shares (Conseil d'Etat, 15 October 2025) published;
// Geneva's scales and indexed amounts published in the regulation of 8 October 2025 (ge-2026-rcepf,
// ../2026/icc.ts). Two Geneva amounts come only with the 2026 guide (January 2027): the ceiling for
// health insurance premiums and the meal amounts; until then the 2025 ones are used for them and
// flagged as estimates. The LCP amounts are in the law itself (consolidated 1 January 2026).
// The federal values are packages/rules-ch's (ifd/params.ts), the same in every canton.
import { ifdParamsFor, type Cited, type IfdParams } from '@taxpresso/rules-ch';
import { ICC_2025_INCOME_SCALE } from '../2025/icc.js';
import { ICC_2025, type IccAmounts } from '../2025/icc-amounts.js';
import { ICC_2025_WEALTH_SCALE, ICC_2025_WEALTH_SUPPLEMENTARY_SCALE } from '../2025/icc-wealth.js';
import { COMMUNE_CENTIMES_2025, PRIVILEGED_SHARE_2025 } from '../2025/communes.js';
import { COMMUNE_CENTIMES_2026, type CommuneSlug } from '../2026/communes.js';
import {
  ICC_2026,
  ICC_2026_INCOME_SCALE,
  ICC_2026_WEALTH_SCALE,
  ICC_2026_WEALTH_SUPPLEMENTARY_SCALE,
} from '../2026/icc.js';
import { PRIVILEGED_SHARE_2026 } from '../2026/privileged-share.js';
import { PERSONAL_TAX } from '../law/lcp.js';
import { estimated, type BracketScale, type Param } from './param.js';

export const TAX_YEARS = [2025, 2026] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

type Params<T> = { [K in keyof T]: T[K] extends Cited<infer V> ? Param<V> : never };

export interface YearParams {
  taxYear: TaxYear;
  icc: Params<IccAmounts> & {
    incomeScale: Param<BracketScale>;
    wealthScale: Param<BracketScale>;
    wealthSupplementaryScale: Param<BracketScale>;
  };
  communes: {
    centimes: Param<Readonly<Record<CommuneSlug, number>>>;
    privilegedShare: Param<Readonly<Record<CommuneSlug, number>>>;
  };
  personalTax: Param<(typeof PERSONAL_TAX)['value']>;
  ifd: IfdParams;
}

const ICC_INCOME_SCALE_2025: Cited<BracketScale> = {
  source: ICC_2025_INCOME_SCALE.source,
  value: { denominator: 10_000, brackets: ICC_2025_INCOME_SCALE.value },
};

const icc2025: YearParams['icc'] = {
  ...ICC_2025,
  incomeScale: ICC_INCOME_SCALE_2025,
  wealthScale: ICC_2025_WEALTH_SCALE,
  wealthSupplementaryScale: ICC_2025_WEALTH_SUPPLEMENTARY_SCALE,
};

/**
 * 2026: the regulation's and the laws' values, and the two amounts Geneva has not published yet
 * (the 2025 ones, flagged).
 */
const icc2026: YearParams['icc'] = {
  ...ICC_2026,
  healthCap: estimated(ICC_2025.healthCap, 'ge-2026-unpublished'),
  meals: estimated(ICC_2025.meals, 'ge-2026-unpublished'),
  incomeScale: ICC_2026_INCOME_SCALE,
  wealthScale: ICC_2026_WEALTH_SCALE,
  wealthSupplementaryScale: ICC_2026_WEALTH_SUPPLEMENTARY_SCALE,
};

const PARAMS: Record<TaxYear, YearParams> = {
  2025: {
    taxYear: 2025,
    icc: icc2025,
    communes: { centimes: COMMUNE_CENTIMES_2025, privilegedShare: PRIVILEGED_SHARE_2025 },
    personalTax: PERSONAL_TAX,
    ifd: ifdParamsFor(2025),
  },
  2026: {
    taxYear: 2026,
    icc: icc2026,
    communes: { centimes: COMMUNE_CENTIMES_2026, privilegedShare: PRIVILEGED_SHARE_2026 },
    personalTax: PERSONAL_TAX,
    ifd: ifdParamsFor(2026),
  },
};

export function isTaxYear(year: number): year is TaxYear {
  return (TAX_YEARS as readonly number[]).includes(year);
}

/** The constants of a tax year; any other year fails closed. */
export function paramsFor(taxYear: number): YearParams {
  if (!isTaxYear(taxYear)) {
    throw new RangeError(`Tax year ${taxYear} is not supported: no official values for it.`);
  }
  return PARAMS[taxYear];
}
