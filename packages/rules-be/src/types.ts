// The Bern engine's input and result. Money is integer centimes everywhere. Field names follow the
// household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is the
// same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items carry
// the code of the line on the Bern return (./rubrics.ts), deductions negative, income and assets
// positive.
import type {
  Amount,
  CommuteMode,
  EnginePerson,
  IfdResult,
  LimitApplied,
  Line,
  Text,
} from '@taxpresso/rules-ch';
import type { Confession } from './communes.js';
import type { BeTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';
export type { Confession } from './communes.js';

/** Whose an item is: taxpayer 1 (p1), 2 (p2) or the household. */
export type ItemPerson = EnginePerson | 'household';

/** Whose accounts and securities: a person, the household, or a minor child (declared by the parents). */
export type MovableOwner = ItemPerson | `child${number}`;

/** One salary certificate (Lohnausweis). */
export interface EmploymentInput {
  id?: string;
  /** Box 8, gross salary. */
  gross: Amount;
  /** Box 9, AHV/IV/EO/ALV/NBUV contributions. */
  socialContributions?: Amount;
  /** Box 10.1, ordinary pension fund contributions. */
  pensionFund?: Amount;
  /** Box 10.2, pension fund buy-ins taken from the salary. */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so meals count at half the rate (BKV Art. 8 Abs. 3). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, 2.21): its costs are the 20 % flat, at most its salary. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 2.23: loss-of-earnings allowances and daily allowances not paid through the employer. */
  replacementIncome?: Amount;
  /** 2.23: unemployment benefits paid directly. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (form 9); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 2.22: AHV/IV pensions. */
  pensionAvs?: Amount;
  /** 2.22: pension fund pensions, taxed at 100 % in the canton. */
  pensionOccupational?: Amount;
  /** 2.22: other pensions, the taxable amount (for a life annuity, its income share). */
  pensionOther?: Amount;
  /** 2.24: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** Paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** Pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** Pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** 6.1: yearly public transport cost, or what it would cost a driver who could use it. */
  commuteCost?: Amount;
  commuteMode?: CommuteMode;
  /** 6.2: working days with a main meal away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 6.4: actual other professional costs, used instead of the 3 % flat when higher. */
  otherProfessionalCosts?: Amount;
  /** 6.6: professional training paid, less what others paid. */
  trainingCosts?: Amount;
  /** 4.4: payments to political parties, this person's (the limit is per person). */
  politicalParty?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child counts in full for you. 'shared': joint parental authority with a parent you
   * are not taxed with; who counts the child depends on child support (childSupport).
   */
  custody: 'full' | 'shared';
  /** Lives in your household (the tariff, the single parent's amount, childcare). Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 2.1: childcare paid for this child. */
  childcare?: Amount;
  /** 2.1: education away from home or proven extra education costs for this child. */
  education?: Amount;
}

