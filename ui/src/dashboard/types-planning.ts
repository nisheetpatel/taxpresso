// The /api/state `planning` part (extension/src/planning.ts, planningView): pension fund buy-in,
// 3a catch-up and TOU. Kept in step by the API tests.

export interface Estimate {
  cantonalCentimes: number;
  federalCentimes: number;
  totalCentimes: number;
}

export interface LppPlan {
  people: {
    person: 'p1' | 'p2';
    capacityCentimes?: number;
    amountCentimes?: number;
    overCapacity: boolean;
  }[];
  amountCentimes: number;
  saving?: Estimate;
  problem?: 'over_capacity' | 'no_income' | 'no_tax';
  capacityUnknown: boolean;
  assumptions: string[];
  facts: Record<string, string>;
  sources: string[];
}

export interface CatchUpPlan {
  people: {
    person: 'p1' | 'p2';
    status: 'unknown' | 'no_gap' | 'pay_this_year_first' | 'possible';
    gapCentimes?: number;
    isMaximum: boolean;
    catchUpCentimes: number;
  }[];
  catchUpCentimes: number;
  capInYearCentimes: number;
  saving?: Estimate;
  assumptions: string[];
  facts: Record<string, string>;
  sources: string[];
}

export type TouStatus = 'yes' | 'no' | 'unknown' | 'check';

/**
 * in_place and compulsory are facts (nothing to compare or decide); choice is a real choice;
 * check: possibly compulsory, ask the tax office; unknown: an answer that decides it is missing.
 */
export type TouMode = 'in_place' | 'compulsory' | 'choice' | 'check' | 'unknown';

/** Tax at source in plain words (extension/src/source-tax.ts). */
export interface SourceTaxState {
  lines: { person?: 'p1' | 'p2'; text: string; source?: string; estimate?: true }[];
  people: {
    person: 'p1' | 'p2';
    atSource: boolean | null;
    how: 'derived' | 'answered' | 'unknown';
    /** The barème that counts: a payslip's, else the one worked out. */
    tariff: string | null;
    derivedTariff: string | null;
    documentTariff: string | null;
    withheld: {
      centimes: number;
      from: 'certificate' | 'stated' | 'tariff';
      estimate: boolean;
    } | null;
    missing: string[];
  }[];
}

export interface TouPlan {
  applies: boolean;
  /** Only when it applies. */
  mode?: TouMode;
  compulsory: TouStatus;
  reasons: { id: string; status: TouStatus; source: string }[];
  withheld?: {
    totalCentimes: number;
    people: {
      person: 'p1' | 'p2';
      centimes: number;
      from: 'certificate' | 'stated' | 'tariff';
      tariff?: string;
    }[];
  };
  missingWithheld: ('p1' | 'p2')[];
  ordinary?: Estimate;
  differenceCentimes?: number;
  problem?: 'mixed_couple' | 'no_income' | 'benefits_unknown' | 'income_not_counted';
  deadline: string;
  deadlinePassed: boolean;
  thresholds: {
    grossCentimes: number;
    otherIncomeCentimes: number;
    wealthFree: { single: number; coupleOrSingleParent: number; perDependant: number };
  };
  assumptions: string[];
  facts: Record<string, string>;
  sources: string[];
  decision?: {
    optimizationId: string;
    choice: 'request' | 'decline';
    decidedAt: string;
    deltaCentimes: number;
    via: 'chat' | 'dashboard';
  };
}

export interface PlanningState {
  inputs: {
    person: 'p1' | 'p2';
    lppCapacity: number | null;
    lppAmount: number | null;
    paid2025: number | null;
    withheld: number | null;
    tariff: string | null;
    taxedAtSource: boolean;
  }[];
  otherIncome: boolean | null;
  taxableWealth: boolean | null;
  tariffs: string[];
  lpp: LppPlan;
  catchUp: CatchUpPlan;
  tou: TouPlan;
  /** Taxed at source without TOU: 3a and buy-ins lower the tax only with TOU. */
  needsTou: boolean;
  /** Zurich: TOU is Geneva's, and taxation at source is not supported there yet. */
  touGenevaOnly?: true;
}

export type PlanningField =
  | 'lppCapacity'
  | 'lppAmount'
  | 'paid2025'
  | 'withheld'
  | 'tariff'
  | 'otherIncome'
  | 'taxableWealth';
