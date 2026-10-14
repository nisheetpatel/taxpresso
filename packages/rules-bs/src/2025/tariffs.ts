// Basel-Stadt income and wealth tariffs, tax year 2025. The income tariffs are StG § 36 with its
// brackets adjusted to the cost of living (§ 37), as the canton's tariff book prints them
// (bs-2025-tariff-einkommens-vermoegenssteuer, "ab Steuerperiode 2025") and the guide repeats them
// (bs-2025-guide-wegleitung p. 44 to 47); the wealth tariffs are StG § 50, not adjusted. Every row
// of the tariff book's tables (income CHF 100 to 248,000 in tariff A and to 540,000 in tariff B,
// wealth CHF 1,000 to 2,500,000 in tariff A and to 4,300,000 in tariff B) was compared with these
// brackets when they were written: all equal (test/tariffs.test.ts keeps a sample with pages).
// Rates are numerators over 10,000: 2,100 is CHF 21 per CHF 100, 45 is CHF 4.50 per CHF 1,000.
import type { BracketScale, Cited } from '@taxpresso/rules-ch';

const BOOK = 'bs-2025-tariff-einkommens-vermoegenssteuer';
const GUIDE = 'bs-2025-guide-wegleitung';

/** Tariff A (Grundtarif): single people, unless a child or a supported person makes it tariff B. */
export const INCOME_A_2025: Cited<BracketScale> = {
  source: `${BOOK} p. 3 to 5 (Tarif A, ab Steuerperiode 2025); ${GUIDE} p. 44 and 45; bs-2026-tariff-einkommenssteuer-uebersicht p. 2 (Steuerjahr 2025 to 2026); bs-2025-law-stg § 36 al. 1 (p. 17), § 37 (p. 17)`,
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
export const INCOME_B_2025: Cited<BracketScale> = {
  source: `${BOOK} p. 6 to 8 (Tarif B, ab Steuerperiode 2025); ${GUIDE} p. 46 and 47; bs-2026-tariff-einkommenssteuer-uebersicht p. 4 (Steuerjahr 2025 to 2026); bs-2025-law-stg § 36 al. 2 (p. 17), § 37 (p. 17)`,
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
export const WEALTH_A_2025: Cited<BracketScale> = {
  source: `${BOOK} p. 9 (Vermögenssteuertarif A); ${GUIDE} p. 48; bs-2025-law-stg § 50 al. 1 (p. 21)`,
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
export const WEALTH_B_2025: Cited<BracketScale> = {
  source: `${BOOK} p. 10 (Vermögenssteuertarif B); ${GUIDE} p. 49; bs-2025-law-stg § 50 al. 2 (p. 21)`,
  value: {
    denominator: 10_000,
    brackets: [
      [400_000, 45],
      [1_200_000, 65],
      [Number.POSITIVE_INFINITY, 79],
    ],
  },
};
