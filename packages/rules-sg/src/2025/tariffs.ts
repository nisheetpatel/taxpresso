// St. Gallen's tariffs and the cantonal multiplier, tax year 2025.
// - Income: StG Art. 50 Abs. 1 and 2 (sg-2025-law-steuergesetz, Stand 1 January 2025, the version in
//   force from 1 January to 31 December 2025); the tariff of the year (sg-2025-tariff-einkommen-
//   vermoegen) prints the same thresholds on p. 1 and the einfache Steuer for every 100 francs
//   from p. 2 to p. 105. scripts/sg-tariff.mjs --check compares the brackets with every row.
// - Wealth: StG Art. 65, the same in the tariff (p. 1).
// - The cantonal multiplier (Kantonssteuerfuss): the Steuerbuch's list of the yearly multipliers set
//   by the Kantonsrat with the budget (StG Art. 6 Abs. 2 lit. a), and the table of communal
//   multipliers of the year, which states it in its remarks.
// No imports of values: scripts/sg-tariff.mjs reads this module with Node's type stripping.
import type { Cited } from '@taxpresso/rules-ch';
import type { IncomeTariff, WealthTariff } from '../tariff.js';

/** The einfache Steuer on income: brackets in CHF with their rates in tenths of a percent. */
export const INCOME_2025: Cited<IncomeTariff> = {
  source:
    'sg-2025-law-steuergesetz Art. 50 Abs. 1 lit. a to f and Abs. 2 (p. 26); sg-2025-tariff-einkommen-vermoegen p. 1 (Fr. 264’200 for single taxpayers, Fr. 528’400 with Vollsplitting, 8.5 Prozent; die Rappen sind kaufmännisch gerundet)',
  value: {
    brackets: [
      [11_600, 0],
      [4_200, 40],
      [18_000, 60],
      [26_400, 80],
      [38_100, 92],
      [165_900, 94],
    ],
    topFrom: 264_200,
    topRate: 85,
  },
};

/** The einfache Steuer on wealth: 1.7 per mille, remainders under CHF 1,000 dropped. */
export const WEALTH_2025: Cited<WealthTariff> = {
  source:
    'sg-2025-law-steuergesetz Art. 65 Abs. 1 and 2 (p. 30); sg-2025-tariff-einkommen-vermoegen p. 1 (Vermögenssteuer: 1.7 Promille)',
  value: { rate: 17, step: 1_000 },
};

/** The cantonal multiplier (Kantonssteuerfuss), in hundredths of a percent of the einfache Steuer. */
export const MULTIPLIER_2025: Cited<number> = {
  source:
    'sg-2026-tariff-kantonssteuerfuss p. 1 (StB 6 Nr. 1: 2025, 105 Prozent); sg-2025-communal-steuerfuesse p. 1 (Die Kantonssteuer beträgt 105 Prozent); sg-2025-law-steuergesetz Art. 6 Abs. 2 lit. a (p. 2)',
  value: 10_500,
};
