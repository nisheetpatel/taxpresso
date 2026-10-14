// Geneva wealth tax (impôt sur la fortune), tax year 2025. All money in integer centimes.
// Source: ge-2025-icc-tariff-pdf (Barèmes 2025), p. 5 (the two scales) and p. 6 (worked example
// and the surcharges), repeated in ge-2025-guide-declaration-pp p. 49 and 50. The law: LIPP
// art. 59 (ge-na-law-lipp): al. 1 the scale, the same for a single person and for spouses living
// together (no splitting on wealth); al. 2 the supplementary tax, on which no centime additionnel
// is levied.
import type { Cited } from '@taxpresso/rules-ch';
import type { BracketScale } from '../engine/param.js';

/** Base wealth tax (impôt de base sur la fortune), rates in 1/100_000 (1.49 per mille = 149). */
export const ICC_2025_WEALTH_SCALE: Cited<BracketScale> = {
  source: 'ge-2025-icc-tariff-pdf p. 5',
  value: {
    denominator: 100_000,
    brackets: [
      [118_398, 149],
      [236_795, 191],
      [355_193, 234],
      [473_591, 255],
      [710_387, 276],
      [947_182, 298],
      [1_183_977, 319],
      [1_420_773, 340],
      [1_775_966, 361],
      [Number.POSITIVE_INFINITY, 383],
    ],
  },
};

/**
 * Supplementary wealth tax (impôt supplémentaire sur la fortune), rates in 1/10_000_000
 * (0.0956 per mille = 956). No cantonal or communal centimes on it: LIPP art. 59 al. 2.
 */
export const ICC_2025_WEALTH_SUPPLEMENTARY_SCALE: Cited<BracketScale> = {
  source: 'ge-2025-icc-tariff-pdf p. 5; ge-na-law-lipp art. 59 al. 2',
  value: {
    denominator: 10_000_000,
    brackets: [
      [118_398, 0],
      [236_795, 956],
      [355_193, 1169],
      [473_591, 2550],
      [710_387, 2763],
      [947_182, 4463],
      [1_183_977, 4781],
      [1_420_773, 6800],
      [1_775_966, 7225],
      [3_551_932, 9563],
      [Number.POSITIVE_INFINITY, 11_475],
    ],
  },
};
