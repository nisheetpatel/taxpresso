// Basel-Landschaft's state tax (Staatssteuer) tariffs and the cantonal multiplier, tax year 2026.
// - Income: StG § 34 Abs. 1 and 2 (bl-na-steuergesetz-331) gives the formula with the factors of
//   2005; § 20 indexes them every year. The 2026 Eckwerte, parameters, minimum rate and maximum rate
//   are those of the canton's 2026 tariff workbook (bl-2026-tariff-tariftabelle, sheet Tarif, rows 24
//   to 45: index 116.0 points, June 2025); the tariff sheet (bl-2026-tariff-staatssteuer p. 1)
//   prints an extract of the table they give and states the minimum rate for Vollsplitting.
//   scripts/bl-tariff.mjs --check compares these values with the workbook and runs the formula on
//   every row of its table (sheet Tabelle 2026 Einheitstarif): all equal.
// - Wealth: StG § 51 (Stand 1 January 2023) and the tariff sheet p. 2, the same as in 2025.
// - The cantonal multiplier on the income tax: the Steuerfussdekret § 18.
// No imports of values: scripts/bl-tariff.mjs reads this module with Node's type stripping.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import type { IncomeFormula } from '../tariff.js';

/** The income tariff: Eckwerte in CHF; b, c, D and the rates in millionths. */
export const INCOME_2026: Cited<IncomeFormula> = {
  source:
    'bl-2026-tariff-tariftabelle (sheet Tarif, rows 29 to 40: Startpunkt Tarif 2026, Minimaler Steuersatz, Grenzsteuersatz maximal, Parameter b, c, D); bl-2026-tariff-staatssteuer p. 1 (Einheitstarif mit und ohne Vollsplitting, mindestens zum Minimalsteuersatz, Auszug aus der Tabelle); bl-na-steuergesetz-331 § 34 Abs. 1 and 2 (p. 27), § 20 (p. 11 and 12); bl-na-tariff-anwendungsregeln (Ziffer 1 to 8)',
  value: {
    min: 16_731,
    medium1: 44_615,
    medium2: 111_538,
    max: 1_282_692,
    segments: [
      { b: -827_548, c: 89_722, d: 830_223_746 },
      { b: -328_507, c: 43_108, d: -1_249_444_454 },
      { b: 51_153, c: 10_441, d: -4_893_077_017 },
    ],
    minRate: 4_900,
    maxRate: 186_200,
  },
};

/**
 * The wealth tax: nothing under CHF 10,000 of taxable wealth; from there, the whole amount by
 * brackets, 1.1 per mille up to CHF 150,000, 2.9 to CHF 350,000, 3.3 above (rates over 10,000).
 */
export const WEALTH_2026: Cited<{ exemptBelow: number; scale: BracketScale }> = {
  source:
    'bl-na-steuergesetz-331 § 51 Abs. 1 and 2 (p. 32); bl-2026-tariff-staatssteuer p. 2 (Vermögenssteuer, Beispiel)',
  value: {
    exemptBelow: 1_000_000,
    scale: {
      denominator: 10_000,
      brackets: [
        [150_000, 11],
        [350_000, 29],
        [Number.POSITIVE_INFINITY, 33],
      ],
    },
  },
};

/** The cantonal multiplier on the income tax, in hundredths of a percent of the normal state tax. */
export const MULTIPLIER_2026: Cited<number> = {
  source:
    'bl-na-law-steuerfussdekret-331-2 § 18 (p. 2); bl-na-steuergesetz-331 § 19bis Abs. 1 (p. 11)',
  value: 10_000,
};
