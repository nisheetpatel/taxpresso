// The deduction amounts of one Vaud tax year, as the engine reads them. Money in centimes, rates in
// basis points (1 % = 100). Each tax year's values, with their citations, are in ./<year>/amounts.ts.
// The amounts are those of the tax law adjusted to the cost of living each year (LI art. 60), as the
// canton's table of deductions and guide of the year print them; the law's own text keeps the
// unadjusted figures.
import type { Cited, Pillar3aAmounts } from '@taxpresso/rules-ch';

/**
 * An amount the year's documents do not print, given as the previous year's: LI art. 60 adjusts
 * it to the cost of living each year and never down (al. 2), so the year's amount is at least this.
 * The engine computes only where the bound settles the result, and fails closed elsewhere.
 */
export interface Floor<T> extends Cited<T> {
  floorOnly?: true;
}

/** The parameters of a flat share between a minimum and a maximum. */
export interface FlatShare {
  rateBp: number;
  min: number;
  max: number;
}

/** Married couples, everyone else, and so much more per child with a part of 0.5. */
export interface ByFamily {
  single: number;
  married: number;
  perChild: number;
}

export interface VdAmounts {
  /**
   * 140, public transport: the yearly flat amount by the shortest one-way distance, from `fromKm`
   * (and less) to the last entry (and more), which is also the cap. Null: not published.
   */
  publicTransport: Cited<{ fromKm: number; byKm: readonly number[] }> | null;
  /** 140, when public transport can't be used: bike or moped per year; motorbike per km. Null: not published. */
  otherTransport: Cited<{ bikePerYear: number; motorbikePerKm: number }> | null;
  /** 140, car when public transport can't be used: per km up to a yearly mileage, less above it. */
  car: Cited<{ perKm: number; kmLimit: number; abovePerKm: number }>;
  /**
   * Working days of a full year: the transport and meal deductions are for a full year and are cut
   * in proportion for fewer days; driving counts at most these days. A working convention of the
   * guide, not an amount the law adjusts: `carriedFrom` names the year whose guide states it when
   * the year's own guide is not published yet (the result says so).
   */
  yearDays: Cited<number> & { carriedFrom?: number };
  /** 150, lunch away from home: per year; half with a canteen or an employer's contribution. */
  meals: Cited<{ perYear: number; halfPerYear: number }>;
  /** 160, other professional costs: a share of the net salary, between a minimum and a maximum. */
  professionalFlat: Cited<FlatShare>;
  /** 165, a side job: a share of its net salary, between a minimum and a maximum. */
  sideJobFlat: Cited<FlatShare>;
  /** 235, both spouses work: so much from the lower income, at most that income after its costs. */
  twoEarner: Cited<number>;
  /** 300, health, accident and life insurance premiums less subsidies: at most. */
  insurance: Cited<ByFamily>;
  /** 310, pillar 3a: the federal limits, as the canton's table prints them. */
  pillar3a: Cited<Pillar3aAmounts>;
  /** 480, interest on savings: at most, and never more than that interest. */
  savingsInterest: Cited<ByFamily>;
  /** 610, private debt interest: up to the gross income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 618, professional training: at most, per taxpayer. */
  training: Cited<number>;
  /** 620, political parties: at most. */
  party: Cited<number>;
  /** 670, childcare per child under 14: at most; each parent with shared custody, at most. */
  childcare: Cited<{ perChild: number; sharedPerParent: number }>;
  /** 660, housing: rent above a share of the net income (650), the rent counted at most, the deduction at most. */
  housing: Cited<{ max: number; incomeShareBp: number }>;
  /** 660: the rent counted at most; family: married couples and single parents with a child. */
  rentCap: Floor<{ single: number; family: number; perChild: number }>;
  /** 695, modest taxpayers: the maximum deduction by household. */
  modest: Cited<{ base: number; spouse: number; singleParent: number; perChild: number }>;
  /** 710, medical costs: only the part above this share of the intermediate income (700). */
  medicalThresholdBp: Cited<number>;
  /** 720, donations: at most this share of the intermediate income (700), none under the minimum. */
  donations: Cited<{ shareBp: number; min: number }>;
  /**
   * 725, family deduction: married couples, single parents with the part of 1.3, per child with a
   * part of 0.5; whole up to `limit` of net income (650), then less `cut` per `step` up to `upper`,
   * then less `cut` per `upperStep`.
   */
  family: Cited<{
    married: number;
    singleParent: number;
    perChild: number;
    limit: number;
    step: number;
    upper: number;
    upperStep: number;
    cut: number;
  }>;
  /**
   * 820, the cap on what the parts for children take off the rate-determining income: by the
   * parts without children (1.8, 1.3, 1.0), for 1, 2, ... children, [taxable income above which
   * the cap applies, the most the rate-determining income can be lowered].
   */
  quotientCap: Floor<{
    married: readonly (readonly [number, number])[];
    singleParent: readonly (readonly [number, number])[];
    single: readonly (readonly [number, number])[];
  }>;
  /** 440, household contents: a share of the fire insurance value, less a deduction. */
  furniture: Floor<{ shareBp: number; single: number; married: number }>;
  /** 800, net wealth under this is not taxed at all. */
  wealthFree: Cited<{ single: number; married: number }>;
}
