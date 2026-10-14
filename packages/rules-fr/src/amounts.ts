// The deduction amounts of one Fribourg tax year, as the engine reads them. Money in centimes, rates
// in basis points (1 % = 100). Each year's values, with their citations, are in ./<year>/amounts.ts.
// Most of them are in the tax law itself (LICD, the version in force from 2025, which also governs
// 2026), the rest in two ordinances of the Conseil d'Etat and the finance department in force in both
// years, and in the federal pillar 3a limits; the 2025 guide prints them for 2025.
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

/** The parameters of a flat share between a minimum and a maximum. */
export interface FlatShare {
  rateBp: number;
  min: number;
  max: number;
}

/**
 * A deduction that shrinks with income or wealth: the whole amount up to `limit`, then `cut` less for
 * each started `step` above it, never below zero.
 */
export interface Tapered {
  amount: number;
  limit: number;
  cut: number;
  step: number;
}

export interface FrAmounts {
  /** 2.110, travel to work: at most a year. */
  travelMax: Cited<number>;
  /** 2.110: bike, moped or motorbike with a yellow plate, a year. */
  bikePerYear: Cited<number>;
  /**
   * 2.110, when public transport can't be used: a car per km, by band of the year's mileage
   * ([up to km, centimes per km], the last band without end); a white-plate motorbike per km.
   */
  vehicle: Cited<{ car: readonly (readonly [number, number])[]; motorbikePerKm: number }>;
  /** The working days of a full year, for travel, meals and telework. */
  yearDays: Cited<number>;
  /** 2.120, lunch away from home: per day and a year; half with a canteen or meal vouchers. */
  meals: Cited<MealAmounts>;
  /** 2.130, other professional costs: a share of the net salary, between a minimum and a maximum. */
  professionalFlat: Cited<FlatShare>;
  /** 2.140, a side job: a share of its net salary, between a minimum and a maximum. */
  sideJobFlat: Cited<FlatShare>;
  /** 2.510, both spouses work: from the lower income, at most that income after its costs. */
  twoEarner: Cited<number>;
  /**
   * 4.110, basic health and accident insurance: a flat amount a year per insured person, by
   * category (adult; young adult of 18 to 25 in training at your charge; child at your charge),
   * less the premium subsidy received.
   */
  health: Cited<{ adult: number; young: number; child: number }>;
  /** 4.120, life and other insurance premiums: at most (married couples, others). */
  lifeInsurance: Cited<{ married: number; other: number }>;
  /** 4.150, interest on savings: at most (married couples, others). */
  savingsInterest: Cited<{ married: number; other: number }>;
  /** 4.130, pillar 3a: the federal limits. */
  pillar3a: Cited<Pillar3aAmounts>;
  /** 4.210, private debt interest: up to the gross income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 4.380, childcare: at most per child under 14. */
  childcare: Cited<number>;
  /** 4.410, political parties: at most. */
  party: Cited<number>;
  /** 4.420, professional training: at most. */
  training: Cited<number>;
  /** 5.110, medical costs: only the part above this share of the net income (4.910). */
  medicalThresholdBp: Cited<number>;
  /** 5.120, donations: at most this share of the net income (4.910), none under the minimum. */
  donations: Cited<{ shareBp: number; min: number }>;
  /**
   * 6.110, children: per child (from the third, more), whole while the net income (4.910) is at
   * most `limit` plus `perChild` for each child after the first; then `cut` less per child for each
   * started `step` above it, never below the minimum per child.
   */
  children: Cited<{
    first: number;
    fromThird: number;
    minFirst: number;
    minFromThird: number;
    limit: number;
    perChild: number;
    cut: number;
    step: number;
  }>;
  /**
   * 7.110, modest income: by household, on the income after the social deductions (6.910). A
   * household with charges is a married couple or someone with children at their charge; AVS/AI:
   * receiving AVS or AI benefits.
   */
  modest: Cited<{ single: Tapered; charges: Tapered; avsSingle: Tapered; avsCharges: Tapered }>;
  /**
   * 7.110, social deduction on wealth, on the net wealth (6.910): married couples and single
   * parents living with their children; everyone else.
   */
  wealthDeduction: Cited<{ family: Tapered; single: Tapered }>;
}
