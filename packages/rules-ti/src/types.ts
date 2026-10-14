// The Ticino engine's input and result. Money is integer centimes everywhere. Field names follow
// the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the concept is
// the same, so one ledger mapping can feed every canton (docs/design/cantons.md, section 2). Items
// carry the number of the line (cifra) on the Ticino return, Modulo 1 (./rubrics.ts), and the
// person; deductions are negative, income and assets positive.
import type { Amount, CommuteMode, EnginePerson, Line, Text } from '@taxpresso/rules-ch';
import type { TiTaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  InputStatus,
  Line,
  Text,
} from '@taxpresso/rules-ch';

/** Whose an item is: the taxpayer (p1), the spouse or registered partner (p2), or the household. */
export type ItemPerson = EnginePerson | 'household';

/** Whose accounts and securities: a person, the household, or a minor child (declared with the parents). */
export type MovableOwner = ItemPerson | `child${number}`;

/** One salary certificate (certificato di salario). */
export interface EmploymentInput {
  id?: string;
  /** Box 8, gross salary. */
  gross: Amount;
  /** Box 9, AVS/AI/IPG/AD/AINP contributions. */
  socialContributions?: Amount;
  /** Box 10.1, ordinary pension fund contributions. */
  pensionFund?: Amount;
  /** Box 10.2, pension fund buy-ins taken from the salary: they go on cifra 10.3. */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so meals count at half the rate. */
  canteen?: boolean;
  /** Box F: transport to work provided, so no transport costs. */
  freeTransport?: boolean;
  /** A side job (attività accessoria, cifra 1.2). */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 3.5: daily allowances of sickness and accident insurance, when not on a salary certificate. */
  replacementIncome?: Amount;
  /** 3.4: unemployment benefits and other loss-of-earnings allowances, when not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (cifra 2); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 3.2: AVS and AI pensions. */
  pensionAvs?: Amount;
  /** 3.1: pensions of the pension fund and of pillar 3a. */
  pensionOccupational?: Amount;
  /** 3.3: life annuities (their taxable part) and other pensions. */
  pensionOther?: Amount;
  /** 3.6: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 11.1/11.2: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 10.3: pillar 3a catch-up payment (from tax year 2026). */
  pillar3aCatchUp?: Amount;
  /** 10.3: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1 or 10.2. */
  hasPensionFund?: boolean;
  /** Modulo 4, 2.1: what public transport to work cost in the year (or would have cost, for a driver who could use it). */
  commuteCost?: Amount;
  /** Modulo 4, 2: how the person got to work. */
  commuteMode?: CommuteMode;
  /** Modulo 4, 3.1: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** Modulo 4, 5.2: other actual professional costs (tools, books...), instead of the flat amount. */
  otherProfessionalCosts?: Amount;
  /** 15.3/15.4: professional training paid. */
  trainingCosts?: Amount;
  /**
   * The work rate (grado di occupazione) in percent: under 50 %, the flat amount for other
   * professional costs is halved (Modulo 4, cifra 1).
   */
  workRate?: number;
  /**
   * Months worked in the year (1 to 12): under 6, the flat amount is halved; for part of the year,
   * the deduction is in proportion (Modulo 4, cifra 1). Not given: the whole year, said in the result.
   */
  monthsWorked?: number;
}

export interface ChildInput {
  /**
   * 'full': the child counts in full for you. 'shared': joint parental authority with a parent you
   * are not taxed with; who counts the child depends on child support.
   */
  custody: 'full' | 'shared';
  /** Lives in your household. Default true. */
  livesWithYou?: boolean;
  /** Under 14, for childcare. Default true when childcare is given. */
  under14?: boolean;
  /** Under 18 at the end of the year, for the wealth deduction per minor child (35.2). */
  minor?: boolean;
  /** 20: childcare paid for this child. */
  childcare?: Amount;
}

