// The Zug engine's input and result. Money is integer centimes everywhere. Field names follow the
// household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is the
// same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the code of the line on Zug's main form K (./rubrics.ts), deductions negative, income and
// assets positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { ZgTaxYear } from './params.js';

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

/** Whose accounts and securities: a person, the household, or a minor child (StG § 8 Abs. 3). */
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
  /** Box G: canteen or meal vouchers, so lunch counts at half. */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, 105/106), whose costs are the side job's flat amount. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 145/146: daily allowances of sickness, accident or loss-of-earnings insurance. */
  replacementIncome?: Amount;
  /** 150/151: unemployment benefits (Taggelder aus Arbeitslosenversicherung). */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (115/116); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 130/131: AHV/IV pensions. Receiving them gives the pensioners' deduction (406). */
  pensionAvs?: Amount;
  /** 135/136: pension fund pensions, the taxable amount. */
  pensionOccupational?: Amount;
  /** 135/136: other pensions (orphans', SUVA...), the taxable amount. */
  pensionOther?: Amount;
  /** 170: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 220/221: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 220/221: pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 250/251: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /**
   * 201/202, travel: what public transport to work cost in the year, or for a car or a motorbike
   * when public transport could be used, what it would have cost.
   */
  commuteCost?: Amount;
  /** 201/202, travel: how the person got to work. */
  commuteMode?: CommuteMode;
  /** 201/202, meals: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 201/202: the actual other professional costs, all of them, when higher than the flat amount. */
  otherProfessionalCosts?: Amount;
  /** 245/246: professional training paid. */
  trainingCosts?: Amount;
}

export interface ChildInput {
  /**
   * 'full': the child is in your care alone (or with your spouse). 'shared': joint parental
   * authority with a parent you are not taxed with; who counts the child depends on child support.
   */
  custody: 'full' | 'shared';
  /** Lives in your household. Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare by others (253). Default true when childcare is given. */
  under14?: boolean;
  /** Under 15 on 31 December: own care (404) instead of the extra child deduction (403a). */
  under15?: boolean;
  /** A minor on 31 December: the tax-free wealth per child (673). */
  minor?: boolean;
  /** 253: childcare by others paid for this child. */
  childcare?: Amount;
}

/** The two recognised churches (StG § 1 Abs. 1, § 169); 'none' for anyone else. */
export type Confession = 'catholic' | 'reformed' | 'none';

export interface ZgEngineInput {
  taxYear: ZgTaxYear;
  /** Commune of residence on 31 December, by its name or slug (the table carries no BFS number). */
  commune: string;
  /** Registered partners are 'married'; separated spouses are taxed apart, like 'single'. */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint parental authority: child support for the
   * children. 'receives': they count here; 'pays': they count for the other parent; 'none': they
   * count for the parent with the larger share of their care (`mainCare`).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /** Shared custody without child support: whether you have the larger share of the children's care. */
  mainCare?: boolean;
  /** 407: the year's net rent (without service charges) of the home you live in, in Zug. */
  rent?: Amount;
  /** Opt-in church tax (Kirchensteuer): each adult's church. */
  church?: { p1?: Confession; p2?: Confession };
  /**
   * Opt-in Bürgergemeinde tax: the Zug commune whose Ortsbürger (citizen) each adult is, or null
   * for none (StG § 170).
   */
  citizenOf?: { p1?: string | null; p2?: string | null };
  household?: {
    /** 230: health insurance premiums paid (less any subsidy given in healthSubsidy). */
    healthPremiums?: Amount;
    /** 230: private accident and loss-of-earnings premiums. */
    accidentPremiums?: Amount;
    /** 230: health insurance subsidy received (Prämienverbilligung), taken off the premiums. */
    healthSubsidy?: Amount;
    /** 230: life insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 230: interest on savings. */
    savingsInterest?: Amount;
    /** 171: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 173: other taxable income, as given. */
    otherIncome?: Amount;
    /** 295: illness and accident costs left to pay (Krankheits- und Unfallkosten). */
    medicalCosts?: Amount;
    /** 296: donations to tax-exempt Swiss organisations and public bodies. */
    donations?: Amount;
    /** 252: payments to political parties. */
    politicalParty?: Amount;
    /** 210: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 211: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 205: private debt interest paid (no mortgage: property is not supported). */
    debtInterest?: Amount;
    /** 640: private debts on 31 December. */
    debts?: Amount;
    /** 255: costs of keeping securities and accounts (Vermögensverwaltung), as admitted. */
    bankFees?: Amount;
    /** 601: cash, gold and other precious metals. */
    cash?: Amount;
    /** 603: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 604: vehicles, at the guide's share of their purchase price. */
    vehicles?: Amount;
    /** 606: other assets (jewellery, collections), at market value. */
    otherAssets?: Amount;
  };
  /** 600 and 160, accounts and securities: value on 31 December and gross income. */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on Zug's form K (./rubrics.ts). */
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
  /** The commune's Steuerfuss, in hundredths of a percent of the einfache Steuer. */
  rate: number;
}

/** The cantonal, communal, church and Bürgergemeinde tax, named `icc`. */
export interface ZgIccResult {
  items: Item[];
  /** 190 (285), Total Einkünfte. */
  grossIncome: Line;
  /** 280 (286), Total Abzüge. */
  totalDeductions: Line;
  /** 287, Zwischentotal: the base of the shares of 295 and 296. */
  subtotal: Line;
  /** 299, Reineinkommen: before the social deductions. */
  netIncome: Line;
  /** 490, steuerbares Einkommen gesamt. */
  taxableIncome: Line;
  /** The Mehrpersonentarif (married couples, single parents) or the Grundtarif. */
  tariff: 'single' | 'married';
  wealth: {
    items: Item[];
    /** 630, Total der Vermögenswerte. */
    grossWealth: Line;
    /** 660, Reinvermögen. */
    netWealth: Line;
    /** 690, steuerbares Gesamtvermögen. */
    taxableWealth: Line;
  };
  taxes: {
    /** The einfache Steuer on income (100 %). */
    simpleIncome: Line;
    /** The einfache Steuer on wealth (100 %). */
    simpleWealth: Line;
    /** Their total, which every Steuerfuss is applied to. */
    simple: Line;
    /** The canton's tax (Kantonssteuer). */
    cantonal: Line;
    /** The commune's tax (Gemeindesteuer). */
    communal: Line;
    /** The church tax, only when asked for and a member. */
    church: Line | null;
    /** The Bürgergemeinde's tax, only when asked for and an Ortsbürger of one that levies it. */
    citizens: Line | null;
    total: Line;
  };
}

export interface ZgTaxResult {
  canton: 'ZG';
  taxYear: ZgTaxYear;
  commune: CommuneRef;
  icc: ZgIccResult | null;
  /**
   * The federal tax is packages/rules-ch's; Zug's result shows it once the federal column of form
   * K is mapped (docs/design/cantons.md, section 6).
   */
  ifd: null;
  /** The cantonal and communal tax (and church and Bürgergemeinde tax, when asked for). */
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
