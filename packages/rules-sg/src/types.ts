// The St. Gallen engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the code of the line on the St. Gallen return or its Form 4 (./rubrics.ts), deductions
// negative, income and assets positive.
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
import type { SgTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  LimitApplied,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** Whose an item is: person 1 (p1), person 2 (p2) or the household. */
export type ItemPerson = EnginePerson | 'household';

/** Whose accounts and securities: a person, the household, or a minor child (declared with the parents). */
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
  /** Box 10.2, pension fund buy-ins taken from the salary (the net salary, box 11, is after them). */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so lunch counts at half (Form 4, 2.2). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, 1.2), whose costs are the flat share of Form 4, 5.1. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 3.3: loss-of-earnings allowances (sickness, accident, IV daily allowances, military service). */
  replacementIncome?: Amount;
  /** 3.4: unemployment benefits not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (2.1, 2.2); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 3.1: AHV/IV pensions, in full. */
  pensionAvs?: Amount;
  /** 3.2: pension fund pensions, the taxable amount. */
  pensionOccupational?: Amount;
  /** 3.2: other pensions, the taxable amount (for a life annuity, its taxable share). */
  pensionOther?: Amount;
  /** 6.1: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 13.1: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 13.1: pillar 3a catch-up payment (deductible from the 2026 return, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 13.2: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /**
   * Form 4, 1.1: what public transport to work cost in the year, or for a car or a motorbike when
   * public transport could be used, what it would have cost.
   */
  commuteCost?: Amount;
  /** Form 4, 1.1 to 1.3: how the person got to work. */
  commuteMode?: CommuteMode;
  /** Form 4, 2.1 and 2.2: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** Form 4, 3.2: other professional costs actually paid, instead of the flat amount when higher. */
  otherProfessionalCosts?: Amount;
  /** 16.4: professional training paid. */
  trainingCosts?: Amount;
}

/** Where a child stands for the child deduction (23.1 and 23.2). */
export type ChildStage = 'preschool' | 'school';

export interface ChildInput {
  /**
   * 'full': in your care alone (or with your spouse). 'shared': joint parental authority with a
   * parent you are not taxed with; who counts the child depends on child support (StG Art. 48).
   */
  custody: 'full' | 'shared';
  /** Lives in your household. Default true. */
  livesWithYou?: boolean;
  /**
   * 23.1 or 23.2: not yet of school age (before the 1 August after the fourth birthday), or in
   * school or training (an adult child in training too). Needed for the child deduction.
   */
  stage?: ChildStage;
  /** Under 18 on 31 December, for the wealth deduction 36.3. Default true for a child of preschool age. */
  minor?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 16.2: childcare by third parties paid for this child. */
  childcare?: Amount;
  /** 23.3: education costs you paid for this child in school or training (Form 10). */
  educationCosts?: Amount;
  /** 23.3: state scholarships (Stipendien) for this child, which reduce the education costs. */
  scholarships?: Amount;
}

export interface SgEngineInput {
  taxYear: SgTaxYear;
  /** Commune of residence on 31 December, by its name or slug (the table carries no BFS number). */
  commune: string;
  /** Registered partners are 'married'; separated spouses are taxed apart, like 'single'. */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint parental authority: child support for the
   * children. 'receives': they count here; 'pays': they count for the other parent; 'none': they
   * count for the parent who mainly bears their upkeep (`mainUpkeep`).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /** Shared custody without child support: whether you mainly bear the children's upkeep. */
  mainUpkeep?: boolean;
  /**
   * The federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24). Unknown, the federal tax is not
   * computed.
   */
  ifdParentalScale?: boolean;
  /**
   * Opt-in church tax: each adult's church, and the church area (Kirchgemeinde) where the commune's
   * areas levy different rates.
   */
  church?: { p1?: Confession; p2?: Confession; area?: string };
  household?: {
    /**
     * 16.2: childcare by third parties paid for the household as a whole (the invoices of a crèche,
     * say), when not given per child: it counts where it can be told apart per child (./compute.ts).
     */
    childcare?: Amount;
    /** 6.1: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 6.3: other taxable income, as given. */
    otherIncome?: Amount;
    /** 14 (Form 6, A a): private health insurance premiums paid (gross). */
    healthPremiums?: Amount;
    /** 14 (Form 6, A b): private accident insurance premiums. */
    accidentPremiums?: Amount;
    /** 14 (Form 6, A c): life and annuity insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 14 (Form 6, A d): interest on savings, as in the securities list. */
    savingsInterest?: Amount;
    /** 14 (Form 6, A e): premium subsidies received. */
    healthSubsidy?: Amount;
    /** 21.1: illness and accident costs left to pay (Form 6). */
    medicalCosts?: Amount;
    /** 21.3: donations to tax-exempt Swiss organisations and public bodies. */
    donations?: Amount;
    /** 16.3: payments to political parties. */
    politicalParty?: Amount;
    /** 12.1: alimony paid to a former or separated spouse. */
    alimonyPaid?: Amount;
    /** 12.2: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 11: private debt interest paid (no mortgage: property is not supported). */
    debtInterest?: Amount;
    /** 34.1: private debts on 31 December. */
    debts?: Amount;
    /** 16.1: costs of having securities managed by third parties, as paid. */
    bankFees?: Amount;
    /** 30.2: cash, gold and other precious metals. */
    cash?: Amount;
    /** 30.3: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 30.4: vehicles, at their tax value (purchase price less 20 % a year since). */
    vehicles?: Amount;
    /** 30.6: other assets (boats, collections, works of art, jewellery), at market value. */
    otherAssets?: Amount;
  };
  /**
   * 30.1 and 4.1, accounts and securities: value on 31 December and gross income. A minor child's
   * are taxed with the parents (StG Art. 20 Abs. 2).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the St. Gallen return or its Form 4 (./rubrics.ts). */
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
  /** No federal number: no document of the sources library gives one. */
  bfs: null;
  name: string;
  /** The commune's Gesamtsteuerfuss, in hundredths of a percent of the einfache Steuer. */
  rate: number;
}

