// Tax withheld on income from securities and accounts, and what the état des titres claims back.
// Integer centimes only.
//
// Swiss withholding tax (impôt anticipé, IA):
// - 35 % of the taxable payment on income from movable capital: ch-na-law-lia art. 13 al. 1
//   let. a (p. 10).
// - The état des titres is the official refund claim; the IA claimed is 35 % of the total gross
//   income subject to IA, rounded to 5 centimes, credited against the cantonal and communal tax
//   (ICC): ge-2025-guide-declaration-pp p. 38 and p. 39.
//
// Foreign tax withheld at source (imputation d'impôts étrangers prélevés à la source, IES, form
// DA-1):
// - Only the non-recoverable tax under the treaty is credited, and only what was actually
//   withheld: ch-2025-oiis-dff-annexe art. 1 (p. 1) and note A2 (p. 10). The rest can only be
//   reclaimed from the foreign state.
// - No credit when the non-recoverable taxes total CHF 100 or less: ch-na-oiis art. 7 (p. 4),
//   ge-2025-guide-declaration-pp p. 39. The gross income is then reduced by the non-recoverable
//   tax instead: ch-na-oiis art. 2 al. 3 (p. 2), guide p. 39.
// - The income is declared gross (ch-na-oiis art. 3 al. 2, p. 3), with the income in the column
//   "non soumis à l'impôt anticipé" (guide p. 39).
// - The tax office caps the credit at the Swiss tax on that income (ch-na-oiis art. 8 al. 2 and
//   art. 9, p. 5 and 6): Taxpresso shows the amount requested, the office applies the cap.
// - The rates are published per income year, each February for the year before. A year without
//   its list fails closed: nothing is credited until the list is added here.
import type { Cited } from '../2025/icc.js';

/** 35 %, in basis points. */
export const IA_RATE: Cited<number> = {
  value: 3500,
  source: 'ch-na-law-lia art. 13 al. 1 let. a (p. 10); ge-2025-guide-declaration-pp p. 39',
};

/** The IA claimed is rounded to 5 centimes. */
export const IA_ROUNDING: Cited<number> = {
  value: 5,
  source: 'ge-2025-guide-declaration-pp p. 39',
};

/** Client-deposit interest of CHF 200 or less a year bears no IA (the guide says "inférieurs"). */
export const IA_DEPOSIT_INTEREST_EXEMPT: Cited<number> = {
  value: 200_00,
  source: 'ch-na-law-lia art. 5 al. 1 let. c (p. 4); ge-2025-guide-declaration-pp p. 40',
};

/** The foreign tax credit is granted only above CHF 100 in total. */
export const IES_MINIMUM: Cited<number> = {
  value: 100_00,
  source: 'ch-na-oiis art. 7 (p. 4); ge-2025-guide-declaration-pp p. 39',
};

/** a × b / c, rounded half up, for non-negative integers, exactly. */
function mulDivRound(a: number, b: number, c: number): number {
  if (a < 0 || b < 0 || c <= 0) throw new Error('mulDivRound takes non-negative integers');
  const n = BigInt(a) * BigInt(b);
  const d = BigInt(c);
  const q = n / d;
  const r = n % d;
  const out = Number(2n * r >= d ? q + 1n : q);
  if (!Number.isSafeInteger(out)) throw new Error('amount too large');
  return out;
}

/** Centimes rounded to the whole franc, halves up (amounts on the form are in francs). */
export function roundFranc(centimes: number): number {
  if (!Number.isSafeInteger(centimes)) throw new Error('centimes must be an integer');
  const sign = centimes < 0 ? -1 : 1;
  return sign * mulDivRound(Math.abs(centimes), 1, 100) * 100;
}

/** The IA claimed back on the gross income subject to IA (in centimes, whole francs on the form). */
export function iaClaim(subjectCentimes: number): number {
  const step = IA_ROUNDING.value;
  // 35 % of the income, in centimes, then to the nearest 5 centimes: one exact rounding.
  return mulDivRound(subjectCentimes, IA_RATE.value, 10_000 * step) * step;
}

/** The IA a payment should have borne: 35 % of it, to the centime. For consistency checks. */
export function iaOn(grossCentimes: number): number {
  return mulDivRound(grossCentimes, IA_RATE.value, 10_000);
}

export type ForeignIncomeKind = 'dividend' | 'interest';

