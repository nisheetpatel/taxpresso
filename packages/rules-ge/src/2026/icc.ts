// Geneva cantonal and communal tax (ICC), tax year 2026: the scales, the surcharges and every
// deduction amount the engine uses. All money in integer centimes, rates in basis points.
//
// Geneva's own amounts and scales for a tax year are indexed by the Conseil d'Etat in a regulation
// adopted the autumn before (LIPP art. 67 al. 5): for 2026, ge-2026-rcepf (RCEPF of 8 October
// 2025, in force 1 January 2026, index 110.0). Every indexed value below is read in it, with its
// article. What the law itself fixes is cited from the law: the cantonal centimes (ge-na-law-lcacant),
// the 12 % reduction (ge-na-law-ldirpp), the splitting and the amounts LIPP does not index
// (ge-na-law-lipp). Pillar 3a follows federal law (LIPP art. 31 let. c).
//
// Two amounts are neither in the regulation nor in a law, and come with the 2026 guide (January
// 2027): the ceiling for health insurance premiums (twice the cantonal average premium of the
// year, LIPP art. 32 let. a) and the meal amounts. ../engine/params.ts keeps the 2025 ones for
// them, flagged as estimates.
// Only type imports here: the website reads this module with Node's type stripping
// (site/src/geneva-data.ts).
import type { Cited } from '@taxpresso/rules-ch';
import type { BracketScale } from '../engine/param.js';
import type { IccAmounts } from '../2025/icc-amounts.js';

const RCEPF = 'ge-2026-rcepf';
const LIPP = 'ge-na-law-lipp';

/** Income scale 2026: [upper bound of the bracket in CHF, rate in hundredths of a percent]. */
export const ICC_2026_INCOME_SCALE: Cited<BracketScale> = {
  source: `${RCEPF} art. 17`,
  value: {
    denominator: 10_000,
    brackets: [
      [18_700, 0],
      [22_530, 730],
      [24_784, 820],
      [27_036, 910],
      [29_290, 1000],
      [34_922, 1090],
      [39_428, 1130],
      [43_935, 1230],
      [48_441, 1280],
      [77_730, 1320],
      [127_297, 1420],
      [171_231, 1500],
      [193_762, 1560],
      [277_125, 1580],
      [295_150, 1600],
      [415_688, 1680],
      [651_131, 1760],
      [Number.POSITIVE_INFINITY, 1800],
    ],
  },
};

/** Base wealth tax 2026, rates in 1/100_000 (1.49 per mille = 149). */
export const ICC_2026_WEALTH_SCALE: Cited<BracketScale> = {
  source: `${RCEPF} art. 18 al. 1`,
  value: {
    denominator: 100_000,
    brackets: [
      [118_722, 149],
      [237_443, 191],
      [356_165, 234],
      [474_886, 255],
      [712_330, 276],
      [949_772, 298],
      [1_187_215, 319],
      [1_424_658, 340],
      [1_780_823, 361],
      [Number.POSITIVE_INFINITY, 383],
    ],
  },
};

/**
 * Supplementary wealth tax 2026, rates in 1/10_000_000 (0.0956 per mille = 956). No cantonal or
 * communal centimes on it: LIPP art. 59 al. 2.
 */
export const ICC_2026_WEALTH_SUPPLEMENTARY_SCALE: Cited<BracketScale> = {
  source: `${RCEPF} art. 18 al. 2; ${LIPP} art. 59 al. 2`,
  value: {
    denominator: 10_000_000,
    brackets: [
      [118_722, 0],
      [237_443, 956],
      [356_165, 1169],
      [474_886, 2550],
      [712_330, 2763],
      [949_772, 4463],
      [1_187_215, 4781],
      [1_424_658, 6800],
      [1_780_823, 7225],
      [3_561_646, 9563],
      [Number.POSITIVE_INFINITY, 11_475],
    ],
  },
};

/**
 * The 2026 amounts published in the regulation or fixed by a law. `healthCap` and `meals` are not
 * among them: see the note at the top.
 */
