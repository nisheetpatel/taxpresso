// The engine's input and result (SPEC.md section 7). Money is integer centimes everywhere.
// Items are identified by their official rubric code (code de rubrique) and person, the way the
// assessment (avis de taxation) lists them: deductions are negative, income and assets positive.
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import type { Text } from '../2026/checks.js';
import type { EstimateReason } from './param.js';
import type { TaxYear } from './params.js';

export type EnginePerson = 'p1' | 'p2';
/** Whose an item is: taxpayer A (p1), B (p2), a child, or the household as a whole. */
export type ItemPerson = EnginePerson | 'household' | `child${number}`;

/** How sure a value given to the engine is (SPEC.md section 4 statuses). */
export type InputStatus = 'verified' | 'stated' | 'extracted' | 'estimate';

/** A money input, with where it came from. */
export interface Amount {
  /** Centimes, zero or more. */
  value: number;
  /** Default 'stated'. 'estimate' is flagged; 'extracted' still needs the user's OK. */
  status?: InputStatus;
  /** Ledger fact ids behind the value. */
  facts?: readonly string[];
}

/** One salary certificate (certificat de salaire). */
export interface EmploymentInput {
  /** Usually the certificate's document id. */
  id?: string;
  /** Box 8, total gross salary. */
  gross: Amount;
  /** Box 9, AVS/AI/APG/AC/AANP contributions. */
  socialContributions?: Amount;
  /** Box 10.1, ordinary pension fund (2nd pillar) contributions. */
  pensionFund?: Amount;
  /** Box 10.2, pension fund buy-in taken from the salary. */
  pensionBuyIn?: Amount;
  /** Commune where the work is done; default the commune of residence. 'outside': outside Geneva. */
  workCommune?: CommuneSlug | 'outside';
  /** Box G ticked: canteen or meal vouchers (meal deduction halved). */
  canteen?: boolean;
  /** Box F ticked: free transport to work (no commuting deduction). */
  freeTransport?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  /** For the health premium limit: 'young' is 19 to 25, 'adult' 26 and over (default). */
  age?: 'young' | 'adult';
  employments?: readonly EmploymentInput[];
  /** 11.50: benefits replacing salary not paid through the employer (unemployment, APG, ...). */
  replacementIncome?: Amount;
  /** 12.01: net income from self-employment, as given (accounts not computed here). */
  selfEmploymentProfit?: Amount;
  /** 17.10: AVS/AI pensions. */
  pensionAvs?: Amount;
  /** 13.20: pensions from a pension fund. */
  pensionOccupational?: Amount;
  /** 13.40: other pensions. */
  pensionOther?: Amount;
  /** 13.10: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 31.40: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 31.30: pension fund buy-ins paid directly (attestations), besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund (2nd pillar). Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** Actual yearly cost of getting to work (public transport pass, bike flat, car equivalent). */
  commuteCost?: Amount;
  /** Working days with a main meal away from home (15 a day). */
  mealDays?: number;
  /** ICC meal deduction allowed: more than 2 hours a day by public transport (guide p. 19). */
  mealsIccAllowed?: boolean;
  /** 31.63: other actual professional costs (union dues, tools...). */
  otherProfessionalCosts?: Amount;
  /** 59.50: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /** 'shared': alternating custody, half a family charge for each parent. */
  custody: 'full' | 'shared';
  /** Under 14 for the childcare deduction. Default true when childcare costs are given. */
  under14?: boolean;
  /** For the health premium limit; default 'child' (0 to 18). */
  age?: 'child' | 'young' | 'adult';
  /** 59.10 / 59.12: childcare costs paid for this child. */
  childcare?: Amount;
}

/** A line of the securities list or a bank account, summed per owner (état des titres). */
export interface MovableAsset {
  owner: ItemPerson;
  /** Taxable value on 31 December. */
  value?: Amount;
  /** Gross income (interest, dividends). */
  income?: Amount;
  /** Swiss withholding tax (impôt anticipé) retained, for the credit. */
  withholdingSwiss?: Amount;
}

export interface EngineInput {
  taxYear: TaxYear;
  /** Commune of residence on 31 December. */
  commune: CommuneSlug;
  /** Registered partners are 'married' here (LIPP art. 8, LIFD art. 9). */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  /** Dependent children (family charges). */
  children?: readonly ChildInput[];
  /** Override the ICC splitting derived from the household. */
  splitting?: IccSplitting;
  /**
   * Federal parental scale for a single parent sharing custody: the documents in the library don't
   * say which parent gets it, so it must be given; without it the federal tax is not computed.
   */
  ifdParentalScale?: boolean;
  household?: {
    /** 52.21: health insurance premiums paid for everyone in the household. */
    healthPremiums?: Amount;
    /** 52.22: private accident and loss-of-earnings premiums. */
    accidentPremiums?: Amount;
    /** 16.30: health insurance subsidy received. */
    healthSubsidy?: Amount;
    /** 52.11: life insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 56.30: interest on savings (accounts, bonds). */
    savingsInterest?: Amount;
    /** 71.00: medical costs left to pay. */
    medicalCosts?: Amount;
    /** 73.10 / 73.20: donations to charities. */
    donations?: Amount;
    /** 74.00: payments to political parties. */
    politicalParty?: Amount;
    /** 53.10: alimony paid. */
    alimonyPaid?: Amount;
    /** 55.00: private debt interest paid. */
    debtInterest?: Amount;
    /** 55.00 (wealth): private debts on 31 December. */
    debts?: Amount;
    /** 56.20: costs of keeping securities and accounts, as admitted (guide p. 40 and 43). */
    bankFees?: Amount;
    /** Childcare paid for the household when not given per child. */
    childcare?: Amount;
    /** 16.40: cash, precious metals and other assets. */
    otherAssets?: Amount;
  };
  /** Bank accounts and securities, per owner. */
  movable?: readonly MovableAsset[];
}

