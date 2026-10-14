// The Zurich engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed both cantons (docs/design/cantons.md, section 2). Items
// carry the line code printed on the Zurich return (StA Form. 300, zh-2025-form-steuererklaerung-
// hauptformular), deductions negative, income and assets positive.
// The shapes every canton shares (Text, Amount, Line, the way to work) are packages/rules-ch's.
import type {
  Amount,
  CommuteMode,
  EnginePerson,
  IfdResult,
  LimitApplied,
  Line,
  Text,
} from '@taxpresso/rules-ch';
import type { ZhTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** Whose an item is in Zurich: taxpayer A (p1), B (p2) or the household. */
export type ItemPerson = EnginePerson | 'household';

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
  /** Box G: canteen or meal vouchers, so meals count at the reduced rate. */
  canteen?: boolean;
  /** Box F: free transport to work, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, line 102/103): its costs are the 20 % flat, nothing else. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 142/143: daily allowances not paid through the employer (sickness, accident, maternity). */
  replacementIncome?: Amount;
  /** 140/141: unemployment benefits paid directly. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (Hilfsblatt A); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 130/131: AHV/IV pensions. */
  pensionAvs?: Amount;
  /** 134/136: pension fund pensions, taken at 100 %. */
  pensionOccupational?: Amount;
  /** 135/137: other pensions, taken at 100 %. */
  pensionOther?: Amount;
  /** 160: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 260/261: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 280: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** Yearly public transport pass (Abonnement), or what it would cost a driver who could use it. */
  commuteCost?: Amount;
  commuteMode?: CommuteMode;
  /** Working days with a main meal away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** Actual other professional costs, used instead of the 3 % flat when higher (to be proven). */
  otherProfessionalCosts?: Amount;
  /** 292: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child counts in full for you. 'shared': joint parental authority with a parent
   * you are not taxed with; who counts it depends on child support (childSupport).
   */
  custody: 'full' | 'shared';
  /** Lives with you (370 and the married tariff) or not (372). Default true. */
  livesWithYou?: boolean;
  /** Under 14 at year end, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** 376: childcare paid for this child. */
  childcare?: Amount;
}

/** The three churches with a Zurich church tax (Kirchensteuer, StG § 201). */
export type Confession = 'reformed' | 'catholic' | 'christ_catholic' | 'none';

