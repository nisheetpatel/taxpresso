// St. Gallen's tariffs and the cantonal multiplier, tax year 2026.
// - Income: StG Art. 50 Abs. 1 and 2 (sg-2026-law-steuergesetz, Stand 1 January 2026: lit. d, lit. f
//   and Abs. 2 changed by the Nachtrag 2025-044, in force from 1 January 2026); the tariff of the
//   year (sg-2026-tariff-einkommen-vermoegen) prints the same thresholds on p. 1 and the einfache
//   Steuer for every 100 francs from p. 2 to p. 105. scripts/sg-tariff.mjs --check compares the
//   brackets with every row.
// - Wealth: StG Art. 65, the same in the tariff (p. 1).
// - The cantonal multiplier: the Steuerbuch's list (Stand 1 January 2026) and the table of communal
//   multipliers of the year.
// No imports of values: scripts/sg-tariff.mjs reads this module with Node's type stripping.
import type { Cited } from '@taxpresso/rules-ch';
import type { IncomeTariff, WealthTariff } from '../tariff.js';

/** The einfache Steuer on income: brackets in CHF with their rates in tenths of a percent. */
export const INCOME_2026: Cited<IncomeTariff> = {
  source:
    'sg-2026-law-steuergesetz Art. 50 Abs. 1 lit. a to f and Abs. 2 (p. 26); sg-2026-tariff-einkommen-vermoegen p. 1 (Fr. 264’500 for single taxpayers, Fr. 529’000 with Vollsplitting, 8.5 Prozent; die Rappen sind kaufmännisch gerundet)',
  value: {
    brackets: [
      [11_600, 0],
      [4_200, 40],
      [18_000, 60],
      [26_500, 80],
      [38_100, 92],
      [166_100, 94],
    ],
    topFrom: 264_500,
    topRate: 85,
  },
};

/** The einfache Steuer on wealth: 1.7 per mille, remainders under CHF 1,000 dropped. */
export const WEALTH_2026: Cited<WealthTariff> = {
  source:
    'sg-2026-law-steuergesetz Art. 65 Abs. 1 and 2 (p. 30); sg-2026-tariff-einkommen-vermoegen p. 1 (Vermögenssteuer: 1.7 Promille)',
  value: { rate: 17, step: 1_000 },
};

/** The cantonal multiplier (Kantonssteuerfuss), in hundredths of a percent of the einfache Steuer. */
export const MULTIPLIER_2026: Cited<number> = {
  source:
    'sg-2026-tariff-kantonssteuerfuss p. 1 (StB 6 Nr. 1, Stand 01.01.2026: 2026, 105 Prozent); sg-2026-communal-steuerfuesse p. 1 (Die Kantonssteuer beträgt 105 Prozent); sg-2026-law-steuergesetz Art. 6 Abs. 2 lit. a (p. 2)',
  value: 10_500,
};
