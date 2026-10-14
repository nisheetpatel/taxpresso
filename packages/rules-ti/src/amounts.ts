// The amounts of one Ticino tax year, as the engine reads them. Money in centimes, rates in basis
// points (1 % = 100) or hundredths of a percent where said. Each tax year's values, with their
// citations, are in ./<year>/amounts.ts. Ticino adjusts its deductions and income tariff to the cost
// of living (LT art. 39) through the yearly executive decree on natural persons, whose annex
// rewrites the articles of the tax law (LT) it changes.
import type { Cited, Pillar3aAmounts } from '@taxpresso/rules-ch';

export interface TiAmounts {
  /**
   * Modulo 4, 2: travel to work by bike, moped or small motorbike (yellow plate), at most so much a
   * year and never more than public transport would cost; by car or motorbike when no public
   * transport can be used, so much a km.
   */
  commute: Cited<{ bikeMax: number; carPerKm: number; motorbikePerKm: number }>;
  /**
   * The most working days a year that count for travel, with a full-time job; null where the year's
   * documents don't give it (then driving costs are not computed).
   */
  commuteMaxDays: Cited<number> | null;
  /**
   * Modulo 4, 3.1: a main meal away from home, so much a day up to so much a year; half with a
   * canteen or an employer's contribution.
   */
  meals: Cited<{ perDay: number; perYear: number; reducedPerDay: number; reducedPerYear: number }>;
  /**
   * Modulo 4, 5: the flat amount for other professional costs (forfait), or the actual costs when
   * higher; halved under the work rate (percent) or the months a year given.
   */
  otherFlat: Cited<{ amount: number; halfBelowRate: number; halfBelowMonths: number }>;
  /** Modulo 4, 6: the flat amount for an occasional side job, in place of its other costs. */
  sideJobFlat: Cited<number>;
  /** 11.1/11.2, pillar 3a: the federal limits. */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * 12, insurance premiums and savings interest: at most so much for spouses living together and
   * for other taxpayers; more when nobody pays into a pension fund or pillar 3a (both spouses for a
   * couple); plus so much per child or dependant with a social deduction.
   */
  insurance: Cited<{
    married: number;
    other: number;
    marriedNoPension: number;
    otherNoPension: number;
    perChild: number;
  }>;
  /** 13.2, private debt interest: up to the gross income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 15.2, political parties: at most. */
  party: Cited<number>;
  /** 15.3/15.4, professional training: at most, per person. */
  training: Cited<number>;
  /** 15.5, both spouses work: at most, never more than the lower of their incomes. */
  twoEarner: Cited<number>;
  /** 20, childcare per child under 14: at most. */
  childcare: Cited<number>;
  /** 22.1, illness costs: only the part above this share of the net income II (21), in basis points. */
  medicalThresholdBp: Cited<number>;
  /** 24, donations: at least `min` in the year, at most this share of the net income III (23). */
  donations: Cited<{ shareBp: number; min: number }>;
  /** 25.1, per dependent child. */
  child: Cited<number>;
  /**
   * 27, the exemption for AVS/AI pensioners: `amount` up to the net income `singleUpTo` (single
   * tariff) or `familyUpTo` (family tariff), then `reduction` less per `step` of income above.
   */
  avsExemption: Cited<{
    amount: number;
    singleUpTo: number;
    familyUpTo: number;
    step: number;
    reduction: number;
  }>;
  /** 35.1 and 35.2, the social deductions from wealth. */
  wealthDeductions: Cited<{ married: number; perMinorChild: number }>;
  /** The cantonal coefficient (coefficiente d'imposta cantonale), in hundredths of a percent. */
  coefficient: Cited<number>;
  /** The communal personal tax (imposta personale) per adult taxpayer. */
  personalTax: Cited<number>;
}
