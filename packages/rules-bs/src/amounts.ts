// The deduction amounts of one Basel-Stadt tax year, as the engine reads them. Money in centimes,
// rates in basis points (1 % = 100). Each tax year's values, with their citations, are in
// ./<year>/amounts.ts. The tax law (StG) keeps the figures before their yearly adjustment to the
// cost of living (§ 37): the amounts are those of the canton's table of the year (Verzeichnis der
// Ansätze, Abzüge und Freibeträge, 18000) and of the guide (Wegleitung) of the year.
import type { Cited, Param, Pillar3aAmounts } from '@taxpresso/rules-ch';

/** Why a value can be an estimate: the canton's table prints it as provisional (in italics). */
export type BsEstimate = 'bs-2026-provisional';

export interface BsAmounts {
  /**
   * 500, the cantonal flat amount for all professional costs (Pauschalabzug), instead of the actual
   * costs; cut in proportion at a work rate of `partTimeRate` % or less, never below `minimum`.
   */
  professionalFlat: Cited<{ amount: number; partTimeRate: number; minimum: number }>;
  /** 503, travel to work: at most this a year. */
  commuteMax: Cited<number>;
  /**
   * 503, travel to work with no public transport ticket: a bike or small moped, so much a year; a car
   * or motorbike when public transport can't reasonably be used, so much a km.
   */
  commuteRates: Cited<{ bikePerYear: number; carPerKm: number; motorbikePerKm: number }>;
  /**
   * 504, lunch away from home: so much a day up to so much a year, less with a canteen or meal
   * vouchers (verbilligt), at most `maxDays` working days a year.
   */
  meals: Cited<{
    perDay: number;
    perYear: number;
    reducedPerDay: number;
    reducedPerYear: number;
    maxDays: number;
  }>;
  /** 620/625, pillar 3a: the federal limits, as the canton's table prints them. */
  pillar3a: Cited<Pillar3aAmounts>;
  /** 630/631, insurance premiums and savings interest: a flat amount (Pauschalbetrag). */
  insurance: Cited<{ married: number; single: number }>;
  /** 550, private debt interest: up to the gross income from wealth plus this. */
  debtInterestExtra: Cited<number>;
  /** 652/657, professional training: at most. */
  training: Cited<number>;
  /** 660, both spouses work: at most, from the lower earned income after its costs. */
  twoEarner: Cited<number>;
  /** 670, childcare per child under 14: at most. */
  childcare: Cited<number>;
  /** 680, political parties: at most, per return. */
  party: Cited<number>;
  /** 725, illness costs: only the part above this share of the net income II (719). */
  medicalThresholdBp: Cited<number>;
  /** 732, donations: at most this share of the net income (709), none under the minimum. */
  donations: Cited<{ shareBp: number; min: number }>;
  /** 750 to 770, the social deductions (Sozialabzüge). */
  social: Cited<{
    child: number;
    married: number;
    singleParent: number;
    single: number;
    retiree: number;
  }>;
  /** 890 to 892, the wealth allowances (steuerfreie Beträge). */
  wealthFree: Cited<{ family: number; single: number; perMinorChild: number }>;
  /**
   * StG § 51, a low income: the wealth tax is reduced when the taxable income is at most `single`
   * (`family` for spouses and for taxpayers with a child or support deduction); [wealth up to,
   * reduction in basis points], the first band that fits.
   */
  lowIncome: Cited<{
    single: number;
    family: number;
    bands: readonly (readonly [number, number])[];
  }>;
  /**
   * Form W line 14: the yield value (Ertragswert) of accounts and securities is their gross income
   * times this factor; the value taxed is the market value or the lower mean of the two.
   */
  securitiesFactor: Param<number, BsEstimate>;
}
