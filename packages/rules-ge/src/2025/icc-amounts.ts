// Geneva cantonal and communal tax (ICC), tax year 2025: the surcharges, the splitting shares and
// every deduction amount the engine uses. All money in integer centimes, rates in basis points
// (1 % = 100). Every value is read in the official document cited next to it:
// - ge-2025-icc-tariff-pdf (Barèmes 2025): the surcharges, p. 4 (income) and p. 6 (wealth);
// - ge-2025-guide-declaration-pp (the 2025 guide): the amounts indexed for 2025, p. 11 (summary)
//   and the page of each rubric. LIPP (ge-na-law-lipp) states the rules with their base amounts,
//   which the Conseil d'Etat indexes every year (LIPP art. 67): the guide gives the 2025 figures.
import type { Cited } from './icc.js';
import type { MealAmounts, Pillar3aAmounts } from './ifd.js';

const GUIDE = 'ge-2025-guide-declaration-pp';
const TARIFF = 'ge-2025-icc-tariff-pdf';

/** Rows of a decreasing deduction: [upper bound of the income in CHF, deduction in centimes...]. */
export type DecreasingRow = readonly [number, ...number[]];

export interface IccAmounts {
  incomeCantonalCentimesBp: Cited<number>;
  incomeReductionBp: Cited<number>;
  incomeHomeCareBp: Cited<number>;
  wealthCantonalCentimesBp: Cited<number>;
  wealthHomeCareBp: Cited<number>;
  splittingShare: Cited<{ full: number; partial: number }>;
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  commuteMax: Cited<number>;
  meals: Cited<MealAmounts>;
  twoEarner: Cited<number>;
  pillar3a: Cited<Pillar3aAmounts>;
  healthCap: Cited<{ child: number; young: number; adult: number }>;
  lifeInsurance: Cited<{ single: number; married: number; perCharge: number }>;
  childcareMax: Cited<number>;
  trainingMax: Cited<number>;
  medicalThresholdBp: Cited<number>;
  donationsShareBp: Cited<number>;
  partyMax: Cited<number>;
  debtInterestExtra: Cited<number>;
  familyCharge: Cited<{
    full: number;
    half: number;
    fullWithChildcare: number;
    halfWithChildcare: number;
  }>;
  avsDeduction: Cited<{ couple: readonly DecreasingRow[]; other: readonly DecreasingRow[] }>;
  wealthSocial: Cited<{ single: number; couple: number; perCharge: number }>;
}

