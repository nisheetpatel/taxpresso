// Aargau tariffs and cantonal multiplier, tax year 2025.
// - Income: StG § 43 Abs. 1 (ag-na-law-steuergesetz) with the amounts adjusted for inflation by the
//   Progressionsverordnung 2025 § 1 (in force from 1 January 2025, § 1 unchanged since its first
//   version: its Änderungstabelle, ag-2026-tariff-progressionsverordnung p. 3); the canton's tariff
//   (ag-2025-tariff-einkommenssteuer p. 1) prints the same steps, and its Tarif A and Tarif B tables
//   (p. 2 to 70) give exactly what packages/rules-ag/src/tariff.ts computes on every row
//   (scripts/ag-tariff.mjs --check).
// - Wealth: StG § 55 Abs. 1 in the version in force from 2025 (decision of 3 December 2024); the
//   canton's wealth tariff (ag-2025-tariff-vermoegenssteuer p. 1, table p. 3 to 37) prints the same.
// - The cantonal Steuerfuss: ordentliche Kantonssteuer 108 % + Kantonssteuerzuschlag 3 % (StG
//   § 57a) + Finanzausgleich 0 % = 111 %, the table of cantonal multipliers and the title of the
//   2025 communal list.
// No imports of values: scripts/ag-tariff.mjs and scripts/ag-communes.mjs read this module with
// Node's type stripping.
import type { Cited } from '@taxpresso/rules-ch';
import type { StepTariff } from '../tariff.js';

/** § 43 Abs. 1 as adjusted for 2025: percent with one decimal (8,5 % is 85). */
export const INCOME_2025: Cited<StepTariff> = {
  source:
    'ag-2026-tariff-progressionsverordnung § 1 Abs. 1 (p. 1), Änderungstabelle (p. 3); ag-2025-tariff-einkommenssteuer p. 1 (1. Steuertarif); ag-na-law-steuergesetz § 43 Abs. 1 (p. 28 and 29), § 57 Abs. 1 (p. 34)',
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

/** § 55 Abs. 1: per mille with one decimal (0,7 ‰ is 7). */
export const WEALTH_2025: Cited<StepTariff> = {
  source:
    'ag-na-law-steuergesetz § 55 Abs. 1 (p. 33); ag-2025-tariff-vermoegenssteuer p. 1 (1. Steuertarif)',
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

/** The cantonal Steuerfuss for natural persons in 2025, in percent of the einfache Steuer. */
export const CANTONAL_RATE_2025: Cited<number> = {
  source:
    'ag-2026-communal-kantonssteuerfuss-zinssaetze p. 1 (row 2025: 108 % + 3 % = 111 %, Finanzausgleich 0 %, Kantonssteuer mit FiAusgleich 111 %); ag-2025-communal-steuerfuesse p. 1 (Steuerfuss Kanton 111 %); ag-na-law-steuergesetz § 2 Abs. 2 (p. 2), § 57a (p. 34)',
  value: 111,
};
