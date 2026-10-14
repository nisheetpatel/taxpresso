// The deduction amounts of one Zurich tax year, as the engine reads them. Money in centimes,
// rates in basis points (1 % = 100). Each tax year's values, with their citations, are in
// ./<year>/amounts.ts.
import type { Cited } from './cited.js';

export interface ZhAmounts {
  /** Travel to work: at most this a year (StG § 26 Abs. 1 lit. a). */
  commuteMax: Cited<number>;
  /** Bike, moped or motorbike with a yellow plate: a flat amount a year. */
  commuteBike: Cited<number>;
  /** Car or motorbike (white plate) when public transport can't be used: centimes per km. */
  commuteKm: Cited<{ car: number; motorbike: number }>;
  /** The form's limit on days driven, as a rule ("in der Regel begrenzt auf 240 Tage"). */
  commuteDays: Cited<number>;
  /** Meals away from home: per day and per year; half when the employer pays part. */
  meals: Cited<{ perDay: number; perYear: number; halfPerDay: number; halfPerYear: number }>;
  /** Other professional costs: a share of the net salary, between a minimum and a maximum. */
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** Side jobs: a share of their income, between a minimum and a maximum, for all costs. */
  sideJobFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** Pillar 3a: the federal limits (OPP 3 art. 7), the same for the cantonal tax. */
  pillar3a: Cited<{ withFund: number; withoutFundMax: number; withoutFundShareBp: number }>;
  /**
   * Insurance premiums and savings interest (StG § 31 Abs. 1 lit. g): spouses or others; half as
   * much again without contributions to a pension fund or pillar 3a; plus so much per child (half
   * for a half child deduction).
   */
  insurance: Cited<{ married: number; other: number; noPensionBp: number; perChild: number }>;
  /** Childcare per child under 14 (StG § 31 Abs. 1 lit. j). */
  childcareMax: Cited<number>;
  /** Professional training (StG § 31 Abs. 1 lit. k). */
  trainingMax: Cited<number>;
  /** Political parties (StG § 31 Abs. 1 lit. h). */
  partyMax: Cited<{ married: number; other: number }>;
  /** Both spouses earn (StG § 31 Abs. 2): at most this, at most the lower earned income. */
  twoEarner: Cited<number>;
  /** Private debt interest: up to the income from wealth plus this (StG § 31 Abs. 1 lit. a). */
  debtInterestExtra: Cited<number>;
  /** Medical costs: only the part above this share of the net income, line 310 (StG § 32 lit. a). */
  medicalThresholdBp: Cited<number>;
  /** Donations: at least so much in the year, at most this share of line 310 (StG § 32 lit. b). */
  donations: Cited<{ min: number; shareBp: number }>;
  /** Child deduction per child (StG § 34 Abs. 1 lit. a); half when the parents share it. */
  child: Cited<number>;
}
