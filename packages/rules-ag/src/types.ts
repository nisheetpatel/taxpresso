// The Aargau engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the code of the line on the Aargau return (./rubrics.ts), deductions negative, income and
// assets positive.
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
import type { AgTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  LimitApplied,
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
  /** Box G: canteen or meal vouchers, so meals count at half the rate (guide 10.2). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs (guide 10.1). */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, 1.2): its costs are the 20 % flat (10.6), at most its income. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 3: daily allowances (Taggelder) and loss-of-earnings benefits not on the salary certificate. */
  replacementIncome?: Amount;
  /** 3: unemployment benefits not on the salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported; given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 3: AHV/IV pensions, taxed at 100 %. */
  pensionAvs?: Amount;
  /** 3: pension fund pensions, the taxable amount (100 %, or 80 % for old pensions, guide 3). */
  pensionOccupational?: Amount;
  /** 3: other pensions, the taxable amount (for a life annuity, its income share). */
  pensionOther?: Amount;
  /** 5.1: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** Paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** Pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 13.1: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /** 10.1: yearly public transport cost, or what it would cost a driver who could use it. */
  commuteCost?: Amount;
  commuteMode?: CommuteMode;
  /** 10.2: working days with a main meal away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 10.3: actual other professional costs, used instead of the 3 % flat when higher. */
  otherProfessionalCosts?: Amount;
  /** 15.5: professional training paid, less what others paid. */
  trainingCosts?: Amount;
}

/** The child deduction's age band at the end of the year (StG § 42 Abs. 1 lit. a). */
export type ChildBand = 'under14' | 'under18' | 'adult';

export interface ChildInput {
  /**
   * 'full': the child counts for you. 'shared': parental authority shared with a parent you are not
   * taxed with; who counts the child depends on child support (childSupport, mainUpkeep).
   */
  custody: 'full' | 'shared';
  /** Lives in your household (Tarif B, childcare). Default true. */
  livesWithYou?: boolean;
  /**
   * Under 14 at the end of the year (child deduction under 14 and childcare), 14 to 17, or of age
   * and in education whose upkeep you mainly bear. Needed for the child deduction.
   */
  band?: ChildBand;
  /** Under 14, for childcare. Default from `band`, else true when childcare is given. */
  under14?: boolean;
  /** 15.0: childcare paid for this child. */
  childcare?: Amount;
}

export interface AgEngineInput {
  taxYear: AgTaxYear;
  /** Commune of residence on 31 December, by its name in the canton's list (StG § 157). */
  commune: string;
  /** Registered partners are 'married' (ag-2025-guide-wegleitung p. 44). */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, shared authority: child support for the children.
   * 'receives': they count here; 'pays': they count for the other parent; 'none': they count for the
   * parent who mainly bears their upkeep (mainUpkeep).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /** Shared authority without child support: you mainly bear the children's upkeep. */
  mainUpkeep?: boolean;
  /**
   * The federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24). Unknown, the federal tax is not
   * computed.
   */
  ifdParentalScale?: boolean;
  /**
   * Opt-in church tax, by person; where the commune has a further parish of your church
   * (Zusatzkirche), the parish: its name as the canton's list prints it, or the commune's name for
   * the commune's own parish.
   */
  church?: { p1?: Confession; p2?: Confession; parish?: string };
  /**
   * The household's amounts. Insurance premiums, savings interest and premium subsidies count for
   * the federal tax only: the cantonal deduction for them is a flat amount whatever was paid (14;
   * StG § 40 Abs. 1 lit. g).
   */
  household?: {
    /**
     * 15.0: childcare paid for the household as a whole (the invoices of a crèche, say), when not
     * given per child: it counts where one child's limit settles it (./compute.ts).
     */
    childcare?: Amount;
    /**
     * Federal tax only: health and accident insurance premiums paid, the premium subsidy received,
     * life insurance premiums and savings interest (LIFD art. 33 al. 1 let. g). The cantonal tax
     * deducts its flat amount whatever was paid (14).
     */
    healthPremiums?: Amount;
    accidentPremiums?: Amount;
    healthSubsidy?: Amount;
    lifeInsurancePremiums?: Amount;
    savingsInterest?: Amount;
    /** 17.1: medical, accident and dental costs left to pay. */
    medicalCosts?: Amount;
    /** 15.3: donations to tax-exempt organisations. */
    donations?: Amount;
    /** 15.2: payments to political parties (one maximum per return). */
    politicalParty?: Amount;
    /** 12.1: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 12.2: child support paid, up to the month the child turns 18. */
    childSupportPaid?: Amount;
    /** 5.2: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 11: private debt interest paid. */
    debtInterest?: Amount;
    /** 34: private debts on 31 December. */
    debts?: Amount;
    /** 15.4: costs of managing securities and accounts, as admitted. */
    bankFees?: Amount;
    /** 5.5: other taxable income, as given. */
    otherIncome?: Amount;
    /** 20.2: cash, gold and other precious metals. */
    cash?: Amount;
    /** 20.3: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 20.5: private vehicles, at their tax value (a share of the list price by year, guide 20.5). */
    vehicles?: Amount;
    /** 20.6: other assets at market value. */
    otherAssets?: Amount;
  };
  /**
   * Accounts and securities (20.1, income 4): value on 31 December and gross income. A minor child's
   * are declared by the parents (ag-2025-guide-wegleitung p. 44).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Aargau return (./rubrics.ts). */
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
  /** The canton's list carries no BFS number. */
  bfs: null;
  name: string;
  /** The commune's Steuerfuss for natural persons, in percent of the einfache Steuer. */
  rate: number;
}

