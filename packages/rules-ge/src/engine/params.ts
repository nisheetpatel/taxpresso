// Every constant of one tax year, as the engine reads them. Each is cited (SPEC.md section 7); a
// value that is not published yet for the year carries the reason it is an estimate (section 9).
//
// Tax year 2025: all published (Geneva guide and tariff 2025, AFC communal table 2025, federal
// circular and Form. 58c 2025).
// Tax year 2026: federal values published (circular of 11 September 2025, Form. 58c 2026); Geneva
// communal centimes (ArCA-2026) and privileged shares (Conseil d'Etat, 15 October 2025) published;
// Geneva scales and amounts are published in January 2027, so until then the 2025 values are used
// and flagged as estimates. The LCP amounts are in the law itself (consolidated 1 January 2026).
import { ICC_2025_INCOME_SCALE, type Cited } from '../2025/icc.js';
import { ICC_2025, type IccAmounts } from '../2025/icc-amounts.js';
import { ICC_2025_WEALTH_SCALE, ICC_2025_WEALTH_SUPPLEMENTARY_SCALE } from '../2025/icc-wealth.js';
import { IFD_2025, IFD_2025_MARRIED, IFD_2025_SINGLE, type IfdAmounts } from '../2025/ifd.js';
import { COMMUNE_CENTIMES_2025, PRIVILEGED_SHARE_2025 } from '../2025/communes.js';
import { COMMUNE_CENTIMES_2026, type CommuneSlug } from '../2026/communes.js';
import { IFD_2026_MARRIED, IFD_2026_SINGLE } from '../2026/ifd.js';
import { IFD_2026 } from '../2026/ifd-amounts.js';
import { PRIVILEGED_SHARE_2026 } from '../2026/privileged-share.js';
import { PERSONAL_TAX } from '../law/lcp.js';
import {
  estimated,
  type BracketScale,
  type EstimateReason,
  type FederalStep,
  type Param,
} from './param.js';

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
  ifd: Params<IfdAmounts> & {
    singleScale: Param<readonly FederalStep[]>;
    marriedScale: Param<readonly FederalStep[]>;
  };
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

/** Every value of a group, flagged as an estimate for the reason given. */
function flagged<T extends Record<string, Cited<unknown>>>(group: T, reason: EstimateReason): T {
  return Object.fromEntries(
    Object.entries(group).map(([k, p]) => [k, estimated(p, reason)]),
  ) as unknown as T;
}

const PARAMS: Record<TaxYear, YearParams> = {
  2025: {
    taxYear: 2025,
    icc: icc2025,
    communes: { centimes: COMMUNE_CENTIMES_2025, privilegedShare: PRIVILEGED_SHARE_2025 },
    personalTax: PERSONAL_TAX,
    ifd: { ...IFD_2025, singleScale: IFD_2025_SINGLE, marriedScale: IFD_2025_MARRIED },
  },
  2026: {
    taxYear: 2026,
    icc: flagged(icc2025, 'ge-2026-unpublished'),
    communes: { centimes: COMMUNE_CENTIMES_2026, privilegedShare: PRIVILEGED_SHARE_2026 },
    personalTax: PERSONAL_TAX,
    ifd: { ...IFD_2026, singleScale: IFD_2026_SINGLE, marriedScale: IFD_2026_MARRIED },
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
