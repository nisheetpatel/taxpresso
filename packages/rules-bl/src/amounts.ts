// The deduction amounts of one Basel-Landschaft tax year, as the engine reads them. Money in
// centimes, rates in basis points (1 % = 100). Each year's values, with their citations, are in
// ./<year>/amounts.ts. Most of them are in the tax law itself (StG, SGS 331, Stand 1 January 2023,
// still the current version), the professional costs in the ordinance (Verordnung zum Steuergesetz,
// SGS 331.11) of the year, and the guide (Wegleitung) of the year prints them all with the lines of
// the return.
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

/** The pensioners' deduction of one kind of pension (AHV or IV), by household. */
export interface PensionerLimits {
  /** The maximum simple pension a year: up to it, 40 % of the income. */
  single: number;
  /** The maximum pension of a couple a year: up to it, 60 % of the income. */
  couple: number;
}

export interface BlAmounts {
  /**
   * 500/505, travel to work: at most a year; a bike, moped or yellow-plate motorbike, at most a
   * year; a car or a white-plate motorbike when public transport can't be used, per km.
   */
  travel: Cited<{ max: number; bikePerYear: number; carPerKm: number; motorbikePerKm: number }>;
  /** 510/515, lunch away from home: per day and a year; half with a canteen or meal vouchers. */
  meals: Cited<MealAmounts>;
  /** 520/525, other professional costs: the canton's flat amount, on top of the costs proven. */
  otherFlat: Cited<number>;
  /** 530/535, a side job: a share of its net income, between a minimum and a maximum. */
  sideJob: Cited<{ rateBp: number; min: number; max: number }>;
  /** 550/555, private debt interest: up to the gross income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 610/615, pillar 3a: the federal limits. */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * 620/625/630, insurance premiums and interest on savings: married couples, everyone else, and
   * more for each child with the child reduction.
   */
  insurance: Cited<{ married: number; other: number; perChild: number }>;
  /** 640, childcare: at most per child under 14. */
  childcare: Cited<number>;
  /** 650, professional training: at most per person. */
  training: Cited<number>;
  /** 680, both spouses work: the lower earned income, at most this. */
  twoEarner: Cited<number>;
  /** 735, political parties: at most. */
  party: Cited<number>;
  /** 770/771, AHV and IV pensioners: the maximum pensions the deduction is read against. */
  pensioner: Cited<{
    ahv: PensionerLimits;
    iv: PensionerLimits;
    /** 40 % for one person, less 1 % for each started CHF 100 above the maximum pension. */
    singleBp: number;
    singleStep: number;
    /** 60 % for a couple, less 1 % for each started CHF 250 above the maximum pension. */
    coupleBp: number;
    coupleStep: number;
  }>;
  /** The child reduction (Kinderabzug): so much off the income tax for each child. */
  childReduction: Cited<number>;
  /** 900/905, the wealth allowances (steuerfreie Beträge). */
  wealthFree: Cited<{ family: number; other: number }>;
}
