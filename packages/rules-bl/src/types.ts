// The Basel-Landschaft engine's input and result. Money is integer centimes everywhere. Field names
// follow the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the
// concept is the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section
// 2). Items carry the code of the line on the Basel-Landschaft return (./rubrics.ts), deductions
// negative, income and assets positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { BlTaxYear } from './params.js';

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
  /** Box 10.2, pension fund buy-ins taken from the salary (the net salary is after them). */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so lunch counts at half (510/515). */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, 110/115), whose costs are the 20 % flat amount (530/535). */
  side?: boolean;
}

/** The kind of first pillar pension, for the pensioners' deduction of 2026 (770 AHV, 771 IV). */
export type PensionKind = 'ahv' | 'iv';

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 260/270: daily allowances of sickness, accident, military or loss-of-earnings insurance. */
  replacementIncome?: Amount;
  /** 260/270: unemployment benefits not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (150 to 165); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 200/205: AHV/IV pensions. Receiving them makes you a pensioner for 770/771. */
  pensionAvs?: Amount;
  /** For 2026: whether pensionAvs is an AHV (old-age) or an IV (disability) pension. */
  pensionKind?: PensionKind;
  /** 220/225: pension fund pensions, the taxable amount. */
  pensionOccupational?: Amount;
  /** 230/235: other pensions, the taxable amount (for a life annuity, its taxable income share). */
  pensionOther?: Amount;
  /** 310: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 610/615: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 610/615: pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 600/605: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /**
   * 500/505: what public transport to work cost in the year, or for a car or a motorbike when
   * public transport could be used, what it would have cost.
   */
  commuteCost?: Amount;
  /** 500/505: how the person got to work. */
  commuteMode?: CommuteMode;
  /** 510/515: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /**
   * 520/525: professional costs proven on top of the canton's CHF 500 flat amount: work clothes,
   * professional literature, professional association dues, a study at home.
   */
  otherProfessionalCosts?: Amount;
  /** 650: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child is in your care alone (or with your spouse). 'shared': joint parental
   * authority with a parent you are not taxed with; who counts the child depends on child support.
   */
  custody: 'full' | 'shared';
  /** Lives in your household (häusliche Gemeinschaft). Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 640: childcare paid for this child. */
  childcare?: Amount;
  /**
   * The child's own taxable income is above the tax-free limit (StG § 34 Abs. 4): then no child
   * reduction for it. Default false, and the result says so.
   */
  ownIncome?: boolean;
}

/** The three recognised churches (Landeskirchen); 'none' for anyone else. */
export type Confession = 'catholic' | 'reformed' | 'christCatholic' | 'none';

export interface BlEngineInput {
  taxYear: BlTaxYear;
  /** Commune of residence on 31 December, by its name or slug (the tables carry no BFS number). */
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
  /** Opt-in church tax (Kirchensteuer): each adult's church. */
  church?: { p1?: Confession; p2?: Confession };
  household?: {
    /** 320: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 380: other taxable income, as given. */
    otherIncome?: Amount;
    /** 720: illness and accident costs left to pay (Krankheits- und Unfallkosten). */
    medicalCosts?: Amount;
    /** 738: donations to tax-exempt Swiss organisations and public bodies. */
    donations?: Amount;
    /** 735: payments to political parties. */
    politicalParty?: Amount;
    /** 570: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 575: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 555: private debt interest paid (no mortgage: property is not supported). */
    debtInterest?: Amount;
    /** 891: private debts on 31 December. */
    debts?: Amount;
    /** 655: costs of keeping securities and accounts (Vermögensverwaltung). */
    bankFees?: Amount;
    /** 805: cash, gold and other precious metals. */
    cash?: Amount;
    /** 810: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 815: vehicles, boats and caravans, at the guide's share of their new value. */
    vehicles?: Amount;
    /** 825: other assets (collections, works of art, jewellery), at market value. */
    otherAssets?: Amount;
  };
  /**
   * 800 and 300, accounts and securities: value on 31 December and gross income. A minor child's
   * are taxed with the parents (StG § 9 Abs. 1).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Basel-Landschaft return (./rubrics.ts). */
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
  /** The commune's Steuerfuss, in hundredths of a percent of the state tax. */
  rate: number;
}

/** The state, communal and church tax (Staats-, Gemeinde- und Kirchensteuer), named `icc`. */
export interface BlIccResult {
  items: Item[];
  /** 499, Total der Einkünfte. */
  grossIncome: Line;
  /** 499 less the deductions 500 to 738, before the social deductions (760 to 771). */
  netIncome: Line;
  /** 789, Total der Abzüge. */
  totalDeductions: Line;
  /** 790, steuerbares Einkommen. */
  taxableIncome: Line;
  /** Vollsplitting: married couples and single parents (StG § 34 Abs. 2). */
  splitting: boolean;
  /** The income that sets the rate (satzbestimmendes Einkommen). */
  rateIncome: Line;
  /** The rate applied, a fraction; 0 under the tax-free limit. */
  rate: number;
  wealth: {
    items: Item[];
    /** 885, Total der Vermögenswerte. */
    grossWealth: Line;
    /** 899, Reinvermögen. */
    netWealth: Line;
    /** 910, steuerbares Vermögen. */
    taxableWealth: Line;
  };
  taxes: {
    /** The income tax of the tariff (Steuerbetrag). */
    incomeTariffTax: Line;
    /** The child reduction (Kinderabzug vom Steuerbetrag), zero or negative. */
    childReduction: Line;
    /** The normal state tax on income: the tariff tax less the child reduction. */
    normalIncome: Line;
    /** The state tax on income: the normal state tax times the cantonal multiplier. */
    cantonalIncome: Line;
    /** The communal tax on income: the normal state tax times the commune's Steuerfuss. */
    communalIncome: Line;
    /** The state tax on wealth. */
    cantonalWealth: Line;
    /** The communal tax on wealth: the state tax times the commune's Steuerfuss. */
    communalWealth: Line;
    /** The church tax, only when asked for and a member. */
    church: Line | null;
    total: Line;
  };
}

export interface BlTaxResult {
  canton: 'BL';
  taxYear: BlTaxYear;
  commune: CommuneRef;
  icc: BlIccResult | null;
  /**
   * The federal tax is packages/rules-ch's; Basel-Landschaft's result shows it once the federal
   * column of the Basel-Landschaft return is mapped (docs/design/cantons.md, section 6).
   */
  ifd: null;
  /** The state, communal (and church, when asked for) tax, when computed. */
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
