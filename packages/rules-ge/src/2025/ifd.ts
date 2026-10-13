// Federal direct tax (IFD), tax year 2025. All money in integer centimes.
// Sources:
// - ch-2025-ifd-frais-professionnels-progression (ESTV circular of 22 August 2024): p. 1 the
//   commuting cap (point 1.1), p. 2 the deductions of art. 33 and 35 LIFD and the tax reduction per
//   child, p. 3 the scales of art. 36 LIFD for 2025;
// - ch-2025-ifd-tarif-personnes-physiques (Form. 58c 2025): footnote 1 (fractions under CHF 100
//   dropped) and footnote 2 (tax rounded down to 5 centimes);
// - ge-2025-guide-declaration-pp: the flat amounts the circular leaves unchanged (p. 11, p. 19);
// - ch-na-law-lifd: the rules (art. 26, 33, 33a, 35, 36).
import type { Cited } from './icc.js';
import type { FederalStep } from '../engine/param.js';

const CIRCULAR = 'ch-2025-ifd-frais-professionnels-progression';
const GUIDE = 'ge-2025-guide-declaration-pp';

export const IFD_2025_SINGLE: Cited<readonly FederalStep[]> = {
  source: `${CIRCULAR} p. 3 (art. 36 al. 1)`,
  value: [
    [15_200, 0, 77],
    [33_200, 13_860, 88],
    [43_500, 22_920, 264],
    [58_000, 61_200, 297],
    [76_100, 114_955, 594],
    [82_000, 150_000, 660],
    [108_800, 326_880, 880],
    [141_500, 614_640, 1100],
    [184_900, 1_092_040, 1320],
    [793_400, 9_124_100, 1150],
  ],
};

/** Married couples living together; also single parents (barème parental, art. 36 al. 2bis). */
export const IFD_2025_MARRIED: Cited<readonly FederalStep[]> = {
  source: `${CIRCULAR} p. 3 (art. 36 al. 2)`,
  value: [
    [29_700, 0, 100],
    [53_400, 23_700, 200],
    [61_300, 39_500, 300],
    [79_100, 92_900, 400],
    [94_900, 156_100, 500],
    [108_600, 224_600, 600],
    [120_500, 296_000, 700],
    [130_500, 366_000, 800],
    [138_300, 428_400, 900],
    [144_200, 481_500, 1000],
    [148_200, 521_500, 1100],
    [150_300, 544_600, 1200],
    [152_300, 568_600, 1300],
    [940_900, 10_820_350, 1150],
  ],
};

export interface MealAmounts {
  perDay: number;
  perYear: number;
  halfPerDay: number;
  halfPerYear: number;
}

export interface Pillar3aAmounts {
  withFund: number;
  withoutFundMax: number;
  withoutFundShareBp: number;
}

export interface IfdAmounts {
  childTaxReduction: Cited<number>;
  minimumCollected: Cited<number>;
  rounding: Cited<{ incomeStep: number; taxStep: number }>;
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  commuteMax: Cited<number>;
  /** 31.71: bike, e-bike or moped with a yellow plate, a flat amount a year. */
  commuteBike: Cited<number>;
  /** 31.71: car or motorbike (white plate) without usable public transport, centimes per km. */
  commuteKm: Cited<{ car: number; motorbike: number }>;
  meals: Cited<MealAmounts>;
  twoEarner: Cited<{ shareBp: number; min: number; max: number }>;
  pillar3a: Cited<Pillar3aAmounts>;
  insurance: Cited<{
    married: number;
    marriedNone: number;
    other: number;
    otherNone: number;
    perChild: number;
  }>;
  childcareMax: Cited<number>;
  trainingMax: Cited<number>;
  partyMax: Cited<number>;
  donations: Cited<{ shareBp: number; min: number }>;
  medicalThresholdBp: Cited<number>;
  debtInterestExtra: Cited<number>;
  child: Cited<number>;
  married: Cited<number>;
}

