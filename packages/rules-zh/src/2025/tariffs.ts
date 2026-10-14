// Zurich tariffs and cantonal multiplier, tax year 2025. The tariffs are StG § 35 (income) and
// § 47 (wealth) in the text in force on 1 January 2025 (zh-2025-law-steuergesetz-631-1-stand-2025,
// Nachtrag 127), as set by the cold-progression ordinance from 1 January 2024 (zh-2025-tariff-
// kalte-progression-ab-2024, StG footnote 109); both print the same figures. The wealth tariff's
// first step at 0 ‰ is Zurich's tax-free amount of wealth: there is no other wealth deduction.
import type { Cited } from '../cited.js';
import type { StepTariff } from '../tariff.js';

const LAW = 'zh-2025-law-steuergesetz-631-1-stand-2025';
const ORDINANCE = 'zh-2025-tariff-kalte-progression-ab-2024';

/** § 35 Abs. 1, Grundtarif: percent. */
export const INCOME_BASIC_2025: Cited<StepTariff> = {
  source: `${LAW} § 35 Abs. 1 (p. 20); ${ORDINANCE} p. 3`,
  value: {
    denominator: 100,
    steps: [
      [6_900, 0],
      [4_900, 2],
      [4_800, 3],
      [7_900, 4],
      [9_600, 5],
      [11_000, 6],
      [12_900, 7],
      [17_400, 8],
      [33_600, 9],
      [33_200, 10],
      [52_700, 11],
      [68_400, 12],
    ],
    above: [263_300, 13],
  },
};

/**
 * § 35 Abs. 2, Verheiratetentarif: spouses living together, and widowed, separated, divorced or
 * single taxpayers living with children for whom they have the child deduction.
 */
export const INCOME_MARRIED_2025: Cited<StepTariff> = {
  source: `${LAW} § 35 Abs. 2 (p. 20 and 21); ${ORDINANCE} p. 4`,
  value: {
    denominator: 100,
    steps: [
      [13_900, 0],
      [6_300, 2],
      [8_000, 3],
      [9_700, 4],
      [11_100, 5],
      [14_300, 6],
      [31_800, 7],
      [31_900, 8],
      [47_900, 9],
      [57_200, 10],
      [62_100, 11],
      [71_600, 12],
    ],
    above: [365_800, 13],
  },
};

/** § 47 Abs. 1, Grundtarif: half per mille (0, ½, 1, 1½, 2, 2½, 3 ‰). */
export const WEALTH_BASIC_2025: Cited<StepTariff> = {
  source: `${LAW} § 47 Abs. 1 (p. 24); ${ORDINANCE} p. 4`,
  value: {
    denominator: 2000,
    steps: [
      [80_000, 0],
      [238_000, 1],
      [399_000, 2],
      [636_000, 3],
      [956_000, 4],
      [953_000, 5],
    ],
    above: [3_262_000, 6],
  },
};

/** § 47 Abs. 2, Verheiratetentarif, for the same households as § 35 Abs. 2. */
export const WEALTH_MARRIED_2025: Cited<StepTariff> = {
  source: `${LAW} § 47 Abs. 2 (p. 24); ${ORDINANCE} p. 4 and 5`,
  value: {
    denominator: 2000,
    steps: [
      [159_000, 0],
      [239_000, 1],
      [397_000, 2],
      [637_000, 3],
      [955_000, 4],
      [955_000, 5],
    ],
    above: [3_342_000, 6],
  },
};

/** Staatssteuerfuss for 2024 and 2025: 98 % of the einfache Staatssteuer (Kantonsrat, 12.12.2023). */
export const CANTONAL_RATE_2025: Cited<number> = {
  source: 'zh-2025-tariff-staatssteuerfuss-2024-2025 p. 1',
  value: 98,
};
