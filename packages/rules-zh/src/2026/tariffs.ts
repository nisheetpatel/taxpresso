// Zurich tariffs and cantonal multiplier, tax year 2026. The tariffs are StG § 35 (income) and
// § 47 (wealth) in the text in force on 1 April 2026 (zh-2026-law-steuergesetz-631-1-stand-2026,
// Nachtrag 132), as set by the cold-progression ordinance from 1 January 2026 (zh-2026-tariff-
// kalte-progression-ab-2026, StG footnote 113); both print the same figures.
import type { Cited } from '../cited.js';
import type { StepTariff } from '../tariff.js';

const LAW = 'zh-2026-law-steuergesetz-631-1-stand-2026';
const ORDINANCE = 'zh-2026-tariff-kalte-progression-ab-2026';

/** § 35 Abs. 1, Grundtarif: percent. */
export const INCOME_BASIC_2026: Cited<StepTariff> = {
  source: `${LAW} § 35 Abs. 1 (p. 20); ${ORDINANCE} p. 3`,
  value: {
    denominator: 100,
    steps: [
      [7_000, 0],
      [5_000, 2],
      [4_800, 3],
      [8_000, 4],
      [9_700, 5],
      [11_200, 6],
      [13_100, 7],
      [17_600, 8],
      [34_000, 9],
      [33_700, 10],
      [53_300, 11],
      [69_300, 12],
    ],
    above: [266_700, 13],
  },
};

/** § 35 Abs. 2, Verheiratetentarif. */
export const INCOME_MARRIED_2026: Cited<StepTariff> = {
  source: `${LAW} § 35 Abs. 2 (p. 21); ${ORDINANCE} p. 3`,
  value: {
    denominator: 100,
    steps: [
      [14_100, 0],
      [6_400, 2],
      [8_100, 3],
      [9_800, 4],
      [11_200, 5],
      [14_500, 6],
      [32_200, 7],
      [32_400, 8],
      [48_500, 9],
      [57_900, 10],
      [62_900, 11],
      [72_600, 12],
    ],
    above: [370_600, 13],
  },
};

/** § 47 Abs. 1, Grundtarif: half per mille. */
export const WEALTH_BASIC_2026: Cited<StepTariff> = {
  source: `${LAW} § 47 Abs. 1 (p. 24); ${ORDINANCE} p. 4`,
  value: {
    denominator: 2000,
    steps: [
      [81_000, 0],
      [241_000, 1],
      [404_000, 2],
      [645_000, 3],
      [968_000, 4],
      [965_000, 5],
    ],
    above: [3_304_000, 6],
  },
};

/** § 47 Abs. 2, Verheiratetentarif. */
export const WEALTH_MARRIED_2026: Cited<StepTariff> = {
  source: `${LAW} § 47 Abs. 2 (p. 25); ${ORDINANCE} p. 4`,
  value: {
    denominator: 2000,
    steps: [
      [161_000, 0],
      [242_000, 1],
      [402_000, 2],
      [646_000, 3],
      [967_000, 4],
      [967_000, 5],
    ],
    above: [3_385_000, 6],
  },
};

/**
 * Staatssteuerfuss for 2026 and 2027: 95 % (Kantonsrat, 15.12.2025). The 2026 source-tax sheet
 * (zh-2026-source-tax-grundlagen-parameter p. 1) still prints 98 %; the decision is the act that
 * sets the multiplier (StG § 2 Abs. 2). See docs/sources/zh/NOTES.md.
 */
export const CANTONAL_RATE_2026: Cited<number> = {
  source: 'zh-2026-tariff-staatssteuerfuss-2026-2027 p. 1',
  value: 95,
};
