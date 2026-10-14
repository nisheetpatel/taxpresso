// Lucerne tariffs, tax year 2025: the income tariffs of StG § 57 in the text in force in 2025
// (lu-2025-law-steuergesetz, Stand 1 June 2025; § 57 was last changed for 2025 by K 2024 3000,
// the cold progression adjustment), the same as the canton's Tariftabellen 2025 and the 2025
// guide; the canton's Berechnungstabelle 2025 gives the same tax per unit on every one of its
// 20,902 rows (scripts/lu-tariff.mjs --check). The wealth tariff is StG § 60 Abs. 1.
import type { Cited } from '@taxpresso/rules-ch';
import type { UnitTariff, WealthTariff } from '../tariff.js';

const LAW = 'lu-2025-law-steuergesetz';

/** § 57 Abs. 1: single persons (Alleinstehende). Rates in hundredths of a percent. */
export const INCOME_SINGLE_2025: Cited<UnitTariff> = {
  source: `${LAW} § 57 Abs. 1 (p. 30); lu-2025-tariff-tariftabellen-abzuege p. 1 (Alleinstehende); lu-2025-guide-wegleitung p. 58; lu-2025-tariff-berechnungstabelle-einkommen p. 1 to 402`,
  value: {
    steps: [
      [9_900, 0],
      [2_400, 50],
      [3_200, 100],
      [1_100, 200],
      [1_200, 300],
      [2_900, 400],
      [4_300, 450],
      [85_000, 500],
      [53_800, 525],
      [26_200, 550],
      [1_903_000, 580],
    ],
    flatAbove: 2_093_000,
    flatRate: 570,
  },
};

/**
 * § 57 Abs. 2: married couples, and widowed, separated, divorced and single persons who live with
 * children or people in need and mainly bear their upkeep (Familien).
 */
export const INCOME_FAMILY_2025: Cited<UnitTariff> = {
  source: `${LAW} § 57 Abs. 2 (p. 30); lu-2025-tariff-tariftabellen-abzuege p. 1 (Familien); lu-2025-guide-wegleitung p. 59; lu-2025-tariff-berechnungstabelle-einkommen p. 1 to 402`,
  value: {
    steps: [
      [19_900, 0],
      [4_100, 50],
      [1_000, 150],
      [1_200, 250],
      [2_100, 300],
      [4_200, 350],
      [66_500, 450],
      [38_900, 500],
      [21_100, 550],
      [1_265_300, 580],
    ],
    flatAbove: 1_424_300,
    flatRate: 560,
  },
};

/** § 60 Abs. 1: 0,75 per mille of the taxable wealth per unit. */
export const WEALTH_2025: Cited<WealthTariff> = {
  source: `${LAW} § 60 Abs. 1 (p. 32); lu-2025-guide-wegleitung p. 60`,
  value: { rate: 75 },
};
