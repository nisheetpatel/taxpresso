// Basel-Stadt income and wealth tariffs, tax year 2026. No tariff book for 2026 is published; the
// tariffs are printed as tables in the 2026 guide (bs-2026-guide-wegleitung-b p. 44 to 49, the
// income brackets with their adjustment to the cost of living, StG § 37) and in the canton's
// overview of the income tariffs (bs-2026-tariff-einkommenssteuer-uebersicht, dated 18.12.2025:
// the same brackets for 2025 and 2026); the wealth tariffs are StG § 50, not adjusted. Every row
// of the guide's tables was compared with these brackets when they were written: all equal
// (test/tariffs.test.ts keeps a sample with pages). Rates are numerators over 10,000.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';

const GUIDE = 'bs-2026-guide-wegleitung-b';
const OVERVIEW = 'bs-2026-tariff-einkommenssteuer-uebersicht';

/** Tariff A (Grundtarif): single people, unless a child or a supported person makes it tariff B. */
export const INCOME_A_2026: Cited<BracketScale> = {
  source: `${GUIDE} p. 44 and 45 (Kantonaler Einkommenssteuertarif A); ${OVERVIEW} p. 2 (Steuerjahr 2025 to 2026); bs-na-law-stg § 36 al. 1 (p. 17), § 37 (p. 17)`,
  value: {
    denominator: 10_000,
    brackets: [
      [212_500, 2_100],
      [316_300, 2_725],
      [Number.POSITIVE_INFINITY, 2_825],
    ],
  },
};

/** Tariff B: married couples, and single people living with children they mainly support. */
export const INCOME_B_2026: Cited<BracketScale> = {
  source: `${GUIDE} p. 46 and 47 (Kantonaler Einkommenssteuertarif B); ${OVERVIEW} p. 4 (Steuerjahr 2025 to 2026); bs-na-law-stg § 36 al. 2 (p. 17), § 37 (p. 17)`,
  value: {
    denominator: 10_000,
    brackets: [
      [424_900, 2_100],
      [632_500, 2_725],
      [Number.POSITIVE_INFINITY, 2_825],
    ],
  },
};

/** Wealth tariff A: everyone not married, single parents included. */
export const WEALTH_A_2026: Cited<BracketScale> = {
  source: `${GUIDE} p. 48 (Kantonaler Vermögenssteuertarif A); bs-na-law-stg § 50 al. 1 (p. 21)`,
  value: {
    denominator: 10_000,
    brackets: [
      [250_000, 45],
      [750_000, 65],
      [Number.POSITIVE_INFINITY, 79],
    ],
  },
};

/** Wealth tariff B: married couples. */
export const WEALTH_B_2026: Cited<BracketScale> = {
  source: `${GUIDE} p. 49 (Kantonaler Vermögenssteuertarif B); bs-na-law-stg § 50 al. 2 (p. 21)`,
  value: {
    denominator: 10_000,
    brackets: [
      [400_000, 45],
      [1_200_000, 65],
      [Number.POSITIVE_INFINITY, 79],
    ],
  },
};
