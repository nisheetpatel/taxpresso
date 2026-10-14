// The Geneva engine's input and result (SPEC.md section 7). Money is integer centimes everywhere.
// Items are identified by their official rubric code (code de rubrique) and person, the way the
// assessment (avis de taxation) lists them: deductions are negative, income and assets positive.
// The shapes every canton shares (amounts, lines, items, the household's facts, the federal tax)
// are in packages/rules-ch (core/types.ts); Geneva's input is the household input without the facts
// only Zurich reads, plus the splitting and the état des titres.
import type {
  Amount,
  CantonalResult,
  CapitalTax,
  CivilStatus,
  ChildInput as HouseholdChild,
  EmploymentInput as HouseholdEmployment,
  EnginePerson,
  HouseholdAmounts,
  IfdResult as FederalResult,
  Item,
  LimitApplied,
  Line,
  MovableAsset,
  PartYearKind,
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
  CapitalTax,
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
  /**
   * Boxes 3 to 7 of the certificate added up: pay that is not monthly salary (non-periodic pay,
   * capital, participations, board fees, other benefits). Read only for a year of arrival or
   * departure, where it isn't converted to a year (./part-year.ts).
   */
  nonPeriodic?: Amount;
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

/** Why a lump sum was paid, as its attestation says (capital.reason; ch-na-law-opp3 art. 3). */
export type CapitalReason = 'retirement' | 'home' | 'self_employment' | 'leaving' | 'other';

/**
 * A lump sum from the 2nd pillar (pension fund, vested benefits) or pillar 3a (prestation en
 * capital, 98.12), one per attestation: taxed apart (ge-na-law-lipp art. 45; ch-na-law-lifd art. 38).
 */
export interface CapitalBenefitInput {
  /** Usually the attestation's document id. */
  id?: string;
  person: EnginePerson;
  pillar: 'pillar2' | 'pillar3a';
  amount: Amount;
  /** The date it was paid, YYYY-MM-DD: it counts for that year (ch-na-law-lifd art. 38 al. 1bis). */
  date?: string;
  /** Why it was paid (motif du versement), when read on the attestation. */
  reason?: CapitalReason;
}

/** The household's lump sums of the year and what decides whether Taxpresso can tax them. */
export interface CapitalInput {
  benefits: readonly CapitalBenefitInput[];
  /** The people whose salary is taxed at source: not supported (ge-2026-source-directives p. 11). */
  atSource?: readonly EnginePerson[];
  /** The household arrived from abroad during the year: not supported. */
  arrivedFromAbroad?: boolean;
  /** The household left Switzerland during the year: not supported. */
  leftSwitzerland?: boolean;
}

/**
 * A home or land abroad (immeuble à l'étranger, annexe D), the simple case: one property, owned by
 * one spouse or both, used by the household (or kept for its use or its family's), let to tenants,
 * or land with no home on it. Taxed where it lies; Geneva and the federal tax count it only for the
 * rate (./abroad.ts). Amounts in francs, converted at the official rates (from-ledger).
 */
export interface AbroadPropertyInput {
  /** Whose it is: one spouse, or both ('household'). */
  owner: EnginePerson | 'household';
  /** own_use: 15.10, rental value; let: 15.20, rents; land: 15.20, no income. */
  use: 'own_use' | 'let' | 'land';
  /** The country's name in French, as the form's Situation asks ("nom du pays"). */
  country?: Text;
  /** In France, the rental value comes from the taxe d'habitation or the taxes foncières. */
  france?: boolean;
  /** Its value on 31 December: the tax value set by the country, else the purchase price. */
  value?: Amount;
  valueBasis?: 'tax_value' | 'purchase_price' | 'estimate';
  /** Own use: the rental value the country sets (France: the taxe d'habitation's, or twice the taxes foncières' base). */
  rentalValue?: Amount;
  rentalBasis?: 'country' | 'france_habitation' | 'france_land_tax';
  /** Let: the rents received in the year. */
  rents?: Amount;
  /** Let: the actual upkeep, insurance and management costs of the year. */
  costs?: Amount;
  /** The building was more than 10 years old on 1 January: the flat upkeep rates. */
  old?: boolean;
  /** What puts the household outside the simple case, read from the answers (fail closed). */
  unsupported?: readonly Text[];
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
  /**
   * Parts of the household the engine can't compute (self-employment beyond the simple case, read
   * from the answers): when there are any, neither tax is computed (fail closed), and each says why.
   */
  unsupported?: readonly Text[];
  /** Lump sums from the 2nd pillar and pillar 3a, taxed apart (./capital.ts). */
  capital?: CapitalInput;
  /** A home or land abroad: exempt, counted for the rate (./abroad.ts). */
  abroad?: AbroadPropertyInput;
  /**
   * A year of arrival from abroad or of departure abroad: the day it happened (the first or the
   * last day of tax liability). The amounts given are those of the period; the taxes are on them,
   * at the rate of a full year's income (./part-year.ts).
   */
  period?: PeriodInput;
}

/** The day the household arrived from abroad, or left Switzerland, in the tax year. */
export interface PeriodInput {
  kind: PartYearKind;
  /** YYYY-MM-DD, in the tax year. */
  date: string;
}

/**
 * A year of arrival from abroad or of departure abroad, in the result (./part-year.ts): the period
 * of tax liability, and in each tax computed the form's lines for the rate (ge-2025-declaration-
 * specimen p. 3): 95.00 "le cas échéant, revenu net pour le taux", the year's total net income;
 * 97.00, what of it is not taxed here (99.00, the taxable income, is the period's).
 */
export interface PartYearResult {
  kind: PartYearKind;
  /** The first and last day of tax liability, YYYY-MM-DD. */
  from: string;
  to: string;
  /** Days of tax liability, 30 to a month. */
  days: number;
  icc?: { rateTotal: Line; notTaxed: Line };
  ifd?: { rateTotal: Line; notTaxed: Line };
}

/**
 * The cantonal and communal tax on pension capital (ge-na-law-lipp art. 45): the scale at the rate
 * of the whole amount (with the splitting of art. 41 al. 2 to 4), a fifth of it, then the cantonal
 * centimes, the 12 % reduction, the home care centime and the commune's centimes, as on income.
 */
export interface CapitalIcc {
  splitting: IccSplitting;
  /** The amount the rate is read at: all of it, or 50 % or 55.56 % of it with splitting. */
  rateIncome: Line;
  /** The scale's base tax on the whole amount, at that rate. */
  scaleTax: Line;
  /** A fifth of it: the base tax on the capital (art. 45 al. 2). */
  base: Line;
  cantonalCentimes: Line;
  reduction12: Line;
  homeCare: Line;
  cantonal: Line;
  /** The commune of residence's centimes on the base. */
  communal: Line;
  tax: Line;
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
  /**
   * 97.00 part proportionnelle du revenu non imposable: with a property abroad, the share of the
   * total net income (95.00, then the income for the rate) not taxed in Geneva.
   */
  exemptIncome?: Line;
  splitting: IccSplitting;
  /** Revenu déterminant le taux. */
  rateIncome: Line;
  wealth: {
    items: Item[];
    grossWealth: Line;
    netWealth: Line;
    socialDeduction: Item;
    /** 95.00 fortune nette totale, with a property abroad: the wealth for the rate. */
    rateWealth?: Line;
    /** 97.00 part proportionnelle de la fortune non-imposable. */
    exemptWealth?: Line;
    /** 99.00 fortune imposable. */
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
  /** 97.00 with a property abroad: the part of the total net income not taxed in Switzerland. */
  exemptIncome?: Line;
  /**
   * With a property abroad: the tax on 99.00 at the rate of the whole income (LIFD art. 7). In a
   * year of arrival or departure: the tax on 99.00 at the rate of a full year's income (art. 40).
   */
  atRate?: Line;
}

/**
 * A property abroad in the result: its lines on annexe D and how it was split, for the copy
 * panel, the final check and the explanations. Absent without one.
 */
export interface AbroadResult {
  /** Whose it is, how it is used, and its country, as the input said. */
  owner: AbroadPropertyInput['owner'];
  use: AbroadPropertyInput['use'];
  country?: Text;
  /** Its income and costs, per tax (15.10 or 15.20, 58.00), and its value (wealth). */
  icc: Item[];
  ifd: Item[];
  wealth: Item[];
  /** The debts and debt interest that go abroad, in proportion to the gross assets. */
  debts?: Line;
  interestIcc?: Line;
  interestIfd?: Line;
  /** The share of the gross assets abroad, in basis points, for the words. */
  shareBp: number;
}

export interface TaxResult extends SharedTaxResult<IccResult> {
  taxYear: TaxYear;
  commune: CommuneSlug;
  ifd: IfdResult | null;
  /** ICC (cantonal and communal) plus IFD, when both are computed; not the tax on pension capital. */
  total: number | null;
  /** The separate tax on pension capital (98.12), when the household received some (./capital.ts). */
  capital?: CapitalTax<CapitalIcc>;
  /** Every cap, threshold, minimum and flat-or-actual choice applied, in the order computed. */
  limits: LimitApplied[];
  /**
   * Annexe B, one sheet per self-employed person: the lines the form adds up itself (12.17, 12.45,
   * 12.46, 57.00, 12.52, 32.00) with the ones the return carries. Absent without self-employment.
   */
  business?: BusinessSheet[];
  /** A home or land abroad, counted for the rate (./abroad.ts). Absent without one. */
  abroad?: AbroadResult;
  /** A year of arrival from abroad or of departure abroad (./part-year.ts). Absent otherwise. */
  partYear?: PartYearResult;
}

/** One sheet of annexe B, for one person: its lines per column, in the form's order. */
export interface BusinessSheet {
  person: EnginePerson;
  /** "1. Revenu" (ICC) of B2 and B4. */
  icc: Item[];
  /** "2. Revenu" (IFD) of B2 and B4. */
  ifd: Item[];
  /** "3. Fortune" (ICC) of B2, and the deduction 51.60 of PG4. */
  wealth: Item[];
}

export type { EstimateReason, Text };
