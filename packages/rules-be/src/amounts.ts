// The deduction amounts of one Bern tax year, as the engine reads them. Money in centimes, rates in
// basis points (1 % = 100). Each tax year's values, with their citations, are in
// ./<year>/amounts.ts.
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

export interface BeAmounts {
  /** Travel to work: at most this a year (StG Art. 31 Abs. 1 lit. a). */
  commuteMax: Cited<number>;
  /**
   * The partial flat amounts (Teilpauschalen) of the professional costs: the federal ones (BKV
   * Art. 6 Abs. 2), taken from packages/rules-ch for the year and cited to Bern's own documents.
   */
  commuteBike: Cited<number>;
  /** Car or motorbike (white plate) when public transport can't be used: centimes per km. */
  commuteKm: Cited<{ car: number; motorbike: number }>;
  /** Meals away from home: per day and per year; half when the employer pays part. */
  meals: Cited<MealAmounts>;
  /** Other professional costs: a share of the net salary, between a minimum and a maximum. */
  professionalFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** A side job: a share of its net salary, between a minimum and a maximum. */
  sideJobFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** Pillar 3a: the federal limits (OPP 3 art. 7), which StG Art. 38 Abs. 1 lit. e takes over. */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * Insurance premiums and savings interest (StG Art. 38 Abs. 1 lit. g): a fixed amount for spouses
   * or others; without pension fund or 3a contributions, what was paid up to a higher maximum, at
   * least the fixed amount; plus so much per child with the child deduction (half for a half).
   */
  insurance: Cited<{
    married: number;
    other: number;
    marriedNone: number;
    otherNone: number;
    perChild: number;
  }>;
  /** Childcare per child under 14 (StG Art. 38 Abs. 1 lit. l). */
  childcareMax: Cited<number>;
  /** Political parties, per taxpayer (StG Art. 38 Abs. 1 lit. m). */
  partyMax: Cited<number>;
  /** Professional training (StG Art. 38 Abs. 1 lit. n). */
  trainingMax: Cited<number>;
  /** Both spouses earn (StG Art. 38 Abs. 2): a share of both earned incomes, at most this. */
  twoEarner: Cited<{ shareBp: number; max: number }>;
  /** Private debt interest: up to the income from wealth plus this (StG Art. 38 Abs. 1 lit. a). */
  debtInterestExtra: Cited<number>;
  /** Medical costs: only the part above this share of the Reineinkommen (StG Art. 38a lit. b). */
  medicalThresholdBp: Cited<number>;
  /** Donations: at least so much in the year, at most this share of the Reineinkommen (Art. 38a lit. a). */
  donations: Cited<{ min: number; shareBp: number }>;
  /** Allgemeiner Abzug, per taxpayer: each spouse has it (StG Art. 40 Abs. 1). */
  general: Cited<number>;
  /** Living alone in one's own household (Art. 40 Abs. 2), plus so much per child (Abs. 3 lit. c). */
  single: Cited<{ base: number; perChild: number }>;
  /** Child deduction per child (Art. 40 Abs. 3 lit. a); half when the parents share it. */
  child: Cited<number>;
  /** Education away from home or extra education costs, at most per child (Art. 40 Abs. 3 lit. b). */
  education: Cited<number>;
  /**
   * Modest incomes (Art. 40 Abs. 6 and 7): the deduction, the income up to which it is whole, the
   * cut per CHF 2,000 above it, for individuals and for spouses; so much more per child; the share
   * of the taxable wealth counted as income.
   */
  modestIncome: Cited<{
    other: { max: number; limit: number; cut: number };
    married: { max: number; limit: number; cut: number };
    step: number;
    perChild: number;
    wealthShareBp: number;
  }>;
  /** Wealth deductions (StG Art. 64 Abs. 1): spouses, and per child with the child deduction. */
  wealthDeductions: Cited<{ married: number; perChild: number }>;
}
