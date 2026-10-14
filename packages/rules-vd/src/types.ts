// The Vaud engine's input and result. Money is integer centimes everywhere. Field names follow the
// household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is the
// same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items carry
// the code of the line on the Vaud return (./rubrics.ts), deductions negative, income and assets
// positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { VdTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** Whose an item is: taxpayer 1 (p1), 2 (p2) or the household. */
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
  /** Box 10.2, pension fund buy-ins taken from the salary. */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so meals count at half (code 150). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (activité salariée accessoire, code 105): under 30 % of normal working hours. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 210: daily allowances for sickness or accident, loss-of-earnings allowances, not via the employer. */
  replacementIncome?: Amount;
  /** 200: unemployment benefits not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (codes 180 to 190); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 240: AVS/AI pensions. */
  pensionAvs?: Amount;
  /** 250: pension fund pensions. */
  pensionOccupational?: Amount;
  /** 270: other pensions, the taxable amount (for a life annuity, its taxable income share). */
  pensionOther?: Amount;
  /** 280: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 310: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 310: pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 320: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** 140: what the trip to work actually cost a year, when it is more than the flat amount. */
  commuteCost?: Amount;
  /** 140: how the person got to work (public transport by distance, car, bike...). */
  commuteMode?: CommuteMode;
  /** 150: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 160: actual other professional costs, used instead of the 3 % flat when higher. */
  otherProfessionalCosts?: Amount;
  /** 618: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child counts in full for you (a part of 0.5). 'shared': joint parental authority
   * with a parent you are not taxed with; who counts the child depends on child support.
   */
  custody: 'full' | 'shared';
  /** Lives in your household (the part of 1.3, childcare). Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 670: childcare paid for this child. */
  childcare?: Amount;
}

export interface VdEngineInput {
  taxYear: VdTaxYear;
  /** Commune of residence on 31 December, by its name in the official table (or its slug). */
  commune: string;
  /**
   * For a commune with fractions (L'Abbaye, Le Chenit): the fraction you live in, or the commune's
   * own name for the rest of the commune.
   */
  communePart?: string;
  /** Registered partners are 'married'; separated spouses are taxed apart, like 'single'. */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint authority: child support for the children.
   * 'receives': they count in full here; 'pays': they count for the other parent; 'none': half.
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Annex 03, asked of anyone not married: "Tenez-vous un ménage indépendant seul avec cet (ces)
   * enfant(s) ?" (alone with your children, not living as a couple). It decides the part of 1.3.
   */
  ownHousehold?: boolean;
  /**
   * Shared custody without child support: whether you mainly bear the child's upkeep (RIFam art. 5
   * al. 2), which decides who of the two parents has the part of 1.3.
   */
  mainUpkeep?: boolean;
  /**
   * 660: the yearly net rent of your main home, without charges (loyer annuel net). Zero when you
   * pay none. Owners: not supported (the rental value comes from annex 07).
   */
  rent?: Amount;
  /** 440: the fire insurance value of your household contents (valeur d'assurance incendie). */
  furnitureInsurance?: Amount;
  household?: {
    /** 300: health and accident insurance premiums paid for the household. */
    healthPremiums?: Amount;
    /** 300: private accident insurance premiums. */
    accidentPremiums?: Amount;
    /** 300: life and annuity insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 300: premium subsidy received, taken off the premiums. */
    healthSubsidy?: Amount;
    /** 480: interest on savings (part of the accounts' income in `movable`). */
    savingsInterest?: Amount;
    /** 710: medical and dental costs left to pay. */
    medicalCosts?: Amount;
    /** 720: donations to tax-exempt Swiss organisations. */
    donations?: Amount;
    /** 620: payments to political parties. */
    politicalParty?: Amount;
    /** 630: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 630: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 280: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 610: private debt interest paid. */
    debtInterest?: Amount;
    /** 610: private debts on 31 December. */
    debts?: Amount;
    /** 490: costs of keeping securities and accounts, as admitted. */
    bankFees?: Amount;
    /** 195: other taxable income, as given. */
    otherIncome?: Amount;
    /** 420: cash, gold, other precious metals and crypto-assets. */
    cash?: Amount;
    /** 435: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 430: cars, boats, collections and the like, at their market value. */
    vehicles?: Amount;
    /** 445: other assets. */
    otherAssets?: Amount;
  };
  /**
   * 410, accounts and securities (annex 01): value on 31 December and gross income. A minor
   * child's are declared by the parent (vd-2025-guide p. 37).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Vaud return (./rubrics.ts). */
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
  /** No federal number: the official tables carry none. */
  bfs: null;
  name: string;
  /** The communal rate applied, in hundredths of a percent of the cantonal base tax. */
  rate: number;
}

/** The cantonal and communal tax (impôt cantonal et communal), named `icc` as in every canton. */
export interface VdIccResult {
  items: Item[];
  /** The income lines added up. */
  grossIncome: Line;
  /** 650, revenu net. */
  netIncome: Line;
  /** 690: 650 less the housing deduction. */
  incomeBeforeModest: Line;
  /** 700, revenu intermédiaire: the base of the medical costs and donations. */
  intermediateIncome: Line;
  /** 800, revenu imposable. */
  taxableIncome: Line;
  /** 810, the parts of the quotient familial, in hundredths (1.8 -> 180). */
  parts: number;
  /** 820, revenu déterminant pour le taux. */
  rateIncome: Line;
  wealth: {
    items: Item[];
    /** The assets added up. */
    grossWealth: Line;
    /** 800, fortune imposable: less the debts, in whole CHF 1,000. */
    taxableWealth: Line;
  };
  taxes: {
    /** Impôt cantonal de base (100 %) on income: the taxable income at the scale's rate. */
    incomeBase: Line;
    /** LRIPP: the reduction of the cantonal base income tax (negative). */
    incomeReduction: Line;
    /** Impôt cantonal sur le revenu: the reduced base tax times the cantonal coefficient. */
    cantonalIncome: Line;
    /** Impôt communal sur le revenu: the base tax times the communal rate. */
    communalIncome: Line;
    /** Impôt cantonal de base (100 %) on wealth. */
    wealthBase: Line;
    cantonalWealth: Line;
    communalWealth: Line;
    total: Line;
  };
}

export interface VdTaxResult {
  canton: 'VD';
  taxYear: VdTaxYear;
  commune: CommuneRef;
  icc: VdIccResult | null;
  /**
   * The federal tax is packages/rules-ch's; Vaud's result shows it once the federal column of the
   * Vaud form is mapped (docs/design/cantons.md, section 6).
   */
  ifd: null;
  /** The cantonal and communal tax, when computed. */
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
