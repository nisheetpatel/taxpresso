// The Fribourg engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the code of the line on the Fribourg return (./rubrics.ts), deductions negative, income and
// assets positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { Church } from './communes.js';
import type { FrTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** Whose an item is: person 1 (p1), person 2 (p2) or the household. */
export type ItemPerson = EnginePerson | 'household';

/** Whose accounts and securities: a person, the household, or a minor child (declared by the parent). */
export type MovableOwner = ItemPerson | `child${number}`;

/** One salary certificate (certificat de salaire). */
export interface EmploymentInput {
  id?: string;
  /** Box 8, gross salary. */
  gross: Amount;
  /** Box 9, AVS/AI/APG/AC/AANP contributions. */
  socialContributions?: Amount;
  /** Box 10.1, ordinary pension fund contributions. */
  pensionFund?: Amount;
  /** Box 10.2, pension fund buy-ins taken from the salary (counted in the base of the 3 % flat). */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so lunch counts at half (code 2.120). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (activité salariée accessoire, code 1.120), whose costs are the 20 % flat (2.140). */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 1.510 to 1.530: sickness, accident or loss-of-earnings allowances not on a salary certificate. */
  replacementIncome?: Amount;
  /** 1.510 to 1.530: unemployment benefits not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (codes 1.210 and 1.220); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 3.110: AVS/AI pensions. Receiving them makes you an AVS/AI beneficiary for code 7.110. */
  pensionAvs?: Amount;
  /** 3.120: pension fund pensions. */
  pensionOccupational?: Amount;
  /** 3.140: other pensions, the taxable amount (for a life annuity, its taxable income share). */
  pensionOther?: Amount;
  /** 3.150: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 4.130: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 4.130: pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 4.140: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /**
   * 2.110: what the trip to work cost a year by public transport (2nd class), or for a car or a
   * motorbike when public transport could be used, what it would have cost.
   */
  commuteCost?: Amount;
  /** 2.110: how the person got to work. */
  commuteMode?: CommuteMode;
  /** 2.120: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 2.130: actual other professional costs, used instead of the 3 % flat when higher. */
  otherProfessionalCosts?: Amount;
  /** 4.420: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child is at your charge (box A* when living with you, B* when not). 'shared':
   * alternating custody with a parent you are not taxed with (box C*); who counts the child
   * depends on child support.
   */
  custody: 'full' | 'shared';
  /** Lives in your household (the reduced rate, childcare). Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 4.380: childcare paid for this child. */
  childcare?: Amount;
  /**
   * For the health insurance flat amount (4.110): 'child' under 18 at the end of the year
   * (default), 'young' from 18 to 25 and in training; 'adult' (over 25) is not supported.
   */
  age?: 'child' | 'young' | 'adult';
}

/** The two churches with a parish tax in every commune; 'none' for anyone else. */
export type Confession = Church | 'none';

export interface FrEngineInput {
  taxYear: FrTaxYear;
  /** Commune of residence on 31 December, all year: its BFS number, or its name or slug. */
  commune: string | number;
  /** Registered partners are 'married'; separated spouses are taxed apart, like 'single'. */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, alternating custody: child support for the children.
   * 'receives': they count in full here; 'pays': they count for the other parent; 'none': not
   * supported (the documents differ).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Opt-in church tax (impôt ecclésiastique): each adult's church, and the parish when the
   * commune's parishes of that church have different coefficients.
   */
  church?: { p1?: Confession; p2?: Confession; parish?: string };
  household?: {
    /** 4.110: health insurance premium subsidy received, taken off the flat amount. */
    healthSubsidy?: Amount;
    /** 4.120: life, pure-risk, daily-allowance and life annuity insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 4.150: interest on savings (part of the accounts' income in `movable`). */
    savingsInterest?: Amount;
    /** 5.110: medical, pharmaceutical and dental costs left to pay. */
    medicalCosts?: Amount;
    /** 5.120: donations to tax-exempt Swiss organisations and public bodies. */
    donations?: Amount;
    /** 4.410: payments to political parties. */
    politicalParty?: Amount;
    /** 4.340: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 4.340: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 3.150: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 4.210: private debt interest paid. */
    debtInterest?: Amount;
    /** 4.210: private debts on 31 December. */
    debts?: Amount;
    /** 4.320: costs of keeping securities and accounts, as admitted. */
    bankFees?: Amount;
    /** 3.410: other taxable income, as given. */
    otherIncome?: Amount;
    /** 3.230: cash, gold and other precious metals. */
    cash?: Amount;
    /** 3.520: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 3.510: cars, boats and the like, at their market value. */
    vehicles?: Amount;
    /** 3.530: collections, works of art, jewellery and other assets. */
    otherAssets?: Amount;
  };
  /**
   * 3.210, accounts and listed securities (annex 01): value on 31 December and gross income. A minor
   * child's are declared by the parent (fr-2025-guide-instructions-generales p. 8).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Fribourg return (./rubrics.ts). */
  code: string;
  person: ItemPerson;
}

/** Just the amount of an item, as an assessment or a filled-in return shows it. */
export interface ItemAmount {
  code: string;
  person: ItemPerson;
  amount: number;
}

export interface CommuneRef {
  bfs: number;
  name: string;
  /** The communal coefficient applied, in hundredths of a percent; null when not published. */
  rate: number | null;
}

/**
 * The cantonal, communal and church tax (impôt cantonal, communal et paroissial), named `icc` as in
 * every canton.
 */
export interface FrIccResult {
  items: Item[];
  /** The income lines added up. */
  grossIncome: Line;
  /** 4.910, revenu net: less the costs and general deductions; the base of 5.110, 5.120, 6.110. */
  netIncome: Line;
  /** 4.910 less the medical costs and donations (5.110, 5.120). */
  incomeAfterCosts: Line;
  /** 6.910: less the social deductions; the base of the modest income deduction (7.110). */
  socialIncome: Line;
  /** 7.910, revenu imposable: less 7.110, in whole CHF 100. */
  taxableIncome: Line;
  /** Married couple or single parent living with their children: the rate of half the income. */
  family: boolean;
  /** The income the rate is read at. */
  rateIncome: Line;
  /** The rate applied, in ten-thousandths of a percent (4.5420 % -> 45_420). */
  rate: number;
  wealth: {
    items: Item[];
    /** The assets added up. */
    grossWealth: Line;
    /** 6.910, fortune nette: less the debts. */
    netWealth: Line;
    /** 7.910, fortune imposable: less the social deduction, in whole CHF 1,000. */
    taxableWealth: Line;
  };
  taxes: {
    /** Impôt cantonal de base (100 %) on income. */
    incomeBase: Line;
    /** Impôt cantonal sur le revenu: the base tax times the cantonal coefficient. */
    cantonalIncome: Line;
    /** Impôt communal sur le revenu: the base tax times the commune's coefficient. */
    communalIncome: Line;
    /** Impôt cantonal de base (100 %) on wealth. */
    wealthBase: Line;
    cantonalWealth: Line;
    communalWealth: Line;
    /** Impôt ecclésiastique on income and on wealth, only when asked for. */
    churchIncome: Line | null;
    churchWealth: Line | null;
    total: Line;
  };
}

export interface FrTaxResult {
  canton: 'FR';
  taxYear: FrTaxYear;
  commune: CommuneRef;
  icc: FrIccResult | null;
  /**
   * The federal tax is packages/rules-ch's; Fribourg's result shows it once the federal part of the
   * Fribourg return is mapped (docs/design/cantons.md, section 6).
   */
  ifd: null;
  /** The cantonal, communal (and church, when asked for) tax, when computed. */
  total: number | null;
  estimates: { id: string; what: Text }[];
  needsOk: number;
  complete: boolean;
  incomplete: Text[];
  assumptions: Text[];
  notCounted: Text[];
  unsupported: Text[];
  unverifiedRules: Text[];
}
