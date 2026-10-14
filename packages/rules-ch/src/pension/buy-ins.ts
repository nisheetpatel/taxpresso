// "Before 31 December" for tax year 2026, beyond the pillar 3a room (./pillar3a.ts): pension fund
// buy-ins (rachat LPP) and the new pillar 3a catch-up payments (rachat 3a). SPEC.md section 8,
// group B. The same federal limits apply to the cantonal tax: LIPP art. 31 let. b and c deduct
// these payments "au sens et dans les limites du droit fédéral" (ge-na-law-lipp art. 31).
import type { Cited } from '../core/cited.js';

/** Where each statement about pension fund buy-ins is written. */
export const LPP_BUYIN_FACTS = {
  /** The fund accepts buy-ins only up to its regulatory benefits: the amount it states. */
  capacityFromFund: 'ch-na-law-lpp p. 65 (art. 79b al. 1)',
  threeYearRule: 'ch-na-law-lpp p. 66 (art. 79b al. 3); ge-2025-guide-declaration-pp p. 18',
  /** A home-ownership withdrawal (EPL) must be paid back before a voluntary buy-in. */
  homeWithdrawalFirst: 'ch-na-law-lpp p. 66 (art. 79b al. 3)',
  paidInYear: 'ge-2025-guide-declaration-pp p. 18',
  deductible: 'ch-na-law-lifd p. 25 (art. 33 al. 1 let. d); ge-na-law-lipp art. 31 let. b',
  /** Form 21EDP and the rubric codes 31.30 (you) and 41.30 (spouse). */
  attestation: 'ge-2025-guide-declaration-pp p. 10, p. 18',
} as const;

/** Pillar 3a limits for 2025, the first year whose gaps can be made up. */
export const PILLAR3A_2025: Cited<{
  capWithPensionFund: number;
  capWithoutPensionFund: number;
  shareWithoutPensionFundBp: number;
}> = {
  source: 'ch-2025-ifd-instructions-personnes-physiques p. 7 (chiffre 13)',
  value: {
    capWithPensionFund: 725_800,
    capWithoutPensionFund: 3_628_800,
    shareWithoutPensionFundBp: 2000,
  },
};

/**
 * Pillar 3a catch-up in 2026: at most this much in the year of the catch-up (8 % of the LPP upper
 * limit, the "small" 3a limit), only for gaps from 2025 on, within the last ten years.
 */
export const PILLAR3A_CATCHUP_2026: Cited<{
  capInYear: number;
  firstGapYear: number;
  lookbackYears: number;
}> = {
  source:
    'ch-2026-ifd-instructions-personnes-physiques p. 8; ch-na-law-opp3 p. 7 (art. 7a al. 2), p. 9 (disposition transitoire)',
  value: { capInYear: 725_800, firstGapYear: 2025, lookbackYears: 10 },
};

/** Where each condition of the 3a catch-up is written. */
export const PILLAR3A_CATCHUP_FACTS = {
  /** Allowed to pay into 3a in the gap year (AVS-subject earned income) and didn't pay the maximum. */
  gapYearConditions: 'ch-na-law-opp3 p. 6, p. 7 (art. 7a al. 1 let. a, b)',
  /** The full ordinary 3a payment of the catch-up year comes first. */
  fullCurrentYearFirst:
    'ch-na-law-opp3 p. 7 (art. 7a al. 1 let. c); ch-2026-ifd-instructions-personnes-physiques p. 8',
  oneCatchUpPerGap: 'ch-na-law-opp3 p. 7 (art. 7a al. 3)',
  noOldAgeBenefit: 'ch-na-law-opp3 p. 7 (art. 7a al. 4)',
  writtenRequest: 'ch-na-law-opp3 p. 7 (art. 7b)',
  onlyGapsFrom2025: 'ch-na-law-opp3 p. 9 (disposition transitoire du 6 novembre 2024)',
  cantonalToo: 'ge-na-law-lipp art. 31 let. c',
} as const;