/** The cantonal, communal and church tax (Kantons-, Gemeinde- und Kirchensteuern), named `icc`. */
export interface AgIccResult {
  items: Item[];
  /** Total der Einkünfte. */
  grossIncome: Line;
  /** The deductions 10 to 18 (negative). */
  totalDeductions: Line;
  /** Reineinkommen (StG § 34): the base of the Höchstbelastung. */
  netIncome: Line;
  /** The child deductions (Sozialabzüge, § 42 Abs. 1; negative). */
  socialDeductions: Line;
  /** Reineinkommen less the Sozialabzüge (Ziffer 23): the base of the low-income deduction. */
  afterSocial: Line;
  /** Steuerbares Einkommen (Ziffer 25). */
  taxableIncome: Line;
  /** Tarif A, or Tarif B: the rate of half the income (§ 43 Abs. 2). */
  tariff: 'A' | 'B';
  wealth: {
    items: Item[];
    /** Total of the assets. */
    grossWealth: Line;
    /** Steuerbares Vermögen (Ziffer 37): after debts and the steuerfreie Beträge. */
    taxableWealth: Line;
  };
  taxes: {
    /** Einfache Steuer on income and on wealth, and their sum. */
    simpleIncome: Line;
    simpleWealth: Line;
    simple: Line;
    /** Kantonssteuer: the einfache Steuer times the canton's Steuerfuss. */
    cantonal: Line;
    /** Gemeindesteuer: the einfache Steuer times the commune's Steuerfuss. */
    communal: Line;
    /** Kirchensteuer, only when asked for. */
    church: Line | null;
    /** The cut by the Höchstbelastung (§ 56), when it applies. */
    maxBurden: Line | null;
    total: Line;
  };
}

/**
 * The federal direct tax (direkte Bundessteuer) of an Aargau household (./ifd.ts): the return has
 * no federal column, the tax office replaces the cantonal deductions by the federal ones
 * (ag-2025-guide-wegleitung p. 42), so each federal deduction stands on the Aargau line of the same
 * concept, the federal-only ones on lines of their own.
 */
export interface AgIfdResult extends IfdResult {
  items: Item[];
  /** The federal deductions before the medical costs and donations, added up. */
  totalDeductions: Line;
  /**
   * The net income before the medical costs and donations (Form. 2a, chiffre 20): the base of the
   * medical threshold and the donations cap.
   */
  baseIncome: Line;
}

export interface AgTaxResult {
  canton: 'AG';
  taxYear: AgTaxYear;
  commune: CommuneRef;
  icc: AgIccResult | null;
  /** The federal tax (./ifd.ts, packages/rules-ch's rules), or null with why in `unsupported`. */
  ifd: AgIfdResult | null;
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