export const ICC_2026: Omit<IccAmounts, 'healthCap' | 'meals'> = {
  /** Cantonal centimes on the base income tax: 47.5 %. */
  incomeCantonalCentimesBp: { value: 4750, source: 'ge-na-law-lcacant art. 2 al. 1' },
  /** The 12 % reduction of the income tax, the communal centimes excepted. */
  incomeReductionBp: { value: 1200, source: 'ge-na-law-ldirpp art. 1' },
  /** The additional cantonal centime for home care (aide à domicile): 1 % of the base. */
  incomeHomeCareBp: { value: 100, source: 'ge-na-law-lcacant art. 2 al. 2' },
  wealthCantonalCentimesBp: { value: 4750, source: 'ge-na-law-lcacant art. 2 al. 1' },
  wealthHomeCareBp: { value: 100, source: 'ge-na-law-lcacant art. 2 al. 2' },
  /** Rate income as a share of the income, per 10_000: 50 % (full) and 55.56 % (partial). */
  splittingShare: {
    value: { full: 5000, partial: 5556 },
    source: `${LIPP} art. 41 al. 2 to 4`,
  },

  // Employment (annexe A), per person.
  /** 31.50: 3 % of salary after AVS and 2nd-pillar contributions, between 641 and 1,817. */
  professionalFlat: {
    value: { rateBp: 300, min: 64_100, max: 181_700 },
    source: `${RCEPF} art. 6 al. 2; ${LIPP} art. 29 al. 2`,
  },
  /** 31.70: commuting, whatever the means of transport, at most 536. */
  commuteMax: { value: 53_600, source: `${RCEPF} art. 6 al. 1` },
  /** 31.95: both spouses earn: 1,054 off the lower earned income. */
  twoEarner: { value: 105_400, source: `${RCEPF} art. 10` },
  /** 31.40: pillar 3a, within the limits of federal law: 7,258, or 20 % up to 36,288. */
  pillar3a: {
    value: { withFund: 725_800, withoutFundMax: 3_628_800, withoutFundShareBp: 2000 },
    source: `${LIPP} art. 31 let. c; ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)`,
  },

  // Deductions for the household.
  /**
   * 52.15: life insurance premiums and savings interest. Single 2,352, doubled without 2nd pillar
   * or 3a; spouses 3,528, half as much again when one spouse pays into neither, double when
   * neither does; plus 962 per family charge, half as much again (1,443) or double in the same cases.
   */
  lifeInsurance: {
    value: { single: 235_200, married: 352_800, perCharge: 96_200 },
    source: `${RCEPF} art. 8`,
  },
  /** 59.10: childcare per child up to the month of the 14th birthday, at most 26,392. */
  childcareMax: { value: 2_639_200, source: `${RCEPF} art. 9` },
  /** 59.50: professional training, at most 12,791. */
  trainingMax: { value: 1_279_100, source: `${RCEPF} art. 12` },
  /** 71.00: medical costs, only the part above 0.5 % of the subtotal 92.20. */
  medicalThresholdBp: { value: 50, source: `${LIPP} art. 32 let. b` },
  /** 73.10: donations, up to 20 % of the subtotal 92.40. */
  donationsShareBp: { value: 2000, source: `${LIPP} art. 37 al. 1` },
  /** 74.00: political parties, at most 10,000 (not indexed). */
  partyMax: { value: 1_000_000, source: `${LIPP} art. 37 al. 2` },
  /** Private debt interest, up to the gross income from wealth plus 50,000 (not indexed). */
  debtInterestExtra: { value: 5_000_000, source: `${LIPP} art. 34 let. a` },
  /**
   * 61.25: family charges. 13,698 per charge, 6,849 per half charge; 10,536 and 5,268 when
   * childcare (59.10) is deducted for that child.
   */
  familyCharge: {
    value: {
      full: 1_369_800,
      half: 684_900,
      fullWithChildcare: 1_053_600,
      halfWithChildcare: 526_800,
    },
    source: `${RCEPF} art. 13 al. 1`,
  },
  /**
   * 61.30: AVS/AI pensioners. Table 1 (spouses, or a single person with family charges they mainly
   * support): [up to, one pensioner, two pensioners]. Table 2 (others): [up to, deduction]. Above
   * the last row, no deduction.
   */
  avsDeduction: {
    value: {
      couple: [
        [61_467, 1_069_000, 1_229_300],
        [69_699, 855_200, 983_500],
        [78_678, 641_400, 737_600],
        [87_872, 427_600, 491_700],
        [98_348, 213_800, 245_900],
      ],
      other: [
        [53_450, 1_069_000],
        [60_612, 855_200],
        [68_416, 641_400],
        [76_433, 427_600],
        [85_520, 213_800],
      ],
    },
    source: `${RCEPF} art. 14`,
  },

  // Wealth.
  /**
   * 51.50: social deduction on wealth. Single 87,872; spouses, or a single person living with
   * their minor children who are family charges, 175,743; plus 43,936 per family charge.
   */
  wealthSocial: {
    value: { single: 8_787_200, couple: 17_574_300, perCharge: 4_393_600 },
    source: `${RCEPF} art. 16 al. 1`,
  },
  /** 51.60: half the business wealth invested by a self-employed person, at most 534,500. */
  businessWealth: {
    value: { shareBp: 5000, max: 53_450_000 },
    source: `${RCEPF} art. 16 al. 2; ${LIPP} art. 58 al. 2`,
  },

  // Property (annexe D): the law's rates and the AFC's pages, which are not tied to a year.
  /**
   * The flat upkeep deduction for one's own home, instead of the actual costs: 15 % of the rental
   * value when the building is 10 years old or less at the start of the tax period, 25 % when older.
   */
  ownHomeUpkeepFlat: {
    value: { youngBp: 1500, oldBp: 2500 },
    source: `${LIPP} art. 34 let. d`,
  },
  /** A home abroad in a country with no rental value like Switzerland's: 4.5 % of its tax value. */
  abroadRentalValueBp: {
    value: 450,
    source:
      'ge-na-revenu-immobilier-page (Bien situé dans un autre pays qui n’a pas d’équivalent à la valeur locative suisse)',
  },
  /** A home in France without a taxe d'habitation: the taxes foncières' base, times 2. */
  franceLandTaxFactor: {
    value: 2,
    source: 'ge-na-revenu-immobilier-page (Bien situé en France)',
  },
};
