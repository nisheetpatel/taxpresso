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
  /** False when part of the amount is unknown: it is then a floor, and so is what rests on it. */
  complete?: boolean;
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
  /**
   * 31.40: 3a catch-up payment (rachat 3a, from tax year 2026), on top of the yearly limit; its
   * own limits are checked by the planner (ch-2026-ifd-instructions-personnes-physiques p. 8).
   */
  pillar3aCatchUp?: Amount;
  /** 31.30: pension fund buy-ins paid directly (attestations), besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund (2nd pillar). Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /**
   * Yearly cost of getting to work as an amount: the public transport paid, or for a driver who
   * could have used public transport, what it would have cost (Form. 2a 2026 p. 6).
   */
  commuteCost?: Amount;
  /** How the person got to work, when that, not an amount, sets the travel costs. */
  commuteMode?: CommuteMode;
  /** Working days with a main meal away from home (15 a day). */
  mealDays?: number;
  /** The facts behind mealDays. */
  mealFacts?: readonly string[];
  /** ICC meal deduction allowed: more than 2 hours a day by public transport (guide p. 19). */
  mealsIccAllowed?: boolean;
  /** 31.63: other actual professional costs (union dues, tools...). */
  otherProfessionalCosts?: Amount;
  /** 59.50: professional training paid. */
  trainingCosts?: Amount;
}

/**
 * The way to work, for travel costs (frais de déplacement): ch-2026-ifd-instructions-personnes-
 * physiques p. 6, ge-2025-guide-declaration-pp p. 19 to 22.
 */
export interface CommuteMode {
  /** bike: bike, e-bike or moped with a yellow plate; motorbike: white plate. */
  by: 'public_transport' | 'car' | 'motorbike' | 'bike' | 'walk' | 'home';
  /** Car or motorbike: whether public transport could have been used for the trip. */
  transitUsable?: boolean;
  /** Car or motorbike without usable public transport: kilometres one way, and days driven. */
  kmOneWay?: number;
  days?: number;
  status?: InputStatus;
  facts?: readonly string[];
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

/**
 * The securities list (état des titres) and the other movable wealth, as the securities rules
 * compute them (./../2026/etat-des-titres.ts, WealthItem): one amount per rubric, part and person.
 */
export interface WealthItemInput {
  code: string;
  part: 'income' | 'deduction' | 'wealth' | 'wealth_deduction' | 'credit';
  person: 'p1' | 'p2' | 'household';
  centimes: number;
  taxes: readonly ('icc' | 'ifd')[];
  /** Includes estimates or values waiting for the user's OK. */
  estimate: boolean;
  /** False when some contributing amount is unknown: the amount is then a floor. */
  complete: boolean;
  label: Text;
  source: string;
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
   * A parent without a partner sharing custody: child support (contribution d'entretien) for the
   * children. 'receives': the children count in full here (child deductions, splitting, parental
   * scale); 'pays': they count for the other parent; 'none': half each, and the parental scale goes
   * to the parent who earns more (ifdParentalScale). ch-na-circulaire-30-epoux-famille p. 24, 32
   * and 33 (ch. 13.4.2, 14.4, 14.5); ge-2025-guide-declaration-pp p. 45 and 46.
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24, ch. 13.4.2; p. 32, ch. 14.4.2).
   * Unknown, the federal tax is not computed.
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
  /** Bank accounts and securities, per owner (when the état des titres is not given). */
  movable?: readonly MovableAsset[];
  /**
   * The état des titres and other movable wealth by rubric (14.00, 16.40, 16.70, 52.11, 55.10,
   * 56.20, 56.30, credits F1.IA and F1.IES). When given, it is the only source of these amounts.
   */
  wealthItems?: readonly WealthItemInput[];
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
  /** Rests on an amount known only in part: a floor, not a final figure. */
  incomplete?: boolean;
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
  /** 95.00 revenu net total: after the social deductions. */
  totalIncome: Line;
  /** 99.00 revenu imposable. */
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
  /**
   * Credits shown on the bordereau, not part of the tax: the Swiss withholding tax claimed back
   * (impôt anticipé) and the foreign tax credit (DA-1), the imputations of the état des titres.
   */
  credits: { withholdingTax?: Line; foreignTax?: Line };
}

export interface IfdResult {
  items: Item[];
  grossIncome: Line;
  subtotal9220: Line;
  subtotal9240: Line;
  netIncome: Line;
  totalIncome: Line;
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

/**
 * A cap, a threshold or a minimum a rule applied to an amount the user gave, or the switch between
 * the flat deduction and the actual costs. Every one applied is listed, whatever the distance; the
 * final check (./final-check.ts) keeps those at or near their limit (SPEC.md 10.0).
 */
export interface LimitApplied {
  /** The rubric as printed for this person (31.40 for A, 41.40 for B). */
  code: string;
  person: ItemPerson;
  /** The tax it is applied in; 'both' when the same rule and amount serve the two. */
  tax: 'icc' | 'ifd' | 'both';
  /**
   * cap: at most `limit` is deducted. threshold: only the part above `limit` counts (medical
   * costs). minimum: nothing counts under `limit` (federal donations). choice: the flat deduction
   * (`limit`) or the actual costs (`given`), whichever is higher.
   */
  kind: 'cap' | 'threshold' | 'minimum' | 'choice';
  /** What was given before the rule, in centimes: paid, the costs, the actual costs. */
  given: number;
  /** The limit as applied, in centimes. */
  limit: number;
  /** What the rubric gets, in centimes (zero or more). */
  counted: number;
  /** The rule that sets the limit: manifest id plus page or article. */
  source: string;
  /** The limit itself is an estimate (a constant not published yet for the year). */
  estimate?: boolean;
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
  /** False when some amount is known only in part: the taxes are then floors, not final. */
  complete: boolean;
  /** What is known only in part. */
  incomplete: Text[];
  /** What the engine was told to assume about the household. */
  assumptions: Text[];
  /** What is not in the calculation (for example costs with no amount given). */
  notCounted: Text[];
  /** Why a tax is not computed at all (fail closed). */
  unsupported: Text[];
  /** Rules applied whose detail the official documents don't spell out. */
  unverifiedRules: Text[];
  /** Every cap, threshold, minimum and flat-or-actual choice applied, in the order computed. */
  limits: LimitApplied[];
}

export type { EstimateReason, Text };
