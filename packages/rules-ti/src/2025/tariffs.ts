// Ticino tariffs, tax year 2025. The income tariffs are LT art. 35 cpv. 1 and 2 as the executive
// decree for 2025 rewrote them for cold progression (LT art. 39), with the threshold and the CHF 100
// rule of art. 35 cpv. 3, and the canton's 2025 instructions print the same tariffs as tables
// (p. 51); the wealth tariff is LT art. 49, unchanged since 2018, which the instructions print as a
// table (p. 52). The decree's PDF pages 7 and 8 are the BU's pages 274 and 275.
// Income rates in thousandths of a percent (5.232 % -> 5_232), taxes in centimes; wealth rates in
// thousandths of a per mille (2.500 per mille -> 2_500).
import type { Cited } from '@taxpresso/rules-ch';
import type { CategoryTariff } from '../tariff.js';

const DECREE = 'ti-2025-tariff-decreto-esecutivo-pf';
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';
const LAW = 'ti-na-law-lt-640-100';
const INF = Number.POSITIVE_INFINITY;

/** LT art. 35 cpv. 1: everyone not taxed by the family tariff. */
export const INCOME_SINGLE_2025: Cited<CategoryTariff> = {
  source: `${DECREE} p. 7 (art. 35 cpv. 1), p. 8 (art. 35 cpv. 3); ${GUIDE} p. 51 (Persone sole)`,
  value: {
    step: 10_000,
    exemptBelow: 1_250_000,
    denominator: 100_000,
    categories: [
      [12_500, 160, 2_000],
      [17_400, 5_232, 27_640],
      [20_800, 5_949, 47_865],
      [26_000, 3_923, 68_265],
      [30_100, 7_499, 99_010],
      [39_900, 9_461, 191_725],
      [52_700, 10_377, 324_550],
      [58_100, 10_988, 383_885],
      [73_000, 11_800, 559_705],
      [91_400, 11_597, 773_095],
      [113_900, 12_470, 1_053_660],
      [227_800, 13_080, 2_543_500],
      [380_600, 14_040, 4_688_810],
      [INF, 14_500, null],
    ],
  },
};

/**
 * LT art. 35 cpv. 2: spouses living together, and widowed, separated, divorced or single people
 * living with minor children, or children in apprenticeship or studies up to 28, whose upkeep
 * they provide, or with people in need they mainly support (the instructions: "la tariffa dei
 * coniugati vale anche per le famiglie monoparentali").
 */
export const INCOME_FAMILY_2025: Cited<CategoryTariff> = {
  source: `${DECREE} p. 7 (art. 35 cpv. 2), p. 8 (art. 35 cpv. 3); ${GUIDE} p. 51 (Coniugati, nota 2)`,
  value: {
    step: 10_000,
    exemptBelow: 2_040_000,
    denominator: 100_000,
    categories: [
      [20_400, 145, 2_960],
      [24_800, 3_923, 20_225],
      [28_200, 4_360, 35_050],
      [33_100, 2_616, 47_865],
      [42_300, 3_923, 83_960],
      [47_800, 6_540, 119_930],
      [60_600, 7_848, 220_385],
      [79_800, 10_116, 414_605],
      [90_400, 11_074, 531_990],
      [122_600, 12_645, 939_145],
      [141_000, 12_034, 1_160_570],
      [183_200, 12_906, 1_705_210],
      [227_800, 13_777, 2_319_685],
      [303_900, 14_302, 3_408_035],
      [761_400, 14_650, 10_110_250],
      [INF, 14_500, null],
    ],
  },
};

/** LT art. 49: the same for everyone. */
export const WEALTH_2025: Cited<CategoryTariff> = {
  source: `${LAW} art. 49 cpv. 1 to 3; ${GUIDE} p. 52 (Tabella per il calcolo dell’imposta cantonale base sulla sostanza 2025)`,
  value: {
    step: 100_000,
    exemptBelow: 20_000_000,
    denominator: 1_000_000,
    categories: [
      [200_000, 1_000, 20_000],
      [280_000, 2_000, 36_000],
      [700_000, 2_500, 141_000],
      [1_380_000, 3_000, 345_000],
      [INF, 2_500, null],
    ],
  },
};
