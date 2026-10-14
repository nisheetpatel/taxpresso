// Pillar 3a for tax year 2026. Source: ch-2026-ifd-instructions-personnes-physiques (Form. 2a,
// période fiscale 2026). The same limits apply to the cantonal tax (federal harmonization).
import type { Cited } from '@taxpresso/rules-ch';

export const PILLAR3A_2026: Cited<{
  /** With a pension fund (2nd pillar). */
  capWithPensionFund: number;
  /** Without a pension fund: 20 % of earned income, at most this. */
  capWithoutPensionFund: number;
  shareWithoutPensionFundBp: number;
}> = {
  source: 'ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)',
  value: {
    capWithPensionFund: 725_800,
    capWithoutPensionFund: 3_628_800,
    shareWithoutPensionFundBp: 2000,
  },
};

/** Facts the 3a card states, each with where it is written. */
export const PILLAR3A_2026_FACTS = {
  paidInYearOnly: 'ch-2026-ifd-instructions-personnes-physiques p. 7',
  payoutsTaxable: 'ch-2026-ifd-instructions-personnes-physiques p. 3',
  catchUpFrom2026: 'ch-2026-ifd-instructions-personnes-physiques p. 8',
} as const;
