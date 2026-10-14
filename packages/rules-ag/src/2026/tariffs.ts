// Aargau tariffs and cantonal multiplier, tax year 2026.
// - Income: the Progressionsverordnung 2025 in its version of 1 January 2026 still sets the steps of
//   StG § 43 Abs. 1 in its § 1 (the change of 15 October 2025 repealed § 2 and § 3 lit. a to c only:
//   Änderungstabelle, p. 3), and the canton's index of tariffs lists the 2025 income tariff as the
//   newest, valid from 2025 (ag-na-tariff-steuern-berechnen, Einkommenssteuertarife). The same steps
//   as 2025, and the same tables (scripts/ag-tariff.mjs --check runs them for both years).
// - Wealth: StG § 55 Abs. 1, the law in force (the law collection lists no later version; the
//   Progressionsverordnung's own wealth tariff, § 2, is repealed from 2026); the index lists the 2025
//   wealth tariff as the newest, valid from 2025.
// - The cantonal Steuerfuss: ordentliche Kantonssteuer 100 % + Kantonssteuerzuschlag 3 % (StG
//   § 57a) + Finanzausgleich 0 % = 103 %, the table of cantonal multipliers and the title of the
//   2026 communal list.
// No imports of values: scripts/ag-tariff.mjs and scripts/ag-communes.mjs read this module with
// Node's type stripping.
import type { Cited } from '@taxpresso/rules-ch';
import type { StepTariff } from '../tariff.js';

/** § 43 Abs. 1 as adjusted, the same steps as 2025: percent with one decimal (8,5 % is 85). */
export const INCOME_2026: Cited<StepTariff> = {
  source:
    'ag-2026-tariff-progressionsverordnung § 1 Abs. 1 (p. 1), Änderungstabelle (p. 3); ag-na-tariff-steuern-berechnen (Einkommenssteuertarife Kantons- und Gemeindesteuern: Tarif für die Einkommenssteuer, gültig ab 2025); ag-na-law-steuergesetz § 43 Abs. 1 (p. 28 and 29), § 57 Abs. 1 (p. 34)',
  value: {
    denominator: 1_000,
    steps: [
      [4_300, 0],
      [3_800, 10],
      [3_900, 20],
      [4_200, 30],
      [4_300, 40],
      [5_200, 50],
      [7_400, 60],
      [8_600, 70],
      [9_600, 80],
      [11_800, 85],
      [11_700, 90],
      [35_300, 95],
      [66_300, 100],
      [176_300, 105],
    ],
    above: 110,
  },
};

/** § 55 Abs. 1: per mille with one decimal (0,7 ‰ is 7), the same as 2025. */
export const WEALTH_2026: Cited<StepTariff> = {
  source:
    'ag-na-law-steuergesetz § 55 Abs. 1 (p. 33), § 57 Abs. 5 (p. 34); ag-2026-tariff-progressionsverordnung Änderungstabelle (p. 3: § 2 aufgehoben ab 1. Januar 2026); ag-na-tariff-steuern-berechnen (Vermögenssteuertarif Kantons- und Gemeindesteuern: Tarif für die Vermögenssteuer, gültig ab 2025)',
  value: {
    denominator: 10_000,
    steps: [
      [107_000, 7],
      [107_000, 10],
      [107_000, 12],
      [107_000, 14],
    ],
    above: 16,
  },
};

/** The cantonal Steuerfuss for natural persons in 2026, in percent of the einfache Steuer. */
export const CANTONAL_RATE_2026: Cited<number> = {
  source:
    'ag-2026-communal-kantonssteuerfuss-zinssaetze p. 1 (row 2026: 100 % + 3 % = 103 %, Finanzausgleich 0 %, Kantonssteuer mit FiAusgleich 103 %); ag-2026-communal-steuerfuesse p. 1 (Steuerfuss Kanton 103 %); ag-na-law-steuergesetz § 2 Abs. 2 (p. 2), § 57a (p. 34)',
  value: 103,
};
