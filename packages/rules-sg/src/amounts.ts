// The deduction amounts of one St. Gallen tax year, as the engine reads them. Money in centimes,
// rates in basis points (1 % = 100) unless a field says otherwise. Each year's values, with their
// citations, are in ./<year>/amounts.ts: the tax law of the year (StG, sGS 811.1), the ordinance
// (Steuerverordnung, sGS 811.11, Stand 1 January 2024, still in force), the 2025 guide (Wegleitung)
// and its one-page summary for 2025, and for 2026 the law, the Steuerbuch chapters dated 1 January
// 2026 and the 2026 changes listed in Merkblatt 8 (no 2026 guide is published yet).
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

export interface SgAmounts {
  /**
   * Form 4, 1.1 to 1.3: travel to work, at most a year (the sum of the three); a bike or a small
   * motorbike (yellow plate), at most a year; a car or a motorbike when public transport can't be
   * used, per km.
   */
  travel: Cited<{ max: number; bikePerYear: number; carPerKm: number }>;
  /** Form 4, 2.1 and 2.2: lunch away from home, per day and a year; half with a canteen. */
  meals: Cited<MealAmounts>;
  /** Form 4, 3.1: other professional costs, a fixed amount plus a share of the net salary, at most. */
  otherFlat: Cited<{ base: number; rateBp: number; max: number }>;
  /** Form 4, 5.1: a side job, a share of its net income, at least, at most (up to that income). */
  sideJob: Cited<{ rateBp: number; min: number; max: number }>;
  /** 11, private debt interest: up to the income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 13.1, pillar 3a: the federal limits. */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * 14, insurance premiums and savings interest: married couples and everyone else; more when
   * neither pension fund nor pillar 3a contributions are deducted; more for each child with a child
   * deduction.
   */
  insurance: Cited<{
    married: number;
    other: number;
    marriedExtra: number;
    otherExtra: number;
    perChild: number;
  }>;
  /** 16.2, childcare by third parties: at most per child under 14. */
  childcare: Cited<number>;
  /** 16.3, political parties: at most, married couples and everyone else. */
  party: Cited<{ married: number; other: number }>;
  /**
   * 16.4, professional training: at most per person; the flat amount employees may deduct without
   * proof (cantonal tax only), null when no document of the year gives it.
   */
  training: Cited<{ max: number; flat: number | null }>;
  /** 17, both spouses work: a fixed amount. */
  twoEarner: Cited<number>;
  /** 21.1, illness and accident costs: the part above this share of the Nettoeinkommen (20). */
  medicalThresholdBp: Cited<number>;
  /** 21.3, donations: deductible once they reach `min` in the year, up to a share of 20. */
  donations: Cited<{ min: number; shareBp: number }>;
  /**
   * 23.1 to 23.3, the child deductions: a child not yet of school age, a child in school or
   * training, and that child's education costs above the excess, at most.
   */
  child: Cited<{
    preschool: number;
    school: number;
    educationMax: number;
    educationExcess: number;
  }>;
  /** 36.1 to 36.3, the wealth deductions: each taxpayer, and each minor child. */
  wealthFree: Cited<{ perTaxpayer: number; perChild: number }>;
}