export interface TiEngineInput {
  taxYear: TiTaxYear;
  /** Commune of residence on 31 December, by its name in the official table of multipliers. */
  commune: string;
  /** Registered partners are 'married'; separated spouses are taxed apart, like 'single'. */
  civilStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
  people: readonly PersonInput[];
  children?: readonly ChildInput[];
  /**
   * A parent not taxed with the other parent, joint parental authority: child support for the
   * children. 'receives': they count in full here; 'pays': they count for the other parent; 'none':
   * the child deduction is shared half and half (LT art. 34 cpv. 1 lett. a).
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Widowed, divorced or separated during the tax year: the family tariff applies for that year
   * (LT art. 35 cpv. 5).
   */
  changedThisYear?: boolean;
  household?: {
    /** 12 (Modulo 6, 1.a): health insurance premiums paid for the household. */
    healthPremiums?: Amount;
    /** 12 (Modulo 6, 1.b and 1.e): private accident and loss-of-earnings insurance premiums. */
    accidentPremiums?: Amount;
    /** Health insurance subsidy received: Modulo 6 takes the premiums net of it. */
    healthSubsidy?: Amount;
    /** 12 (Modulo 6, 1.c): life and annuity insurance premiums. */
    lifeInsurancePremiums?: Amount;
    /** 12 (Modulo 6, 1.d): interest on savings. */
    savingsInterest?: Amount;
    /** 3.6: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 6.3: other taxable income, as given. */
    otherIncome?: Amount;
    /** 22.1: illness and accident costs left to pay. */
    medicalCosts?: Amount;
    /** 24: donations to tax-exempt bodies. */
    donations?: Amount;
    /** 15.2: payments to political parties. */
    politicalParty?: Amount;
    /** 14.1: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 14.2: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 13.2: private debt interest paid. */
    debtInterest?: Amount;
    /** 33.1: private debts on 31 December. */
    debts?: Amount;
    /** 13.1: actual costs of keeping securities (spese di amministrazione dei titoli). */
    bankFees?: Amount;
    /** 29.2: cash, gold and other precious metals. */
    cash?: Amount;
    /** 29.3: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** 29.4: motor vehicles, market value. */
    vehicles?: Amount;
    /** 29.5: other assets (boats, collections...), at market value. */
    otherAssets?: Amount;
  };
  /**
   * 29.1 and 4.1, accounts and securities (Modulo 2): value on 31 December and gross income. A
   * minor child's are declared with the parents (ti-2025-guide-istruzioni-pf-pdf p. 33).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's number (cifra) on the Ticino return, Modulo 1 (./rubrics.ts). */
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
  /** No federal number: the official table of multipliers carries none. */
  bfs: null;
  /** As the official table prints it. */
  name: string;
  /** The commune's multiplier for natural persons, in hundredths of a percent of the cantonal base tax. */
  rate: number;
}

/** The cantonal and communal tax (imposta cantonale e comunale), named `icc` as in every canton. */
export interface TiIccResult {
  items: Item[];
  /** 8, Totale dei redditi. */
  grossIncome: Line;
  /** 16, Totale delle deduzioni (9 to 15.5). */
  totalDeductions: Line;
  /** 19, Reddito netto I: 8 less 16. */
  netIncome: Line;
  /** 21, Reddito netto intermedio II: 19 less childcare (20). */
  netIncome2: Line;
  /** 23, Reddito netto intermedio III: 21 less illness costs (22.1). */
  netIncome3: Line;
  /** 26, the net income after donations (24) and the social deductions (25). */
  netIncome4: Line;
  /** 28, Reddito imponibile: 26 less the AVS/AI exemption (27). */
  taxableIncome: Line;
  /** The income tariff: LT art. 35 cpv. 1 (single) or cpv. 2 (spouses and families). */
  incomeTariff: 'single' | 'family';
  wealth: {
    items: Item[];
    /** 32, the total of the assets. */
    grossWealth: Line;
    /** 34, Sostanza netta: 32 less the debts (33.1). */
    netWealth: Line;
    /** 36, Sostanza imponibile: 34 less the social deductions (35.1, 35.2). */
    taxableWealth: Line;
  };
  taxes: {
    /** The cantonal base tax on income (imposta cantonale base), by the tariff. */
    incomeBase: Line;
    /** The cantonal base tax on wealth. */
    wealthBase: Line;
    /** Cantonal income tax: the base tax times the cantonal coefficient. */
    cantonalIncome: Line;
    /** Cantonal wealth tax: the base tax times the cantonal coefficient. */
    cantonalWealth: Line;
    /** Communal income tax: the base tax times the commune's multiplier. */
    communalIncome: Line;
    /** Communal wealth tax: the base tax times the commune's multiplier. */
    communalWealth: Line;
    /** The communal personal tax (imposta personale), per adult. */
    personal: Line;
    total: Line;
  };
}

export interface TiTaxResult {
  canton: 'TI';
  taxYear: TiTaxYear;
  commune: CommuneRef;
  icc: TiIccResult | null;
  /**
   * The federal tax is packages/rules-ch's. The Ticino return has no federal column: the tax
   * authority derives the federal tax from the cantonal return (ti-2025-guide-istruzioni-pf-pdf
   * p. 5), so the result leaves it to the federal engine.
   */
  ifd: null;
  /** The cantonal and communal tax with the personal tax, when computed. */
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