export interface ZhEngineInput {
  taxYear: ZhTaxYear;
  /** Commune of residence on 31 December, by its BFS number (StG § 190). */
  commune: number;
  /**
   * 1, 2 or 3: which of the commune's multipliers applies, for the communes whose parts have
   * different ones (two school districts, for example). Needed only there.
   */
  communeVariant?: number;
  /** Registered partners are 'married' here (Weisung ZStB 34.1, Rz 52). */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint authority: child support for the children.
   * 'receives': they count in full here; 'pays': they count for the other parent; 'none': half
   * each, and the married tariff goes to the parent who mainly supports them (marriedTariff).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /** Shared custody without child support: true when you mainly support the children. */
  marriedTariff?: boolean;
  /**
   * Federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24, ch. 13.4.2). Unknown, the federal
   * tax is not computed.
   */
  ifdParentalScale?: boolean;
  /** Opt-in church tax, by person; with two parishes in the commune, which one (1 or 2). */
  church?: { p1?: Confession; p2?: Confession; parish?: number };
  household?: {
    /** 601: health insurance premiums paid, after any premium subsidy. */
    healthPremiums?: Amount;
    /** 602: private accident insurance premiums. */
    accidentPremiums?: Amount;
    /** 603: life and annuity insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 604: interest on savings (it is income too: include it in `movable`). */
    savingsInterest?: Amount;
    /** 605: premium subsidy received, when not already netted from the premiums. */
    healthSubsidy?: Amount;
    /** 320: medical costs left to pay. */
    medicalCosts?: Amount;
    /** 324: donations to tax-exempt Swiss organisations. */
    donations?: Amount;
    /** 376: childcare paid for the children, when not given per child. */
    childcare?: Amount;
    /** 284: payments to political parties. */
    politicalParty?: Amount;
    /** 254: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 255: child support paid, up to the month the child turns 18. */
    childSupportPaid?: Amount;
    /** 161: child support received, up to the month the child turns 18. */
    childSupportReceived?: Amount;
    /** 250: private debt interest paid. */
    debtInterest?: Amount;
    /** 470: private debts on 31 December. */
    debts?: Amount;
    /** 283: costs of having securities managed by third parties, as admitted. */
    bankFees?: Amount;
    /** 163: other taxable income, as given. */
    otherIncome?: Amount;
    /** 404: cash, gold and other precious metals. */
    cash?: Amount;
    /** 406: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 412: vehicles. */
    vehicles?: Amount;
    /** 416: other assets. */
    otherAssets?: Amount;
  };
  /** Accounts and securities (Wertschriftenverzeichnis): 400 value on 31 December, 150 income. */
  movable?: readonly { owner: ItemPerson; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line code printed on the return, e.g. '220'. */
  code: string;
  person: ItemPerson;
  /**
   * The lines of an annex form that make up the item (Berufsauslagen 201 to 237 for 220 and 240,
   * Versicherungsprämien 601 to 616 for 270), in whole francs, for the values to type.
   */
  parts?: readonly ItemPart[];
}

/** A line of an annex form: its code as printed and its amount in centimes (whole francs). */
export interface ItemPart {
  code: string;
  amount: number;
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
  /** The multiplier used, in percent of the einfache Staatssteuer; null until its part is known. */
  rate: number | null;
}

/** The cantonal and communal tax (Staats- und Gemeindesteuern), named `icc` as in rules-ge. */
export interface ZhIccResult {
  items: Item[];
  /** 199, Total der Einkünfte. */
  grossIncome: Line;
  /** 299, Total der Abzüge (negative). */
  totalDeductions: Line;
  /** 310, Nettoeinkommen: the base for medical costs and donations. */
  subtotal310: Line;
  /** 350, Reineinkommen: after every deduction except the social deductions. */
  netIncome: Line;
  /** 390, steuerbares Einkommen. */
  taxableIncome: Line;
  /** Grundtarif or Verheiratetentarif (StG § 35, § 47). */
  tariff: 'basic' | 'married';
  wealth: {
    items: Item[];
    /** 460, Total der Vermögenswerte. */
    grossWealth: Line;
    /** 490, steuerbares Vermögen. */
    taxableWealth: Line;
  };
  taxes: {
    /** Einfache Staatssteuer on income and on wealth, and their sum. */
    simpleIncome: Line;
    simpleWealth: Line;
    simple: Line;
    /** Staatssteuer: the simple tax times the cantonal multiplier. */
    cantonal: Line;
    /** Gemeindesteuer: the simple tax times the commune's multiplier. */
    communal: Line;
    /** Kirchensteuer, only when asked for. */
    church: Line | null;
    /** Personalsteuer. */
    personalTax: Line;
    total: Line;
  };
}

/** The Bundessteuer column of the Zurich return: the federal tax (packages/rules-ch). */
export interface ZhIfdResult extends IfdResult {
  items: Item[];
  /** 299, Total der Abzüge, federal (negative). */
  totalDeductions: Line;
  /** 310, Nettoeinkommen, federal: the base of the federal medical costs and donations. */
  subtotal310: Line;
}

export interface ZhTaxResult {
  canton: 'ZH';
  taxYear: ZhTaxYear;
  commune: CommuneRef;
  icc: ZhIccResult | null;
  /** The federal direct tax, the Bundessteuer column (./ifd.ts); null when not computed. */
  ifd: ZhIfdResult | null;
  /** The cantonal and communal tax plus the federal tax, when both are computed. */
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
