// The deduction amounts of one Lucerne tax year, as the engine reads them. Money in centimes, rates
// in basis points (1 % = 100). Each tax year's values, with their citations, are in
// ./<year>/amounts.ts.
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

export interface LuAmounts {
  /** Travel to work: at most this a year (StG § 33 Abs. 1 lit. a). */
  commuteMax: Cited<number>;
  /** A bicycle, e-bike or moped (yellow plate): a flat amount a year. */
  commuteBike: Cited<number>;
  /** Car or motorbike (white plate) when public transport can't be used: centimes per km driven. */
  commuteKm: Cited<{ car: number; motorbike: number }>;
  /** Meals away from home: per day and per year; half when the employer pays part (box G). */
  meals: Cited<MealAmounts>;
  /** Other professional costs: a share of the net salary, between a minimum and a maximum. */
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** A side job (Nebenerwerb): a share of its net income, between a minimum and a maximum. */
  sideJobFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** Professional training (StG § 40 Abs. 1 lit. m). */
  trainingMax: Cited<number>;
  /** Private debt interest: up to the income from wealth plus this (StG § 40 Abs. 1 lit. a). */
  debtInterestExtra: Cited<number>;
  /** Pillar 3a: the federal limits, which StG § 40 Abs. 1 lit. e takes over (Art. 82 BVG). */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * Insurance premiums and savings interest (StG § 40 Abs. 1 lit. g): what was paid, up to an
   * amount for spouses or for others; higher without contributions to a pension fund or pillar 3a
   * (for spouses, neither of them); plus so much per child with the child deduction (half when the
   * parents share it, § 42 Abs. 2).
   */
  insurance: Cited<{
    married: number;
    other: number;
    marriedNone: number;
    otherNone: number;
    perChild: number;
  }>;
  /** Medical costs: only the part above this share of the Nettoeinkommen (StG § 40 Abs. 1 lit. h). */
  medicalThresholdBp: Cited<number>;
  /** Donations: at least so much in the year, at most this share of the Nettoeinkommen (lit. i). */
  donations: Cited<{ min: number; shareBp: number }>;
  /** Political parties, per return (StG § 40 Abs. 1 lit. k). */
  partyMax: Cited<number>;
  /** Both spouses earn (StG § 40 Abs. 2, StV § 13): a fixed amount from the lower earned income. */
  twoEarner: Cited<number>;
  /**
   * The degressive social deduction (StG § 42 Abs. 1 lit. e and f): this share of the difference
   * between the limit of the tariff and the Reineinkommen.
   */
  degressive: Cited<{ shareBp: number; single: number; family: number }>;
  /** Per child (StG § 42 Abs. 1 lit. a): minor or in education, or away for education. */
  child: Cited<{ base: number; away: number }>;
  /** Own care of a child under 14 living with you (StG § 42 Abs. 1 lit. b). */
  ownCare: Cited<number>;
  /**
   * Childcare by others because of work or education (StG § 42 Abs. 1 lit. b): the deduction for own
   * care rises to at most this per child, own care included.
   */
  childcareMax: Cited<number>;
  /**
   * Parents taxed apart who both qualify (StV § 14b): each deducts this for own care, rising to at
   * most `max` with childcare, and the two parents' childcare costs count up to `thirdPartyTotal`.
   */
  sharedCare: Cited<{ own: number; max: number; thirdPartyTotal: number }>;
  /**
   * The flat costs of keeping securities and accounts (Wertschriftenverzeichnis Ziffer 6): a share of
   * their tax value up to an amount, a smaller share above it, at most their income.
   */
  assetManagement: Cited<{ bp: number; upTo: number; bpAbove: number }>;
  /** Tax-free wealth (StG § 52 Abs. 1): spouses, everyone else, and per child with the child deduction. */
  wealthFree: Cited<{ married: number; other: number; perChild: number }>;
}
