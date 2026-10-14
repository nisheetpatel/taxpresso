// The Geneva engine's input and result (SPEC.md section 7). Money is integer centimes everywhere.
// Items are identified by their official rubric code (code de rubrique) and person, the way the
// assessment (avis de taxation) lists them: deductions are negative, income and assets positive.
// The shapes every canton shares (amounts, lines, items, the household's facts, the federal tax)
// are in packages/rules-ch (core/types.ts); Geneva's input is the household input without the facts
// only Zurich reads, plus the splitting and the état des titres.
import type {
  CantonalResult,
  CivilStatus,
  ChildInput as HouseholdChild,
  EmploymentInput as HouseholdEmployment,
  HouseholdAmounts,
  IfdResult as FederalResult,
  Item,
  LimitApplied,
  Line,
  MovableAsset,
  PersonInput as HouseholdPerson,
  TaxResult as SharedTaxResult,
  Text,
} from '@taxpresso/rules-ch';
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import type { EstimateReason } from './param.js';
import type { TaxYear } from './params.js';

export type {
  Amount,
  CommuteMode,
  EnginePerson,
  EstimateNote,
  InputStatus,
  Item,
  ItemAmount,
  ItemPerson,
  LimitApplied,
  Line,
  MovableAsset,
} from '@taxpresso/rules-ch';

/** One salary certificate (certificat de salaire), as Geneva reads it. */
export interface EmploymentInput extends Omit<HouseholdEmployment, 'workCommune' | 'side'> {
  /** Commune where the work is done; default the commune of residence. 'outside': outside Geneva. */
  workCommune?: CommuneSlug | 'outside';
}

/**
 * One taxpayer, as Geneva reads them. Rubrics: 11.10 salaries, 11.50 benefits replacing salary,
 * 12.01 self-employment, 17.10 AVS/AI pensions, 13.20 pension fund pensions, 13.40 other pensions,
 * 13.10 alimony received, 31.40 pillar 3a (and its catch-up), 31.30 buy-ins, 31.60 meals, 31.63
 * other actual costs, 59.50 training (ge-2025-guide-declaration-pp p. 17 to 22).
 */
export interface PersonInput extends Omit<HouseholdPerson, 'employments' | 'unemploymentBenefits'> {
  employments?: readonly EmploymentInput[];
}

/** A dependent child, as Geneva reads them (59.10 / 59.12 childcare). */
export type ChildInput = Omit<HouseholdChild, 'livesWithYou'>;

/**
 * The household's amounts Geneva reads. Rubrics: 52.21 health premiums, 52.22 accident premiums,
 * 16.30 subsidy, 52.11 life insurance, 56.30 savings interest, 71.00 medical costs, 73.10 / 73.20
 * donations, 74.00 parties, 53.10 alimony paid, 55.00 debt interest and debts, 56.20 bank costs
 * (guide p. 40 and 43), 16.40 cash, precious metals and other assets.
 */
export type GenevaHousehold = Omit<
  HouseholdAmounts,
  | 'childSupportPaid'
  | 'childSupportReceived'
  | 'otherIncome'
  | 'cash'
  | 'lifeInsuranceValue'
  | 'vehicles'
>;

/**
 * The securities list (état des titres) and the other movable wealth, as the securities rules
 * compute them (./../2026/etat-des-titres.ts, WealthItem): one amount per rubric, part and person.
 */
export interface WealthItemInput {
  code: string;
  part: 'income' | 'deduction' | 'wealth' | 'wealth_deduction' | 'credit';
  person: 'p1' | 'p2' | 'household';
  centimes: number;
  taxes: readonly ('icc' | 'ifd')[];
  /** Includes estimates or values waiting for the user's OK. */
  estimate: boolean;
  /** False when some contributing amount is unknown: the amount is then a floor. */
  complete: boolean;
  label: Text;
  source: string;
}