export const ICC_2025: IccAmounts = {
  /** Cantonal centimes on the base income tax: 47.5 %. */
  incomeCantonalCentimesBp: { value: 4750, source: `${TARIFF} p. 4` },
  /** The 12 % reduction of the income tax, on the base plus the cantonal centimes. */
  incomeReductionBp: { value: 1200, source: `${TARIFF} p. 4` },
  /** The additional cantonal centime for home care (aide à domicile): 1 % of the base. */
  incomeHomeCareBp: { value: 100, source: `${TARIFF} p. 4` },
  wealthCantonalCentimesBp: { value: 4750, source: `${TARIFF} p. 6` },
  wealthHomeCareBp: { value: 100, source: `${TARIFF} p. 6` },
  /** Rate income as a share of the income, per 10_000: 50 % (full) and 55.56 % (partial). */
  splittingShare: {
    value: { full: 5000, partial: 5556 },
    source: `${TARIFF} p. 2 (LIPP art. 41 al. 2 to 4)`,
  },

  // Employment (annexe A), per person.
  /** 31.50: 3 % of salary after AVS and 2nd-pillar contributions, between 640 and 1,812. */
  professionalFlat: {
    value: { rateBp: 300, min: 64_000, max: 181_200 },
    source: `${GUIDE} p. 11, p. 19 (31.50)`,
  },
  /** 31.70: commuting, whatever the means of transport, at most 534. */
  commuteMax: { value: 53_400, source: `${GUIDE} p. 11, p. 21 (31.70)` },
  /** 31.60: 15 a day, at most 3,200 a year; half when the employer pays part of the meal. */
  meals: {
    value: { perDay: 1_500, perYear: 320_000, halfPerDay: 750, halfPerYear: 160_000 },
    source: `${GUIDE} p. 11, p. 19 (31.60)`,
  },
  /** 31.95: both spouses earn: 1,051 off the lower earned income. */
  twoEarner: { value: 105_100, source: `${GUIDE} p. 11, p. 21 (31.95)` },
  /** 31.40: pillar 3a, 7,258 with a pension fund; without, 20 % of earned income up to 36,288. */
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `${GUIDE} p. 11, p. 18 (31.40)`,
  },

  // Deductions for the household.
  /** 52.21: health premiums, at most twice the cantonal average premium, by age. */
  healthCap: {
    value: { child: 396_500, young: 1_284_200, adult: 1_712_200 },
    source: `${GUIDE} p. 11, p. 29 (52.21)`,
  },
  /**
   * 52.15: life insurance premiums and savings interest. Single 2,345, doubled without 2nd pillar
   * or 3a; spouses 3,518 (2 x 1,759), half as much again when one spouse pays into neither, double
   * when neither does; plus 959 per family charge, half as much again or double in the same cases.
   */
  lifeInsurance: {
    value: { single: 234_500, married: 351_800, perCharge: 95_900 },
    source: `${GUIDE} p. 28 (52.15)`,
  },
  /** 59.10: childcare per child up to the month of the 14th birthday, at most 26,320. */
  childcareMax: { value: 2_632_000, source: `${GUIDE} p. 11, p. 30 (59.10)` },
  /** 59.50: professional training, at most 12,756. */
  trainingMax: { value: 1_275_600, source: `${GUIDE} p. 31 (59.50)` },
  /** 71.00: medical costs, only the part above 0.5 % of the subtotal 92.20. */
  medicalThresholdBp: { value: 50, source: `${GUIDE} p. 14 (71.00)` },
  /** 73.10: donations, up to 20 % of the subtotal 92.40. */
  donationsShareBp: { value: 2000, source: `${GUIDE} p. 15 (73.10)` },
  /** 74.00: political parties, at most 10,000. */
  partyMax: { value: 1_000_000, source: `${GUIDE} p. 11, p. 15 (74.00)` },
  /** Private debt interest, up to the gross income from wealth plus 50,000. */
  debtInterestExtra: { value: 5_000_000, source: `${GUIDE} p. 37` },
  /**
   * 61.25: family charges. 13,660 per charge, 6,830 per half charge; 10,508 and 5,254 when
   * childcare (59.10) is deducted for that child.
   */
  familyCharge: {
    value: {
      full: 1_366_000,
      half: 683_000,
      fullWithChildcare: 1_050_800,
      halfWithChildcare: 525_400,
    },
    source: `${GUIDE} p. 11, p. 15 (61.25)`,
  },
  /**
   * 61.30: AVS/AI pensioners. Table 1 (spouses, or a single person with family charges they mainly
   * support): [up to, one pensioner, two pensioners]. Table 2 (others): [up to, deduction]. The
   * income is the subtotal 92.40; above the last row, no deduction.
   */
  avsDeduction: {
    value: {
      couple: [
        [61_300, 1_066_100, 1_226_000],
        [69_509, 852_900, 980_800],
        [78_464, 639_700, 735_600],
        [87_632, 426_400, 490_400],
        [98_080, 213_200, 245_200],
      ],
      other: [
        [53_304, 1_066_100],
        [60_447, 852_900],
        [68_229, 639_700],
        [76_225, 426_400],
        [85_287, 213_200],
      ],
    },
    source: `${GUIDE} p. 16 (61.30)`,
  },

  // Wealth.
  /**
   * 51.50: social deduction on wealth. Single 87,632; spouses, or a single person living with
   * their minor children who are family charges, 175,264; plus 43,816 per family charge (less the
   * own wealth of an adult child).
   */
  wealthSocial: {
    value: { single: 8_763_200, couple: 17_526_400, perCharge: 4_381_600 },
    source: `${GUIDE} p. 16 (51.50)`,
  },
};
