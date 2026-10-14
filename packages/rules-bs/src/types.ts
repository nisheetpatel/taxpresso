// The Basel-Stadt engine's input and result. Money is integer centimes everywhere. Field names
// follow the household input of packages/rules-ch (core/types.ts, HouseholdInput) wherever the
// concept is the same, so one ledger mapping can feed every canton (docs/design/cantons.md,
// section 2). Items carry the code of the line on the Basel-Stadt return (./rubrics.ts), deductions
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
import type { BsTaxYear } from './params.js';

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
  /** Box 10.2, pension fund buy-ins taken from the salary. */
  pensionBuyIn?: Amount;
  /** Box G: canteen or meal vouchers, so meals count at the reduced rate. */
  canteen?: boolean;
  /** Box F: transport to work provided, so no travel costs. */
  freeTransport?: boolean;
  /** A side job (Nebenerwerb, codes 110/115). */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /** 260/265: daily allowances of sickness, accident, disability, military or loss-of-earnings insurance. */
  replacementIncome?: Amount;
  /** 260/265: unemployment benefits (ALV), when not on a salary certificate. */
  unemploymentBenefits?: Amount;
  /** Self-employment: not supported (codes 150 to 175); given, the tax is not computed. */
  selfEmploymentProfit?: Amount;
  /** 200/205: AHV/IV pensions. */
  pensionAvs?: Amount;
  /** 220/225: pension fund pensions, the taxable amount. */
  pensionOccupational?: Amount;
  /** 240/245: other pensions, the taxable amount. */
  pensionOther?: Amount;
  /** 270: alimony received for oneself. */
  alimonyReceived?: Amount;
  /** 620/625: paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /** 620/625: pillar 3a catch-up payment (from tax year 2026, for gaps from 2025). */
  pillar3aCatchUp?: Amount;
  /** 610/615: pension fund buy-ins paid directly, besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund. Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /** 503: what public transport to work cost in the year (or would have cost, for a driver who could use it). */
  commuteCost?: Amount;
  /** 503: how the person got to work. */
  commuteMode?: CommuteMode;
  /** 504: working days with lunch away from home. */
  mealDays?: number;
  mealFacts?: readonly string[];
  /** 514: other actual professional costs (union dues, tools, books...). */
  otherProfessionalCosts?: Amount;
  /** 652/657: professional training paid. */
  trainingCosts?: Amount;
  /**
   * The work rate (Beschäftigungsgrad, Pensum) in percent, for the cantonal flat professional costs:
   * cut in proportion at 60 % or less (form B, code 500).
   */
  workRate?: number;
  /** Reached the AHV reference age by the end of the year (the deduction for single retirees, 770). */
  referenceAge?: boolean;
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
  /** Under 18 at the end of the year, for the wealth allowance per minor child (892). */
  minor?: boolean;
  /** 670: childcare paid for this child (form F asks it per child; the limit is per child). */
  childcare?: Amount;
}

export interface BsEngineInput {
  taxYear: BsTaxYear;
  /** Commune of residence on 31 December: Basel, Riehen or Bettingen. */
  commune: string;
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
   * The federal parental scale of a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24). The federal tax only.
   */
  ifdParentalScale?: boolean;
  /**
   * The return asks single parents (Hauptformular page 1, section 3): "Leben Sie in einer
   * Konkubinatspartnerschaft mit gemeinsamen / nicht gemeinsamen Kindern?"
   */
  cohabiting?: boolean;
  /**
   * A child in shared custody: whether you mainly bear its upkeep, with your own income and wealth
   * and the child support you are taxed on (StV § 42): it decides the deduction for single
   * parents, tariff B and the wealth allowance.
   */
  mainUpkeep?: boolean;
  /** Member of a recognised church: the church tax is not in this calculation. */
  church?: boolean;
  household?: {
    /**
     * 670: childcare paid for the household as a whole, when not given per child: it counts where
     * every split between the children gives the same deduction (the limit is per child).
     */
    childcare?: Amount;
    /**
     * 630 to 632, federal tax only: health and accident insurance premiums paid, the subsidy
     * received, life insurance premiums and savings interest. The cantonal deduction is a flat
     * amount whatever was paid (StG § 32 al. 1 lit. g); the federal one is what was paid, capped.
     */
    healthPremiums?: Amount;
    accidentPremiums?: Amount;
    healthSubsidy?: Amount;
    lifeInsurancePremiums?: Amount;
    savingsInterest?: Amount;
    /** 271: child support received for minor children. */
    childSupportReceived?: Amount;
    /** 280: other taxable income, as given. */
    otherIncome?: Amount;
    /** 725: illness and accident costs left to pay (Krankheits- und Unfallkosten). */
    medicalCosts?: Amount;
    /** 732: donations to tax-exempt Swiss organisations. */
    donations?: Amount;
    /** 680: payments to political parties. */
    politicalParty?: Amount;
    /** 560: alimony paid to a former spouse. */
    alimonyPaid?: Amount;
    /** 561: child support paid for minor children. */
    childSupportPaid?: Amount;
    /** 550: private debt interest paid. */
    debtInterest?: Amount;
    /** 870: private debts on 31 December. */
    debts?: Amount;
    /** Form W line 6: costs of keeping securities and accounts (Vermögensverwaltungskosten). */
    bankFees?: Amount;
    /** 835: cash, gold and other precious metals. */
    cash?: Amount;
    /** 815: life and annuity insurance, surrender value. */
    lifeInsuranceValue?: Amount;
    /** Vehicles, boats and collections: not supported yet; given, the tax is not computed. */
    vehicles?: Amount;
    /** 835: other assets (collections, rights), at market value. */
    otherAssets?: Amount;
  };
  /**
   * 800 and 369, accounts and securities (form W): value on 31 December and gross income. A minor
   * child's are declared with the parents (bs-2025-guide-wegleitung p. 7).
   */
  movable?: readonly { owner: MovableOwner; value?: Amount; income?: Amount }[];
}