/** The church tax as computed: the rate of each adult's church, half each in a mixed marriage. */
export interface ChurchShare {
  /** Whose: p1, p2, or 'household' when both spouses (or the one adult) share one church. */
  person: ItemPerson;
  confession: Exclude<Confession, 'other' | 'none'>;
  /** The church area whose rate applies; null for the Christ Catholic rate (one for the canton). */
  area: string | null;
  /** Hundredths of a percent of the einfache Steuer. */
  rate: number;
  /** The share of the einfache Steuer it applies to, in percent: 100, or 50 in a mixed marriage. */
  share: 100 | 50;
}

/** The cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuer), named `icc`. */
export interface SgIccResult {
  items: Item[];
  /** 168 (7.), Total der Einkünfte. */
  grossIncome: Line;
  /** 230 (18.), Total der Abzüge. */
  totalDeductions: Line;
  /** 234 (20.), Nettoeinkommen: the base of the illness costs' excess and the donations' cap. */
  netIncomeBase: Line;
  /**
   * 21.1 as the return lays it out: the illness and accident costs you bore (650) and the excess of
   * 2 % of the Nettoeinkommen (238); 240 (the deduction) is among the items. Null without such costs.
   */
  medical: { costs: Line; threshold: Line } | null;
  /** 248 (22.), Reineinkommen: after every deduction except the social deductions. */
  netIncome: Line;
  /** 268 (24.), steuerbares Einkommen. */
  taxableIncome: Line;
  /** Vollsplitting: married couples and single parents (StG Art. 50 Abs. 3 and 4). */
  splitting: boolean;
  /** The income that sets the rate: the taxable income, or half of it rounded down to 100. */
  rateIncome: Line;
  wealth: {
    items: Item[];
    /** 322 (33.), Total der Vermögenswerte. */
    grossWealth: Line;
    /** 326 (35.), Reinvermögen. */
    netWealth: Line;
    /** 338 (37.), steuerbares Vermögen. */
    taxableWealth: Line;
  };
  taxes: {
    /** The einfache Steuer on income (StG Art. 50), at 100 percent. */
    simpleIncome: Line;
    /** The einfache Steuer on wealth (StG Art. 65), at 100 percent. */
    simpleWealth: Line;
    /** The cantonal tax on income: the einfache Steuer times the cantonal multiplier. */
    cantonalIncome: Line;
    /** The communal tax on income: the einfache Steuer times the commune's Gesamtsteuerfuss. */
    communalIncome: Line;
    cantonalWealth: Line;
    communalWealth: Line;
    /** The church tax on income and wealth, only when asked for and a member. */
    church: Line | null;
    churchShares: ChurchShare[];
    total: Line;
  };
}

/**
 * The federal direct tax (direkte Bundessteuer) the tax office derives from the same return
 * (./ifd.ts): the return's income lines, the federal deductions on the same lines (Merkblatt 32),
 * the total of the deductions (18.), the Nettoeinkommen (20.), the Reineinkommen (22.), and the
 * taxable income (24.) after the federal social deductions, which have no line of their own on the
 * return (`23.1-23.3`, one amount per child; `Ehepaare`, the married couple deduction).
 */
export interface SgIfdResult extends IfdResult {
  items: Item[];
  /** 18., Total der Abzüge, federal amounts. */
  totalDeductions: Line;
  /** 20., Nettoeinkommen, federal: the base of the shares of 21.1 and 21.3. */
  netIncomeBase: Line;
}

export interface SgTaxResult {
  canton: 'SG';
  taxYear: SgTaxYear;
  commune: CommuneRef;
  icc: SgIccResult | null;
  /**
   * The federal tax (packages/rules-ch's rules): St. Gallen's return has one column and the tax
   * office derives the federal tax from it (sg-2025-guide-wegleitung p. 49; the differences in
   * sg-2025-guide-merkblatt-dbst), so ./ifd.ts computes it on the return's own lines; null when not
   * computed.
   */
  ifd: SgIfdResult | null;
  /** The cantonal, communal (and church, when asked for) tax and the federal tax, when both are computed. */
  total: number | null;
  estimates: { id: string; what: Text }[];
  needsOk: number;
  complete: boolean;
  incomplete: Text[];
  assumptions: Text[];
  notCounted: Text[];
  unsupported: Text[];
  unverifiedRules: Text[];
  /** Every cap, threshold, minimum or flat-or-actual choice a rule applied, in both taxes. */
  limits: LimitApplied[];
}