export interface EngineInput {
  taxYear: TaxYear;
  /** Commune of residence on 31 December. */
  commune: CommuneSlug;
  /** Registered partners are 'married' here (LIPP art. 8, LIFD art. 9). */
  civilStatus: CivilStatus;
  people: readonly PersonInput[];
  /** Dependent children (family charges). */
  children?: readonly ChildInput[];
  /** Override the ICC splitting derived from the household. */
  splitting?: IccSplitting;
  /**
   * A parent without a partner sharing custody: child support (contribution d'entretien) for the
   * children. 'receives': the children count in full here (child deductions, splitting, parental
   * scale); 'pays': they count for the other parent; 'none': half each, and the parental scale goes
   * to the parent who earns more (ifdParentalScale). ch-na-circulaire-30-epoux-famille p. 24, 32
   * and 33 (ch. 13.4.2, 14.4, 14.5); ge-2025-guide-declaration-pp p. 45 and 46.
   */
  childSupport?: 'receives' | 'pays' | 'none';
  /**
   * Federal parental scale for a parent sharing custody without child support: true when this
   * parent earns more (ch-na-circulaire-30-epoux-famille p. 24, ch. 13.4.2; p. 32, ch. 14.4.2).
   * Unknown, the federal tax is not computed.
   */
  ifdParentalScale?: boolean;
  household?: GenevaHousehold;
  /** Bank accounts and securities, per owner (when the état des titres is not given). */
  movable?: readonly MovableAsset[];
  /**
   * The état des titres and other movable wealth by rubric (14.00, 16.40, 16.70, 52.11, 55.10,
   * 56.20, 56.30, credits F1.IA and F1.IES). When given, it is the only source of these amounts.
   */
  wealthItems?: readonly WealthItemInput[];
}

export interface CommunalShare {
  commune: CommuneSlug;
  /** Part of the base tax this commune taxes. */
  base: Line;
  /** The commune's centimes, in hundredths (45.49 -> 4549). */
  rate: number;
  tax: Line;
}

export interface CommunalSplit {
  /** The commune of residence, on its privileged share. */
  privileged: CommunalShare & { sharePercent: number };
  /** The rest: the commune of residence and, for salaries earned elsewhere in Geneva, the commune of work. */
  rest: CommunalShare[];
}

export interface IccTaxes {
  incomeBase: Line;
  incomeCantonalCentimes: Line;
  incomeReduction12: Line;
  incomeHomeCare: Line;
  incomeCantonal: Line;
  wealthBase: Line;
  wealthCantonalCentimes: Line;
  wealthHomeCare: Line;
  wealthSupplementary: Line;
  wealthCantonal: Line;
  communalIncome: CommunalSplit;
  communalWealth: CommunalSplit;
  communalIncomeTotal: Line;
  communalWealthTotal: Line;
  personalTax: Line;
  total: Line;
}

export interface IccResult extends CantonalResult {
  items: Item[];
  /** 91.00, revenu brut total. */
  grossIncome: Line;
  /** 92.20, the base for the medical costs threshold. */
  subtotal9220: Line;
  /** 92.40, the base for donations. */
  subtotal9240: Line;
  /** Revenu net: after every deduction except the social deductions (61.xx). */
  netIncome: Line;
  /** 95.00 revenu net total: after the social deductions. */
  totalIncome: Line;
  /** 99.00 revenu imposable. */
  taxableIncome: Line;
  splitting: IccSplitting;
  /** Revenu déterminant le taux. */
  rateIncome: Line;
  wealth: {
    items: Item[];
    grossWealth: Line;
    netWealth: Line;
    socialDeduction: Item;
    taxableWealth: Line;
  };
  taxes: IccTaxes;
  /**
   * Credits shown on the bordereau, not part of the tax: the Swiss withholding tax claimed back
   * (impôt anticipé) and the foreign tax credit (DA-1), the imputations of the état des titres.
   */
  credits: { withholdingTax?: Line; foreignTax?: Line };
}

/** The federal tax on the Geneva form: its subtotals 92.20, 92.40 and 95.00 too. */
export interface IfdResult extends FederalResult {
  subtotal9220: Line;
  subtotal9240: Line;
  totalIncome: Line;
}

export interface TaxResult extends SharedTaxResult<IccResult> {
  taxYear: TaxYear;
  commune: CommuneSlug;
  ifd: IfdResult | null;
  /** ICC (cantonal and communal) plus IFD, when both are computed. */
  total: number | null;
  /** Every cap, threshold, minimum and flat-or-actual choice applied, in the order computed. */
  limits: LimitApplied[];
}

export type { EstimateReason, Text };