export interface Item extends Line {
  /** The line's code on the Basel-Stadt return (./rubrics.ts). */
  code: string;
  person: ItemPerson;
  /**
   * The lines of an annex form that make up the item, in the column of the item's tax: form B
   * (Berufskosten) for a person's professional costs (519/539), form W (Wertschriftenverzeichnis)
   * for the accounts and securities (369, 800). What you type on the form, which carries its total
   * to the main form.
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
  /** No federal number: no document of the sources library gives one. */
  bfs: null;
  name: string;
  /** The commune's income tax multiplier, in hundredths of a percent of the cantonal tax; 0 in Basel. */
  rate: number;
}

/** The cantonal and communal tax (Kantons- und Gemeindesteuer), named `icc` as in every canton. */
export interface BsIccResult {
  items: Item[];
  /** 499, Total der Einkünfte. */
  grossIncome: Line;
  /** 709, Nettoeinkommen: income less the deductions 519 to 680. */
  netIncome: Line;
  /** 739, Reineinkommen: 709 less illness costs and donations. */
  pureIncome: Line;
  /** 799, Steuerbares Einkommen. */
  taxableIncome: Line;
  /** Tariff A (single) or B (married, single parents) for the income tax. */
  incomeTariff: 'A' | 'B';
  wealth: {
    items: Item[];
    /** 869, Total der Vermögenswerte. */
    grossWealth: Line;
    /** 889, Reinvermögen. */
    netWealth: Line;
    /** 899, Steuerbares Vermögen. */
    taxableWealth: Line;
    /** Tariff A or B for the wealth tax (single parents: always A). */
    tariff: 'A' | 'B';
  };
  taxes: {
    /** The income tax by the tariff (einfache Steuer, 100 %). */
    incomeTariffTax: Line;
    /** Kantonale Einkommenssteuer: all of it in Basel, the canton's share in Riehen and Bettingen. */
    cantonalIncome: Line;
    /** Gemeindesteuer on income: Riehen's or Bettingen's multiplier times the tariff tax; 0 in Basel. */
    communalIncome: Line;
    /** The wealth tax by the tariff. */
    wealthTariffTax: Line;
    /** The reduction for a low income (StG § 51), zero or negative. */
    wealthReduction: Line;
    cantonalWealth: Line;
    communalWealth: Line;
    total: Line;
  };
}

/**
 * The federal direct tax (direkte Bundessteuer), the Bund column of the Basel-Stadt return (main
 * form p. 2 and 3, from 369 down to 799): the same income lines, the federal deductions on the
 * Basel-Stadt lines (./ifd.ts).
 */
export interface BsIfdResult extends IfdResult {
  items: Item[];
  /** 699, Total der Abzüge, Bund (negative). */
  totalDeductions: Line;
  /** 709, Nettoeinkommen, Bund: the base of the illness costs and donations. */
  subtotal709: Line;
  /** 739, Reineinkommen, Bund: after the illness costs and donations (IfdResult's netIncome). */
  netIncome: Line;
}

export interface BsTaxResult {
  canton: 'BS';
  taxYear: BsTaxYear;
  commune: CommuneRef;
  icc: BsIccResult | null;
  /** The federal tax of the Bund column (./ifd.ts), when the cantonal tax is computed. */
  ifd: BsIfdResult | null;
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