/** A computed figure with its explanation. */
export interface Line {
  amount: number;
  label: Text;
  /** How it was computed, in plain words, with the numbers. */
  how: Text;
  /** Official sources: manifest id plus page or article. */
  sources: string[];
  /** Why it is an estimate, if it is one (constants not yet published, inputs given as estimates). */
  estimates?: string[];
  /** Depends on a value that still needs the user's OK. */
  needsOk?: boolean;
  facts?: string[];
}

export interface Item extends Line {
  /** Official rubric code, e.g. '31.10'. */
  code: string;
  person: ItemPerson;
}

/** Just what the assessment shows for an item: enough to recompute the taxes. */
export interface ItemAmount {
  code: string;
  person: ItemPerson;
  amount: number;
}

export interface CommunalShare {
  commune: CommuneSlug;
  /** Part of the base tax this commune taxes. */
  base: Line;
  /** The commune's centimes, in hundredths (45.49 -> 4549). */
  rate: number;
  tax: Line;
}

export interface CommunalSplit {
  /** The commune of residence, on its privileged share. */
  privileged: CommunalShare & { sharePercent: number };
  /** The rest: the commune of residence and, for salaries earned elsewhere in Geneva, the commune of work. */
  rest: CommunalShare[];
}

export interface IccTaxes {
  incomeBase: Line;
  incomeCantonalCentimes: Line;
  incomeReduction12: Line;
  incomeHomeCare: Line;
  incomeCantonal: Line;
  wealthBase: Line;
  wealthCantonalCentimes: Line;
  wealthHomeCare: Line;
  wealthSupplementary: Line;
  wealthCantonal: Line;
  communalIncome: CommunalSplit;
  communalWealth: CommunalSplit;
  communalIncomeTotal: Line;
  communalWealthTotal: Line;
  personalTax: Line;
  total: Line;
}

export interface IccResult {
  items: Item[];
  /** 91.00, revenu brut total. */
  grossIncome: Line;
  /** 92.20, the base for the medical costs threshold. */
  subtotal9220: Line;
  /** 92.40, the base for donations. */
  subtotal9240: Line;
  /** Revenu net: after every deduction except the social deductions (61.xx). */
  netIncome: Line;
  /** Revenu imposable. */
  taxableIncome: Line;
  splitting: IccSplitting;
  /** Revenu déterminant le taux. */
  rateIncome: Line;
  wealth: {
    items: Item[];
    grossWealth: Line;
    netWealth: Line;
    socialDeduction: Item;
    taxableWealth: Line;
  };
  taxes: IccTaxes;
  /** Credits shown on the bordereau, not part of the tax: the Swiss withholding tax (imputations). */
  credits: { withholdingTax?: Line };
}

export interface IfdResult {
  items: Item[];
  grossIncome: Line;
  subtotal9220: Line;
  subtotal9240: Line;
  netIncome: Line;
  taxableIncome: Line;
  /** The income the scale is read at: fractions under CHF 100 dropped. */
  scaleIncome: Line;
  scale: 'single' | 'married' | 'parental';
  /** The scale's tax, rounded down to 5 centimes. */
  scaleTax: Line;
  childReduction: Line;
  tax: Line;
}

export interface EstimateNote {
  id: string;
  what: Text;
}

export interface TaxResult {
  taxYear: TaxYear;
  commune: CommuneSlug;
  icc: IccResult | null;
  ifd: IfdResult | null;
  /** ICC (cantonal and communal) plus IFD, when both are computed. */
  total: number | null;
  /** Every estimate the result relies on (SPEC.md section 9). */
  estimates: EstimateNote[];
  /** Items that rely on values still awaiting the user's OK. */
  needsOk: number;
  /** What the engine was told to assume about the household. */
  assumptions: Text[];
  /** What is not in the calculation (for example costs with no amount given). */
  notCounted: Text[];
  /** Why a tax is not computed at all (fail closed). */
  unsupported: Text[];
  /** Rules applied whose detail the official documents don't spell out. */
  unverifiedRules: Text[];
}

export type { EstimateReason, Text };
