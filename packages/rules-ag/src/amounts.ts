// The deduction amounts of one Aargau tax year, as the engine reads them. Money in centimes, rates
// in basis points (1 % = 100). Each tax year's values, with their citations, are in
// ./<year>/amounts.ts.
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

export interface AgAmounts {
  /** Travel to work: at most this a year (StG § 35 Abs. 1 lit. a). */
  commuteMax: Cited<number>;
  /** Own bike or small motorbike up to 50 cm3: a flat amount a year. */
  commuteBike: Cited<number>;
  /**
   * Car or motorbike when public transport can't be used: centimes per km; for a car, a rate lower by
   * `carLess` for every km beyond `carKm` in the year (StGV § 13 Abs. 1).
   */
  commuteKm: Cited<{ car: number; motorbike: number; carKm: number; carLess: number }>;
  /** Meals away from home: per day and per year; half when the employer pays part (box G). */
  meals: Cited<MealAmounts>;
  /** Pauschalabzug for the other professional costs of the main job: a share of the net salary. */
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** A side job (Nebenerwerb): a share of its income, between a minimum and a maximum. */
  sideJobFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** Pillar 3a: the federal limits (OPP 3 art. 7), which StG § 40 Abs. 1 lit. e takes over. */
  pillar3a: Cited<Pillar3aAmounts>;
  /** Insurance premiums and savings interest (§ 40 Abs. 1 lit. g): a flat amount, whatever was paid. */
  insurance: Cited<{ married: number; other: number }>;
  /** Both spouses earn (§ 40 Abs. 1 lit. h): a fixed amount, at most the second earner's income left. */
  twoEarner: Cited<number>;
  /** Private debt interest: up to the income from wealth plus this (§ 40 Abs. 1 lit. a). */
  debtInterestExtra: Cited<number>;
  /** Medical costs: only the part above this share of the income less §§ 35 to 40 (§ 40 lit. i). */
  medicalThresholdBp: Cited<number>;
  /** Donations: at least so much in the year, at most this share of the income less §§ 35 to 40. */
  donations: Cited<{ min: number; shareBp: number }>;
  /** Political parties: at most this per return, spouses together (§ 40 Abs. 1 lit. k). */
  partyMax: Cited<number>;
  /**
   * Childcare (§ 40 Abs. 1 lit. n): per child under 14, at most `perChild`; parents not taxed
   * together who share custody, at most `perParentShared` each.
   */
  childcare: Cited<{ perChild: number; perParentShared: number }>;
  /** Professional training (§ 40 Abs. 1 lit. p): at most this a year, for each spouse. */
  trainingMax: Cited<number>;
  /** Child deduction (§ 42 Abs. 1 lit. a): under 14, under 18, of age and in education. */
  child: Cited<{ under14: number; under18: number; adult: number }>;
  /**
   * Low incomes (§ 42 Abs. 1bis): [the highest Reineinkommen less the social deductions, in centimes,
   * the deduction up to it], in rising order; nothing above the last.
   */
  lowIncome: Cited<readonly (readonly [number, number])[]>;
  /** Steuerfreie Beträge on wealth (§ 54 Abs. 1): spouses, others, per child with the child deduction. */
  wealthFree: Cited<{ married: number; other: number; perChild: number }>;
}
