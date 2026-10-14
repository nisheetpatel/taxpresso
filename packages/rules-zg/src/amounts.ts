// The deduction amounts of one Zug tax year, as the engine reads them. Money in centimes, rates in
// basis points (1 % = 100). Each year's values, with their citations, are in ./<year>/amounts.ts.
// The law (StG, BGS 632.1) gives the rules and the base amounts; the Steuerverwaltung indexes the
// amounts of § 30 Bst. g, h and l, § 33 Abs. 1 and 2 and § 44 every year (§ 45) and prints them on
// one page per year (zg-2026-deductions-sozialabzuege: page 1 is 2026, page 2 is 2025); the
// professional costs' flat rates are those of the federal ordinance's annex (Steuerbuch 16.1).
import type { Cited, MealAmounts, Pillar3aAmounts } from '@taxpresso/rules-ch';

/** A deduction by net income: the first row whose `upTo` the income does not exceed. */
export interface IncomeRow {
  /** The highest net income (Reineinkommen, 299) of the row, in centimes. */
  upTo: number;
  amount: number;
}

export interface ZgAmounts {
  /**
   * 201/202, travel to work: at most a year per person (§ 25 Abs. 1 Bst. a); a car or a
   * white-plate motorbike when public transport can't be used, per km; a bike, moped or
   * yellow-plate motorbike, a year; the most working days counted (null: no document of the year
   * gives a limit).
   */
  travel: Cited<{
    max: number;
    carPerKm: number;
    motorbikePerKm: number;
    bikePerYear: number;
    maxDays: number | null;
  }>;
  /** 201/202, lunch away from home: per day and a year; half with a canteen or meal vouchers. */
  meals: Cited<MealAmounts>;
  /** 201/202, other professional costs: a share of the net salary, between a minimum and a maximum. */
  otherFlat: Cited<{ rateBp: number; min: number; max: number }>;
  /** 201/202, a side job: a share of its net income, between a minimum and a maximum. */
  sideJob: Cited<{ rateBp: number; min: number; max: number }>;
  /** 205, private debt interest: up to the taxable income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 220/221, pillar 3a: the federal limits (§ 30 Bst. e). */
  pillar3a: Cited<Pillar3aAmounts>;
  /**
   * 230, insurance premiums and savings interest: at most, married couples and everyone else, with
   * contributions to the 2nd pillar or 3a and without; more for each child.
   */
  insurance: Cited<{
    married: number;
    marriedNone: number;
    other: number;
    otherNone: number;
    perChild: number;
  }>;
  /** 245/246, professional training: at most per person. */
  training: Cited<number>;
  /** 252, political parties: at most, in total. */
  party: Cited<number>;
  /** 253, childcare by others: at most per child under 14. */
  childcare: Cited<number>;
  /** 260, both spouses work: at most, of the lower earned income. */
  twoEarner: Cited<number>;
  /** 295, illness and accident costs: the part above this share of the net income 287. */
  medicalThresholdBp: Cited<number>;
  /** 296, donations: once they reach `min` in the year, up to this share of 287. */
  donations: Cited<{ shareBp: number; min: number }>;
  /** 400 and 402, the personal deduction: large (married, or living with children) and small. */
  personal: Cited<{ large: number; small: number }>;
  /** 403, the child deduction, and 403a, more from the year the child turns 15. */
  child: Cited<{ base: number; from15: number }>;
  /** 404, own care of a child under 15 (Eigenbetreuung), when the childcare deduction is lower. */
  ownCare: Cited<number>;
  /**
   * 406, AHV/IV pensioners: once per taxpayer (2025) or per pensioner (2026), when the net wealth
   * (660) is at most `maxWealth`; by net income (299), the rows for the large and the small
   * personal deduction.
   */
  pensioner: Cited<{
    perPerson: boolean;
    maxWealth: number;
    large: readonly IncomeRow[];
    small: readonly IncomeRow[];
  }>;
  /** 407, renters: a share of the net rent of the home you live in, at most a year. */
  rent: Cited<{ shareBp: number; max: number }>;
  /** 671 to 673, tax-free wealth: married couples, everyone else, each minor child. */
  wealthFree: Cited<{ married: number; other: number; perChild: number }>;
}
