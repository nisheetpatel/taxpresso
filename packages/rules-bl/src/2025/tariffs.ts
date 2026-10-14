// Basel-Landschaft's state tax (Staatssteuer) tariffs and the cantonal multiplier, tax year 2025.
// - Income: StG § 34 Abs. 1 and 2 (bl-na-steuergesetz-331) gives the formula with the factors of
//   2005; § 20 indexes them every year. The 2025 Eckwerte, parameters, minimum rate and maximum rate
//   are those of the canton's 2025 tariff workbook (bl-2025-tariff-tariftabelle, sheet Tarif, rows 23
//   to 44: index 115.9 points, June 2024); the tariff sheet (bl-2025-tariff-staatssteuer p. 1)
//   prints an extract of the table they give. scripts/bl-tariff.mjs --check compares these values
//   with the workbook and runs the formula on every row of its table (sheet Tabelle 2025
//   Einheitstarif): all equal.
// - Wealth: StG § 51 (Stand 1 January 2023) and the tariff sheet p. 2, the same.
// - The cantonal multiplier on the income tax: the Steuerfussdekret § 17.
// No imports of values: scripts/bl-tariff.mjs reads this module with Node's type stripping.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';
import type { IncomeFormula } from '../tariff.js';

/** The income tariff: Eckwerte in CHF; b, c, D and the rates in millionths. */
export const INCOME_2025: Cited<IncomeFormula> = {
  source:
    'bl-2025-tariff-tariftabelle (sheet Tarif, rows 28 to 39: Startpunkt Tarif 2025, Minimaler Steuersatz, Grenzsteuersatz maximal, Parameter b, c, D); bl-2025-tariff-staatssteuer p. 1 (Einheitstarif mit und ohne Vollsplitting, Auszug aus der Tabelle); bl-na-steuergesetz-331 § 34 Abs. 1 and 2 (p. 27), § 20 (p. 11 and 12); bl-na-tariff-anwendungsregeln (Ziffer 1 to 8)',
  value: {
    min: 16_716,
    medium1: 44_577,
    medium2: 111_442,
    max: 1_281_587,
    segments: [
      { b: -827_429, c: 89_718, d: 829_418_770 },
      { b: -328_481, c: 43_109, d: -1_248_266_121 },
      { b: 51_162, c: 10_441, d: -4_888_819_148 },
    ],
    minRate: 4_900,
    maxRate: 186_200,
  },
};

/**
 * The wealth tax: nothing under CHF 10,000 of taxable wealth; from there, the whole amount by
 * brackets, 1.1 per mille up to CHF 150,000, 2.9 to CHF 350,000, 3.3 above (rates over 10,000).
 */
export const WEALTH_2025: Cited<{ exemptBelow: number; scale: BracketScale }> = {
  source:
    'bl-na-steuergesetz-331 § 51 Abs. 1 and 2 (p. 32); bl-2025-tariff-staatssteuer p. 2 (Vermögenssteuer, Beispiel)',
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
export const MULTIPLIER_2025: Cited<number> = {
  source:
    'bl-na-law-steuerfussdekret-331-2 § 17 (p. 2); bl-na-steuergesetz-331 § 19bis Abs. 1 (p. 11)',
  value: 10_000,
};