export const IFD_2025: IfdAmounts = {
  /** Tax reduction per child on the married and parental scale (art. 36 al. 2bis). */
  childTaxReduction: { value: 26_300, source: `${CIRCULAR} p. 2 (art. 36 al. 2bis)` },
  /** Amounts under CHF 25 are not collected (art. 36 al. 3). */
  minimumCollected: { value: 2_500, source: `${CIRCULAR} p. 3 (art. 36 al. 3)` },
  /** Fractions under CHF 100 dropped; the tax rounded down to 5 centimes. */
  rounding: {
    value: { incomeStep: 10_000, taxStep: 5 },
    source: 'ch-2025-ifd-tarif-personnes-physiques p. 1 (notes 1 and 2)',
  },
  /** 31.20: other professional costs, 3 % of net salary, between 2,000 and 4,000. */
  professionalFlat: {
    value: { rateBp: 300, min: 200_000, max: 400_000 },
    source: `${GUIDE} p. 11, p. 19 (31.20); ${CIRCULAR} p. 1 (point 1.1)`,
  },
  /** 31.71: commuting, at most 3,300. */
  commuteMax: {
    value: 330_000,
    source: `${CIRCULAR} p. 1 (point 1.1); ch-na-law-lifd art. 26 al. 1 let. a (p. 21)`,
  },
  /** 31.71: bike, e-bike or moped with a yellow plate, 700 a year. */
  commuteBike: {
    value: 70_000,
    source: `${GUIDE} p. 20 (31.71); ch-2026-ifd-progression-deductions p. 1 (2025 column)`,
  },
  /** 31.71: no usable public transport: motorbike 0.40, car 0.70 per km. */
  commuteKm: {
    value: { car: 70, motorbike: 40 },
    source: `${GUIDE} p. 20 (31.71); ch-2026-ifd-progression-deductions p. 1 (2025 column)`,
  },
  /** 31.60: 15 a day, at most 3,200; half (7.50, 1,600) with a canteen or meal vouchers. */
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${GUIDE} p. 11, p. 19 (31.60)`,
  },
  /** 31.90: two earners, 50 % of the lower earned income, at least 8,600, at most 14,100. */
  twoEarner: {
    value: { shareBp: 5000, min: 860_000, max: 1_410_000 },
    source: `${CIRCULAR} p. 2 (art. 33 al. 2)`,
  },
  /** 31.40: pillar 3a, the same federal limits as for the cantonal tax. */
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `${GUIDE} p. 11, p. 18 (31.40)`,
  },
  /**
   * 52.00: insurance premiums and savings interest. Spouses 3,700 (5,550 when neither pays into the
   * 2nd pillar or 3a); others 1,800 (2,700); plus 700 per child.
   */
  insurance: {
    value: {
      married: 370_000,
      marriedNone: 555_000,
      other: 180_000,
      otherNone: 270_000,
      perChild: 70_000,
    },
    source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. g, al. 1bis)`,
  },
  /** 59.12: childcare per child under 14, at most 25,800. */
  childcareMax: { value: 2_580_000, source: `${CIRCULAR} p. 2 (art. 33 al. 3)` },
  /** 59.50: professional training, at most 13,000. */
  trainingMax: { value: 1_300_000, source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. j)` },
  /** 74.00: political parties, at most 10,600. */
  partyMax: { value: 1_060_000, source: `${CIRCULAR} p. 2 (art. 33 al. 1 let. i)` },
  /** 73.20: donations, up to 20 % of the subtotal 92.40, if they reach 100 in the year. */
  donations: {
    value: { shareBp: 2000, min: 10_000 },
    source: `ch-na-law-lifd art. 33a (p. 27); ${GUIDE} p. 15 (73.20)`,
  },
  /** 71.00: medical costs above 5 % of the subtotal 92.20. */
  medicalThresholdBp: {
    value: 500,
    source: `ch-na-law-lifd art. 33 al. 1 let. h (p. 26); ${GUIDE} p. 14 (71.00)`,
  },
  /** Private debt interest, up to the income from wealth plus 50,000. */
  debtInterestExtra: { value: 5_000_000, source: 'ch-na-law-lifd art. 33 al. 1 let. a (p. 25)' },
  /** 61.20: 6,800 per child (half each in shared custody without alimony). */
  child: {
    value: 680_000,
    source: `${CIRCULAR} p. 2 (art. 35 al. 1 let. a); ${GUIDE} p. 15 (61.20)`,
  },
  /** 59.20: married couples living together, 2,800. */
  married: {
    value: 280_000,
    source: `${CIRCULAR} p. 2 (art. 35 al. 1 let. c); ${GUIDE} p. 31 (59.20)`,
  },
};