export interface BeEngineInput {
  taxYear: BeTaxYear;
  /** Commune of residence on 31 December, by its BFS number (StG Art. 165 Abs. 1 and 4). */
  commune: number;
  /** Registered partners are 'married' (be-2025-wegleitung-np-de p. 21). */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint authority: child support for the children.
   * 'receives': they count in full here; 'pays': they count for the other parent; 'none': half
   * each.
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Form 1.2, "Führen Sie alleine einen eigenen Haushalt?": alone, or only with your own children
   * or people in need you support (not with a partner or flatmates). Asked of anyone not married.
   */
  ownHousehold?: boolean;
  /**
   * Shared custody without child support, the child living with you part of the time: whether you
   * have the tariff for married couples and single parents (Art. 42 Abs. 1), as your last
   * assessment shows.
   */
  marriedTariff?: boolean;
  /**
   * Federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24, ch. 13.4.2). Unknown, the federal
   * tax is not computed for such a parent.
   */
  ifdParentalScale?: boolean;
  /**
   * Shared custody without child support: the wealth deduction for a child whose deduction you
   * share, as your last assessment shows: in full or half. The law gives it per child with the
   * child deduction (Art. 64 Abs. 1 lit. b) and halves only income deductions (Art. 40 Abs. 8).
   */
  sharedChildWealth?: 'full' | 'half';
  /** Opt-in church tax, by person; where the commune's parts differ, the part (its name). */
  church?: { p1?: Confession; p2?: Confession; part?: string };
  household?: {
    /** 4.2: health insurance premiums paid, after any premium subsidy. */
    healthPremiums?: Amount;
    /** 4.2: private accident and invalidity insurance premiums. */
    accidentPremiums?: Amount;
    /** 4.2: premiums of pillar 3b life insurance. */
    lifeInsurancePremiums?: Amount;
    /** 4.2: interest on savings (it is income too: include it in `movable`). */
    savingsInterest?: Amount;
    /** Premium subsidy received, when not already netted from the premiums. */
    healthSubsidy?: Amount;
    /** 5.4: medical costs left to pay. */
    medicalCosts?: Amount;
    /** 5.3: donations to tax-exempt Swiss organisations. */
    donations?: Amount;
    /** 4.4: payments to political parties, when one person paid them all (else per person). */
    politicalParty?: Amount;
    /** 5.1: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 5.1: child support paid, up to the child's 18th birthday. */
    childSupportPaid?: Amount;
    /** 2.24: child support received. */
    childSupportReceived?: Amount;
    /** 4.3: private debt interest paid. */
    debtInterest?: Amount;
    /** 4.3: private debts on 31 December. */
    debts?: Amount;
    /** 3.0 line 51: costs of keeping securities and accounts, as admitted. */
    bankFees?: Amount;
    /** 2.25: other taxable income, as given. */
    otherIncome?: Amount;
    /**
     * 2.1: childcare paid for the household as a whole, when not given per child (the limit is
     * per child: see compute.ts).
     */
    childcare?: Amount;
    /** 4.1: cash, gold and other precious metals. */
    cash?: Amount;
    /** 4.2: life and annuity insurance, tax value. */
    lifeInsuranceValue?: Amount;
    /** 4.1: vehicles, at their tax value (a share of the price by year of purchase). */
    vehicles?: Amount;
    /** 4.1: other assets. */
    otherAssets?: Amount;
  };
  /**
   * Accounts and securities (form 3): value on 31 December and gross income. A minor child's are
   * declared by the parents (be-2025-wegleitung-np-de p. 27).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Bern return (./rubrics.ts). */
  code: string;
  person: ItemPerson;
  /**
   * What was declared on the form before the rule that set the line, with the line's sign: TaxMe's
   * "Ihre Angaben" next to its "Steuerbar" (be-2025-steuererklaerung-formulare-de p. 9 and 11).
   * Absent: the same as the amount.
   */
  given?: number;
}

/** The federal column of the Bern return: TaxMe's federal summary (p. 11). */
export interface BeIfdResult extends IfdResult {
  items: Item[];
  /** Total Aufwendungen und allgemeine Abzüge, federal (negative). */
  totalDeductions: Line;
  /** Total persönliche Abzüge / Sozialabzüge, federal (negative). */
  personalDeductions: Line;
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
  /** The commune's Steueranlage for natural persons, in ten-thousandths of the einfache Steuer. */
  rate: number;
}

/** The cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern), named `icc`. */
export interface BeIccResult {
  items: Item[];
  /** Total Einkünfte. */
  grossIncome: Line;
  /** Total Aufwendungen und allgemeine Abzüge (negative). */
  totalDeductions: Line;
  /** Reineinkommen: the base of the donations and medical costs (Art. 38a). */
  netIncome: Line;
  /** Total persönliche Abzüge / Sozialabzüge (negative). */
  personalDeductions: Line;
  /** Steuerbares Einkommen. */
  taxableIncome: Line;
  /** Art. 42 Abs. 1 (married couples and single parents) or Abs. 2 (everyone else). */
  tariff: 'married' | 'other';
  wealth: {
    items: Item[];
    /** Total Vermögen. */
    grossWealth: Line;
    /** Steuerbares Vermögen: after debts and the wealth deductions. */
    taxableWealth: Line;
  };
  taxes: {
    /** Einfache Steuer on income and on wealth, and their sum. */
    simpleIncome: Line;
    simpleWealth: Line;
    simple: Line;
    /** Kantonssteuer: the einfache Steuer times the canton's Steueranlage. */
    cantonal: Line;
    /** Gemeindesteuer: the einfache Steuer times the commune's Steueranlage. */
    communal: Line;
    /** Kirchensteuer, only when asked for. */
    church: Line | null;
    /** The cut of the wealth tax by the Höchstbelastung (Art. 66), when it applies. */
    wealthCap: Line | null;
    total: Line;
  };
}

export interface BeTaxResult {
  canton: 'BE';
  taxYear: BeTaxYear;
  commune: CommuneRef;
  icc: BeIccResult | null;
  /** The federal direct tax, as TaxMe's federal summary lays it out (./ifd.ts); null when not computed. */
  ifd: BeIfdResult | null;
  /** The cantonal, communal (and church, when asked for) tax plus the federal tax, when both are computed. */
  total: number | null;
  estimates: { id: string; what: Text }[];
  needsOk: number;
  complete: boolean;
  incomplete: Text[];
  assumptions: Text[];
  notCounted: Text[];
  unsupported: Text[];
  unverifiedRules: Text[];
  /** Every cap, threshold, minimum or choice a rule applied, in both taxes (SPEC.md 10.0). */
  limits: LimitApplied[];
}