export interface ResidualRate {
  /** Non-recoverable rate in basis points (1500 = 15 %). */
  bp: number;
  source: string;
  /** A caveat the official list attaches to the rate. */
  caveat?: { en: string; fr: string };
}

interface ResidualList {
  source: string;
  /** ISO 3166 country code: the rates for income received by an individual holding a portfolio. */
  countries: Readonly<Record<string, Partial<Record<ForeignIncomeKind, ResidualRate>>>>;
}

const ANNEX_2025 = 'ch-2025-oiis-dff-annexe';
const portfolio = (page: number, bp: number, caveat?: ResidualRate['caveat']): ResidualRate => ({
  bp,
  source: `${ANNEX_2025} p. ${page}`,
  ...(caveat ? { caveat } : {}),
});

/**
 * Non-recoverable foreign tax by income year, from the annex to the DFF ordinance. Dividends:
 * the "autres" line (not a subsidiary). Only the states and kinds of income listed here are
 * credited; anything else fails closed. Add a year's list when it is published.
 */
export const FOREIGN_RESIDUAL_RATES: Readonly<Record<number, ResidualList>> = {
  // "Valable pour les revenus échus au cours de l'année 2025" (p. 2).
  2025: {
    source: `${ANNEX_2025} p. 2`,
    countries: {
      AT: { dividend: portfolio(3, 1500) },
      BE: { dividend: portfolio(3, 1500), interest: portfolio(3, 1000) },
      // Interest paid to persons who are not related: 0 %.
      CA: { dividend: portfolio(4, 1500), interest: portfolio(4, 0) },
      DE: { dividend: portfolio(2, 1500) },
      DK: { dividend: portfolio(4, 1500) },
      ES: { dividend: portfolio(4, 1500) },
      FI: { dividend: portfolio(5, 1000) },
      // 12.8 % on dividends paid to individuals (note B26, p. 12).
      FR: { dividend: { bp: 1280, source: `${ANNEX_2025} p. 5 and note B26 (p. 12)` } },
      // The United Kingdom levies no tax on dividends, except those of REITs (note B32, p. 12).
      GB: { dividend: { bp: 0, source: `${ANNEX_2025} p. 8 and note B32 (p. 12)` } },
      IT: { dividend: portfolio(6, 1500) },
      JP: { dividend: portfolio(6, 1000) },
      LU: { dividend: portfolio(7, 1500) },
      NL: { dividend: portfolio(8, 1500) },
      NO: { dividend: portfolio(7, 1500) },
      SE: { dividend: portfolio(9, 1500) },
      US: {
        dividend: {
          bp: 1500,
          source: `${ANNEX_2025} p. 5 and note B29 (p. 12)`,
          caveat: {
            en: 'No credit for dividends of US REITs taxed at 30 %.',
            fr: 'Pas d’imputation pour les dividendes de REIT américains imposés à 30 %.',
          },
        },
      },
    },
  },
};

export type ResidualLookup =
  { ok: true; rate: ResidualRate } | { ok: false; reason: 'no_list' | 'no_country' | 'no_kind' };

/** The non-recoverable rate for income of `kind` from `country` received in `incomeYear`. */
export function residualRate(
  country: string | undefined,
  kind: ForeignIncomeKind,
  incomeYear: number,
): ResidualLookup {
  const list = FOREIGN_RESIDUAL_RATES[incomeYear];
  if (!list) return { ok: false, reason: 'no_list' };
  const rates = country ? list.countries[country.toUpperCase()] : undefined;
  if (!rates) return { ok: false, reason: 'no_country' };
  const rate = rates[kind];
  return rate ? { ok: true, rate } : { ok: false, reason: 'no_kind' };
}

/**
 * How much of the foreign tax withheld is non-recoverable (credited through DA-1, or deducted from
 * the income when the total is too small) and how much can only be reclaimed abroad.
 */
export function splitForeignTax(
  grossCentimes: number,
  withheldCentimes: number,
  rateBp: number,
): { nonRecoverable: number; recoverableAbroad: number } {
  const atRate = mulDivRound(Math.max(0, grossCentimes), rateBp, 10_000);
  const nonRecoverable = Math.min(Math.max(0, withheldCentimes), atRate);
  return { nonRecoverable, recoverableAbroad: Math.max(0, withheldCentimes) - nonRecoverable };
}
