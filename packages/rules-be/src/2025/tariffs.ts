// Bern tariffs and cantonal multiplier, tax year 2025. The income tariffs are StG Art. 42 in the
// text in force from 1 January to 31 December 2025 (be-2025-stg-de, its steps adjusted to the
// cost of living, Art. 3 Abs. 4); the canton's tables of the einfache Steuer per CHF 100 "ab
// Steuerjahr 2025" (be-2025-tariff-einkommen-verheiratete, -alleinstehende) give the same tax on
// every one of their 11,160 rows each. The wealth tariff is Art. 65; no table is published for it.
import type { Cited } from '@taxpresso/rules-ch';
import type { StepTariff } from '../tariff.js';

const LAW = 'be-2025-stg-de';

/**
 * Art. 42 Abs. 1: married couples, and widowed, separated, divorced and single taxpayers living
 * with children or people in need whose upkeep they mainly bear. Percent with two decimals.
 */
export const INCOME_MARRIED_2025: Cited<StepTariff> = {
  source: `${LAW} Art. 42 Abs. 1 (p. 31 and 32); be-2025-tariff-einkommen-verheiratete p. 1 to 62`,
  value: {
    denominator: 10_000,
    steps: [
      [3_300, 155],
      [3_300, 165],
      [9_800, 285],
      [16_000, 365],
      [26_700, 380],
      [26_700, 430],
      [26_700, 485],
      [26_700, 520],
      [41_400, 570],
      [54_000, 585],
      [54_000, 595],
      [54_000, 620],
      [140_400, 640],
    ],
    above: 650,
  },
};

/** Art. 42 Abs. 2: everyone else. */
export const INCOME_OTHER_2025: Cited<StepTariff> = {
  source: `${LAW} Art. 42 Abs. 2 (p. 32 and 33); be-2025-tariff-einkommen-alleinstehende p. 1 to 62`,
  value: {
    denominator: 10_000,
    steps: [
      [3_300, 195],
      [3_300, 290],
      [9_800, 360],
      [16_000, 415],
      [26_700, 445],
      [26_700, 500],
      [26_700, 560],
      [26_700, 575],
      [26_700, 590],
      [26_700, 605],
      [37_400, 615],
      [86_400, 630],
      [151_200, 640],
    ],
    above: 650,
  },
};

/** Art. 65 Abs. 1: one wealth tariff for everyone, per mille with two decimals. */
export const WEALTH_2025: Cited<StepTariff> = {
  source: `${LAW} Art. 65 Abs. 1 (p. 41)`,
  value: {
    denominator: 100_000,
    steps: [
      [36_000, 0],
      [41_000, 40],
      [139_000, 70],
      [221_000, 80],
      [371_000, 100],
      [551_000, 120],
      [2_369_000, 130],
      [2_575_000, 135],
    ],
    above: 125,
  },
};

/**
 * Steueranlage of the canton for natural persons in 2025: 2.975 times the einfache Steuer, in
 * ten-thousandths (StG Art. 2 Abs. 2, Art. 3 Abs. 1: set yearly by the Grosser Rat).
 */
export const CANTONAL_RATE_2025: Cited<number> = {
  source:
    'be-2025-steueranlagen-gemeinden-de p. 7 (1.2 Kantonssteueranlagen); be-na-communal-steueranlagen-1983-2026 sheet Kantonsanlage (row 4, from 2025)',
  value: 29_750,
};
