// Bern tariffs and cantonal multiplier, tax year 2026. The income tariffs are StG Art. 42 in the
// text in force from 1 January 2026 (be-2026-stg-de, its steps adjusted for cold progression by
// the change of 26.03.2025); the canton's tables of the einfache Steuer per CHF 100 "ab Steuerjahr
// 2026" (be-2026-tariff-einkommen-verheiratete, -alleinstehende) give the same tax on every one of
// their 11,160 rows each. The wealth tariff is Art. 65, unchanged from 2025.
import type { Cited } from '@taxpresso/rules-ch';
import type { StepTariff } from '../tariff.js';

const LAW = 'be-2026-stg-de';

/**
 * Art. 42 Abs. 1: married couples, and widowed, separated, divorced and single taxpayers living
 * with children or people in need whose upkeep they mainly bear. Percent with two decimals.
 */
export const INCOME_MARRIED_2026: Cited<StepTariff> = {
  source: `${LAW} Art. 42 Abs. 1 (p. 31 and 32); be-2026-tariff-einkommen-verheiratete p. 1 to 62`,
  value: {
    denominator: 10_000,
    steps: [
      [3_300, 155],
      [3_300, 165],
      [9_800, 285],
      [16_100, 365],
      [26_900, 380],
      [26_900, 430],
      [26_900, 485],
      [26_900, 520],
      [41_700, 570],
      [54_300, 585],
      [54_300, 595],
      [54_300, 620],
      [141_300, 640],
    ],
    above: 650,
  },
};

/** Art. 42 Abs. 2: everyone else. */
export const INCOME_OTHER_2026: Cited<StepTariff> = {
  source: `${LAW} Art. 42 Abs. 2 (p. 32 and 33); be-2026-tariff-einkommen-alleinstehende p. 1 to 62`,
  value: {
    denominator: 10_000,
    steps: [
      [3_300, 195],
      [3_300, 290],
      [9_800, 360],
      [16_100, 415],
      [26_900, 445],
      [26_900, 500],
      [26_900, 560],
      [26_900, 575],
      [26_900, 590],
      [26_900, 605],
      [37_700, 615],
      [86_900, 630],
      [152_100, 640],
    ],
    above: 650,
  },
};

/** Art. 65 Abs. 1: one wealth tariff for everyone, per mille with two decimals. */
export const WEALTH_2026: Cited<StepTariff> = {
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
 * Steueranlage of the canton for natural persons in 2026: 2.975 times the einfache Steuer, in
 * ten-thousandths (StG Art. 2 Abs. 2, Art. 3 Abs. 1). The 2026 document lists it; the xlsx's
 * sheet gives 2.975 from 2025 with no later row.
 */
export const CANTONAL_RATE_2026: Cited<number> = {
  source:
    'be-2026-steueranlagen-gemeinden-de p. 7 (1.2 Kantonssteueranlagen); be-na-communal-steueranlagen-1983-2026 sheet Kantonsanlage (row 4, from 2025)',
  value: 29_750,
};
