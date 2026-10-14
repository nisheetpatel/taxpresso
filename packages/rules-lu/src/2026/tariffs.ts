// Lucerne tariffs, tax year 2026: the income tariffs of StG § 57 in the text in force from
// 1 January 2026 (lu-2026-law-steuergesetz, Stand 1 January 2026; the steps adjusted for cold
// progression), the same as the canton's Tariftabellen 2026 and the 2026 guide (edition for a tax
// liability ending during the year, the regular one not being published); the canton's
// Berechnungstabelle 2026 gives the same tax per unit on every one of its 20,902 rows
// (scripts/lu-tariff.mjs --check). The wealth tariff is StG § 60 Abs. 1.
import type { Cited } from '@taxpresso/rules-ch';
import type { UnitTariff, WealthTariff } from '../tariff.js';

const LAW = 'lu-2026-law-steuergesetz';

/** § 57 Abs. 1: single persons (Alleinstehende). Rates in hundredths of a percent. */
export const INCOME_SINGLE_2026: Cited<UnitTariff> = {
  source: `${LAW} § 57 Abs. 1 (p. 30); lu-2026-tariff-tariftabellen-abzuege p. 1 (Alleinstehende); lu-2026-guide-wegleitung-unterjaehrig p. 58; lu-2026-tariff-berechnungstabelle-einkommen p. 1 to 402`,
  value: {
    steps: [
      [9_900, 0],
      [2_400, 50],
      [3_200, 100],
      [1_200, 200],
      [1_200, 300],
      [2_900, 400],
      [4_300, 450],
      [85_000, 500],
      [53_800, 525],
      [26_200, 550],
      [1_906_700, 580],
    ],
    flatAbove: 2_096_800,
    flatRate: 570,
  },
};

/**
 * § 57 Abs. 2: married couples, and widowed, separated, divorced and single persons who live with
 * children or people in need and mainly bear their upkeep (Familien).
 */
export const INCOME_FAMILY_2026: Cited<UnitTariff> = {
  source: `${LAW} § 57 Abs. 2 (p. 30); lu-2026-tariff-tariftabellen-abzuege p. 1 (Familien); lu-2026-guide-wegleitung-unterjaehrig p. 59; lu-2026-tariff-berechnungstabelle-einkommen p. 1 to 402`,
  value: {
    steps: [
      [19_900, 0],
      [4_100, 50],
      [1_000, 150],
      [1_200, 250],
      [2_100, 300],
      [4_200, 350],
      [66_700, 450],
      [38_900, 500],
      [21_100, 550],
      [1_266_300, 580],
    ],
    flatAbove: 1_425_500,
    flatRate: 560,
  },
};

/** § 60 Abs. 1: 0,75 per mille of the taxable wealth per unit. */
export const WEALTH_2026: Cited<WealthTariff> = {
  source: `${LAW} § 60 Abs. 1 (p. 32); lu-2026-guide-wegleitung-unterjaehrig p. 60`,
  value: { rate: 75 },
};
