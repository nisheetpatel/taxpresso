// The Lucerne engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the Ziffer of the line on the Lucerne return (./rubrics.ts), deductions negative, income
// and assets positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { LuTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** The recognised churches with a church tax (StG § 240), as the return asks it ("Konfession"). */
export type Confession = 'catholic' | 'reformed' | 'christ_catholic' | 'none';

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
  /** Box G: canteen or meal vouchers, so meals count at half the rate (Ziffer 214/215). */
  canteen?: boolean;
  /** Box F: transport to work provided (or a company car), so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, Ziffer 104/105): its costs are the 20 % flat (236/237). */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 140/141: daily allowances (sickness, accident, maternity, EO) not paid through the employer. */
  replacementIncome?: Amount;
  /** 140/141: unemployment benefits paid directly. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported; given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 130/131: AHV/IV pensions, taxed at 100 %. */
  pensionAvs?: Amount;
  /** 132/133: pension fund pensions, the taxable amount. */
  pensionOccupational?: Amount;
  /** 136/137: other pensions, taxed at 100 % (not a life annuity, Leibrente: not supported). */
  pensionOther?: Amount;
  /** 160: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** Paid into pillar 3a in the year (260/261). */
  pillar3a?: Amount;
  /** Pillar 3a catch-up payment: no Lucerne document gives its rule; given, not computed. */
  pillar3aCatchUp?: Amount;
  /** 280/282: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** 202/203: yearly public transport cost, or what it would cost a driver who could use it. */
  commuteCost?: Amount;
  commuteMode?: CommuteMode;
  /** 212 to 215: working days with a main meal away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 220/221: actual other professional costs, used instead of the 3 % flat when higher. */
  otherProfessionalCosts?: Amount;
  /** 248/249: professional training paid, less what others paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child counts in full for you. 'shared': joint parental authority with a parent you
   * are not taxed with; who counts the child depends on child support (childSupport).
   */
  custody: 'full' | 'shared';
  /** Lives in your household (the family tariff, own care, childcare). Default true. */
  livesWithYou?: boolean;
  /** Not yet 14 at the end of the year: own care (353) and childcare (360). */
  under14?: boolean;
  /** 360: childcare by others paid for this child, because of work or education. */
  childcare?: Amount;
  /** 352: in education and staying away from home for it all the time. */
  away?: boolean;
}

export interface LuEngineInput {
  taxYear: LuTaxYear;
  /** Commune of residence on 31 December, by its name in the canton's table of units (StG § 237 Abs. 1). */
  commune: string;
  /** Registered partners are 'married' (lu-2025-guide-wegleitung p. 20: "Verheiratet / eingetragene Partnerschaft"). */
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
   * Shared custody without child support, a child living with you: whether the family tariff is
   * yours, by the guide's rules (you care for the children longer, or as long and earn more; living
   * with the other parent, you bear more of their costs).
   */
  familyTariff?: boolean;
  /**
   * Opt-in church tax: each taxpayer's confession, and each child's in the order of `children` (the
   * return asks every one, Ziffer 2 and 3). Undefined: not asked.
   */
  church?: {
    p1?: Confession;
    p2?: Confession;
    children?: readonly (Confession | undefined)[];
  };
  household?: {
    /** 270: health insurance premiums paid (the premium subsidy given apart or netted). */
    healthPremiums?: Amount;
    /** 270: private accident insurance premiums. */
    accidentPremiums?: Amount;
    /** 270: life insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 270: interest on savings (it is income too: include it in `movable`). */
    savingsInterest?: Amount;
    /** 270: premium subsidy received (Prämienverbilligung), when not netted from the premiums. */
    healthSubsidy?: Amount;
    /** 320: medical costs left to pay. */
    medicalCosts?: Amount;
    /** 324: donations to tax-exempt Swiss organisations. */
    donations?: Amount;
    /** 325: payments to political parties. */
    politicalParty?: Amount;
    /** 254: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 255: child support paid, up to the child's 18th birthday. */
    childSupportPaid?: Amount;
    /** 161: child support received. */
    childSupportReceived?: Amount;
    /** 252: private debt interest paid. */
    debtInterest?: Amount;
    /** 462: private debts on 31 December. */
    debts?: Amount;
    /** Wertschriftenverzeichnis Ziffer 6: actual costs of keeping securities, when above the flat. */
    bankFees?: Amount;
    /** 166: other taxable income, as given. */
    otherIncome?: Amount;
    /** 404: cash, gold and other precious metals. */
    cash?: Amount;
    /** 410: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 412: vehicles, at their tax value. */
    vehicles?: Amount;
    /** 416: other assets. */
    otherAssets?: Amount;
  };
  /**
   * Accounts and securities (Wertschriftenverzeichnis): value on 31 December and gross income; a
   * minor child's are declared by the parents (lu-2025-guide-wegleitung p. 15 and 19).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The Ziffer on the Lucerne return (./rubrics.ts). */
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
  /** The canton's table carries no federal commune number. */
  bfs: null;
  name: string;
  /** The commune's units (Einwohnergemeinde), in ten-thousandths. */
  rate: number;
}

/** The state, communal and church tax (Staats-, Gemeinde- und Kirchensteuern), named `icc`. */
export interface LuIccResult {
  items: Item[];
  /** 301: Total der Einkünfte. */
  grossIncome: Line;
  /** 302: Total der Abzüge (negative). */
  totalDeductions: Line;
  /** 310: Nettoeinkommen, the base of the medical costs and donations. */
  incomeAfterDeductions: Line;
  /** 320 to 326: the additional deductions (negative). */
  additionalDeductions: Line;
  /** 330: Reineinkommen, the base of the degressive social deduction. */
  netIncome: Line;
  /** 340 to 370: the social deductions (negative). */
  socialDeductions: Line;
  /** 380: Steuerbares Einkommen. */
  taxableIncome: Line;
  /** § 57 Abs. 1 (single persons) or Abs. 2 (families). */
  tariff: 'single' | 'family';
  wealth: {
    items: Item[];
    /** 450: Total der Vermögenswerte. */
    grossWealth: Line;
    /** 470: Reinvermögen. */
    netWealth: Line;
    /** 480: Steuerbares Vermögen. */
    taxableWealth: Line;
  };
  taxes: {
    /** Steuer je Einheit on income (§ 57) and on wealth (§ 60), and their sum. */
    incomePerUnit: Line;
    wealthPerUnit: Line;
    perUnit: Line;
    /** Staatssteuer: the tax per unit times the state's units. */
    cantonal: Line;
    /** Gemeindesteuer: the tax per unit times the commune's units. */
    communal: Line;
    /** Kirchensteuer, only when asked for. */
    church: Line | null;
    /** The cut of the income tax and of the wealth tax by the Höchstbelastung (§ 62), when it applies. */
    incomeCap: Line | null;
    wealthCap: Line | null;
    /** Personalsteuer (§ 232). */
    personal: Line;
    total: Line;
  };
}

export interface LuTaxResult {
  canton: 'LU';
  taxYear: LuTaxYear;
  commune: CommuneRef;
  icc: LuIccResult | null;
  /**
   * The federal tax is packages/rules-ch's. The Lucerne return has no federal column: the
   * authority derives it (an optional Ergänzungsblatt states the differences), so `ifd` is null.
   */
  ifd: null;
  /** The state, communal (and church, when asked for) tax and the Personalsteuer, when computed. */
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
