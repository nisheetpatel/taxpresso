// The shapes every canton's engine shares (SPEC.md section 7, docs/design/cantons.md section 2).
// Money is integer centimes everywhere. Items are identified by the line code printed on the
// canton's form and the person, deductions negative, income and assets positive.
//
// The household input (HouseholdInput) is the union of the facts the cantons' engines read: a field
// that only one canton reads says so, and an adapter refuses a fact its canton does not read
// (packages/rules-<c>/src/canton.ts), so nothing given is silently left out.

/**
 * Plain words for the user, in English and French; official terms appear in parentheses. German
 * where a canton gives it (Zurich's form terms); elsewhere the English text stands in.
 */
export interface Text {
  en: string;
  fr: string;
  de?: string;
}

export type EnginePerson = 'p1' | 'p2';
/** Whose an item is: taxpayer A (p1), B (p2), a child, or the household as a whole. */
export type ItemPerson = EnginePerson | 'household' | `child${number}`;

/** How sure a value given to the engine is (SPEC.md section 4 statuses). */
export type InputStatus = 'verified' | 'stated' | 'extracted' | 'estimate';

/** A money input, with where it came from. */
export interface Amount {
  /** Centimes, zero or more. */
  value: number;
  /** Default 'stated'. 'estimate' is flagged; 'extracted' still needs the user's OK. */
  status?: InputStatus;
  /** Ledger fact ids behind the value. */
  facts?: readonly string[];
  /** False when part of the amount is unknown: it is then a floor, and so is what rests on it. */
  complete?: boolean;
}

/**
 * The way to work, for travel costs (frais de déplacement, Fahrkosten): ch-2026-ifd-instructions-
 * personnes-physiques p. 6, ge-2025-guide-declaration-pp p. 19 to 22.
 */
export interface CommuteMode {
  /** bike: bike, e-bike or moped with a yellow plate; motorbike: white plate. */
  by: 'public_transport' | 'car' | 'motorbike' | 'bike' | 'walk' | 'home';
  /** Car or motorbike: whether public transport could have been used for the trip. */
  transitUsable?: boolean;
  /** Car or motorbike without usable public transport: kilometres one way, and days driven. */
  kmOneWay?: number;
  days?: number;
  status?: InputStatus;
  facts?: readonly string[];
}

/** One salary certificate (certificat de salaire, Lohnausweis: federal form 11). */
export interface EmploymentInput {
  /** Usually the certificate's document id. */
  id?: string;
  /** Box 8, total gross salary. */
  gross: Amount;
  /** Box 9, AVS/AI/APG/AC/AANP contributions. */
  socialContributions?: Amount;
  /** Box 10.1, ordinary pension fund (2nd pillar) contributions. */
  pensionFund?: Amount;
  /** Box 10.2, pension fund buy-in taken from the salary. */
  pensionBuyIn?: Amount;
  /** Box G ticked: canteen or meal vouchers (meal deduction halved). */
  canteen?: boolean;
  /** Box F ticked: free transport to work (no commuting deduction). */
  freeTransport?: boolean;
  /**
   * Geneva: the commune where the work is done, by its slug; default the commune of residence.
   * 'outside': outside Geneva. It splits the communal tax (LCP art. 295A).
   */
  workCommune?: string;
  /** Zurich: a side job (Nebenerwerb, line 102/103), whose costs are the 20 % flat only. */
  side?: boolean;
}

export interface PersonInput {
  id: EnginePerson;
  employments?: readonly EmploymentInput[];
  /**
   * Benefits replacing salary not paid through the employer. Geneva (11.50): unemployment, APG,
   * sickness, accident. Zurich (142/143): daily allowances, without unemployment benefits.
   */
  replacementIncome?: Amount;
  /** Zurich (140/141): unemployment benefits paid directly. Geneva counts them in replacementIncome. */
  unemploymentBenefits?: Amount;
  /** Net income from self-employment, as given (accounts not computed here). */
  selfEmploymentProfit?: Amount;
  /** AVS/AI pensions. */
  pensionAvs?: Amount;
  /** Pensions from a pension fund. */
  pensionOccupational?: Amount;
  /** Other pensions. */
  pensionOther?: Amount;
  /** Alimony received for oneself. */
  alimonyReceived?: Amount;
  /** Paid into pillar 3a in the year. */
  pillar3a?: Amount;
  /**
   * Geneva: 3a catch-up payment (rachat 3a, from tax year 2026), on top of the yearly limit; its own
   * limits are checked by the planner (ch-2026-ifd-instructions-personnes-physiques p. 8).
   */
  pillar3aCatchUp?: Amount;
  /** Pension fund buy-ins paid directly (attestations), besides box 10.2. */
  pensionBuyIn?: Amount;
  /** Member of a pension fund (2nd pillar). Default: when a certificate shows box 10.1. */
  hasPensionFund?: boolean;
  /**
   * Yearly cost of getting to work as an amount: the public transport paid, or for a driver who
   * could have used public transport, what it would have cost (Form. 2a 2026 p. 6).
   */
  commuteCost?: Amount;
  /** How the person got to work, when that, not an amount, sets the travel costs. */
  commuteMode?: CommuteMode;
  /** Working days with a main meal away from home. */
  mealDays?: number;
  /** The facts behind mealDays. */
  mealFacts?: readonly string[];
  /** Other actual professional costs (union dues, tools...). */
  otherProfessionalCosts?: Amount;
  /** Professional training paid. */
  trainingCosts?: Amount;
  /** Geneva: for the health premium limit, 'young' is 19 to 25, 'adult' 26 and over (default). */
  age?: 'young' | 'adult';
  /**
   * Geneva: the cantonal meal deduction is allowed, the trip to work by public transport taking more
   * than 2 hours a day (ge-2025-guide-declaration-pp p. 19).
   */
  mealsIccAllowed?: boolean;
}

export interface ChildInput {
  /** 'shared': alternating custody or joint authority shared with the other parent. */
  custody: 'full' | 'shared';
  /** Under 14 for the childcare deduction. Default true when childcare costs are given. */
  under14?: boolean;
  /** Childcare costs paid for this child. */
  childcare?: Amount;
  /** Geneva: for the health premium limit; default 'child' (0 to 18). */
  age?: 'child' | 'young' | 'adult';
  /** Zurich: lives with you (370 and the married tariff) or not (372). Default true. */
  livesWithYou?: boolean;
}

/** Bank accounts and securities, summed per owner. */
export interface MovableAsset {
  owner: ItemPerson;
  /** Taxable value on 31 December. */
  value?: Amount;
  /** Gross income (interest, dividends). */
  income?: Amount;
  /** Geneva: Swiss withholding tax (impôt anticipé) retained, for the credit. */
  withholdingSwiss?: Amount;
}

/** Amounts of the household as a whole. */
export interface HouseholdAmounts {
  /** Health insurance premiums paid for everyone in the household (any subsidy given apart). */
  healthPremiums?: Amount;
  /** Private accident and loss-of-earnings premiums. */
  accidentPremiums?: Amount;
  /** Health insurance subsidy received. */
  healthSubsidy?: Amount;
  /** Life insurance premiums. */
  lifeInsurancePremiums?: Amount;
  /** Interest on savings (accounts, bonds). */
  savingsInterest?: Amount;
  /** Medical costs left to pay. */
  medicalCosts?: Amount;
  /** Donations to charities. */
  donations?: Amount;
  /** Payments to political parties. */
  politicalParty?: Amount;
  /** Alimony paid. */
  alimonyPaid?: Amount;
  /** Private debt interest paid. */
  debtInterest?: Amount;
  /** Private debts on 31 December. */
  debts?: Amount;
  /** Costs of keeping securities and accounts, as admitted. */
  bankFees?: Amount;
  /** Other assets: cash, precious metals and the like in Geneva (16.40); others in Zurich (416). */
  otherAssets?: Amount;
  /** Geneva: childcare paid for the household when not given per child. */
  childcare?: Amount;
  /** Zurich (255): child support paid, up to the month the child turns 18. */
  childSupportPaid?: Amount;
  /** Zurich (161): child support received, up to the month the child turns 18. */
  childSupportReceived?: Amount;
  /** Zurich (163): other taxable income, as given. */
  otherIncome?: Amount;
  /** Zurich (404): cash, gold and other precious metals. */
  cash?: Amount;
  /** Zurich (406): life and annuity insurance, surrender value. */
  lifeInsuranceValue?: Amount;
  /** Zurich (412): vehicles. */
  vehicles?: Amount;
}

/** Registered partners are 'married' (LIFD art. 9 al. 1bis, and every canton's law). */
export type CivilStatus = 'single' | 'married' | 'separated' | 'divorced' | 'widowed';

/**
 * The household for one tax year, as every canton's engine reads it (CantonRules.computeReturn).
 * What only one canton asks for (Geneva: splitting, the état des titres; Zurich: the commune's
 * part, the church tax) is under `cantonal`, typed by that canton.
 */
export interface HouseholdInput<Cantonal = unknown> {
  taxYear: number;
  /** Commune of residence on 31 December: Geneva's slug, or the BFS number (Zurich). */
  commune: string | number;
  civilStatus: CivilStatus;
  people: readonly PersonInput[];
  /** Dependent children (family charges). */
  children?: readonly ChildInput[];
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
  household?: HouseholdAmounts;
  movable?: readonly MovableAsset[];
  cantonal?: Cantonal;
}

/** A computed figure with its explanation. */
export interface Line {
  amount: number;
  label: Text;
  /** How it was computed, in plain words, with the numbers. */
  how: Text;
  /** Official sources: manifest id plus page, article or paragraph. */
  sources: string[];
  /** Why it is an estimate, if it is one (constants not yet published, inputs given as estimates). */
  estimates?: string[];
  /** Depends on a value that still needs the user's OK. */
  needsOk?: boolean;
  /** Rests on an amount known only in part: a floor, not a final figure. */
  incomplete?: boolean;
  facts?: string[];
}

export interface Item extends Line {
  /** The line code printed on the canton's form, e.g. '31.10' in Geneva, '220' in Zurich. */
  code: string;
  person: ItemPerson;
}

/** Just what the assessment shows for an item: enough to recompute the taxes. */
export interface ItemAmount {
  code: string;
  person: ItemPerson;
  amount: number;
}

export interface EstimateNote {
  id: string;
  what: Text;
}

/**
 * A cap, a threshold or a minimum a rule applied to an amount the user gave, or the switch between
 * the flat deduction and the actual costs. Every one applied is listed, whatever the distance; the
 * final check keeps those at or near their limit (SPEC.md 10.0).
 */
export interface LimitApplied {
  /** The line code as printed for this person (31.40 for A, 41.40 for B in Geneva). */
  code: string;
  person: ItemPerson;
  /** The tax it is applied in; 'both' when the same rule and amount serve the two. */
  tax: 'icc' | 'ifd' | 'both';
  /**
   * cap: at most `limit` is deducted. threshold: only the part above `limit` counts (medical
   * costs). minimum: nothing counts under `limit` (federal donations). choice: the flat deduction
   * (`limit`) or the actual costs (`given`), whichever is higher.
   */
  kind: 'cap' | 'threshold' | 'minimum' | 'choice';
  /** What was given before the rule, in centimes: paid, the costs, the actual costs. */
  given: number;
  /** The limit as applied, in centimes. */
  limit: number;
  /** What the line gets, in centimes (zero or more). */
  counted: number;
  /** The rule that sets the limit: manifest id plus page or article. */
  source: string;
  /** The limit itself is an estimate (a constant not published yet for the year). */
  estimate?: boolean;
  /**
   * Which rule, where one line has several (Zurich's 220: travel, meals, other costs), named as
   * the federal concepts are (ifd/items.ts, FederalConcept). Optional.
   */
  rule?: string;
}

/** The federal scale applied: married couples, single parents (parental) or anyone else. */
export type IfdScale = 'single' | 'married' | 'parental';

/** The federal tax on a taxable income (art. 36 LIFD, Form. 58c): ../ifd/assess.ts. */
export interface IfdTax {
  /** The income the scale is read at: fractions under CHF 100 dropped. */
  scaleIncome: Line;
  scale: IfdScale;
  /** The scale's tax, rounded down to 5 centimes. */
  scaleTax: Line;
  childReduction: Line;
  tax: Line;
}

/**
 * The federal tax on lump sums from the 2nd pillar or pillar 3a (prestations en capital provenant de
 * la prévoyance, ch-na-law-lifd art. 38): taxed apart from the other income, at a fifth of the
 * scale (../ifd/capital.ts).
 */
export interface IfdCapitalTax {
  /** Every lump sum of the year with the fraction under CHF 100 dropped (Form. 58c note 1). */
  scaleIncome: Line;
  /** single, or the married scale for a couple and a single parent (art. 38 al. 2). */
  scale: IfdScale;
  /** One year's tax by that scale on an income of that amount. */
  scaleTax: Line;
  /** A fifth of it, rounded down to 5 centimes: the tax on the lump sums. */
  tax: Line;
}

/**
 * The separate tax on lump sums from pension funds, vested benefits and pillar 3a (prestations en
 * capital provenant de la prévoyance): a full year's tax of its own, at a fifth of the scales, on
 * every lump sum of the year added up, the spouses' together (ch-na-law-lifd art. 9 al. 1 and 38;
 * each canton's law). It never enters the progressive income base. `Icc` is the canton's own part.
 */
export interface CapitalTax<Icc extends { tax: Line } = { tax: Line }> {
  /** One item per lump sum counted, by the canton's line code and person (Geneva: 98.12). */
  items: Item[];
  /** Every lump sum counted, added up: the amount taxed. */
  amount: Line;
  /**
   * A lump sum from the 2nd pillar is among them: buy-ins of the three years before may lose their
   * deduction (ch-na-law-lpp art. 79b al. 3, p. 66).
   */
  secondPillar: boolean;
  /** The cantonal and communal tax on it; null when not computed (why: `unsupported`). */
  icc: Icc | null;
  /** The federal tax on it; null when not computed (why: `unsupported`). */
  ifd: IfdCapitalTax | null;
  /** The two together, when both are computed. */
  total: Line | null;
}

/** The federal direct tax (IFD), as every canton's result shows it. */
export interface IfdResult extends IfdTax {
  items: Item[];
  grossIncome: Line;
  /** After every deduction except the social deductions. */
  netIncome: Line;
  taxableIncome: Line;
}

/**
 * The cantonal and communal tax, named `icc` in every canton: the lines the dashboard reads. Each
 * canton adds its own subtotals and the lines of `taxes` (Geneva: centimes additionnels, the 12 %
 * reduction; Zurich: einfache Staatssteuer, Steuerfuss, Personalsteuer).
 */
export interface CantonalResult {
  items: Item[];
  grossIncome: Line;
  netIncome: Line;
  taxableIncome: Line;
  wealth: { items: Item[]; taxableWealth: Line };
  taxes: { total: Line };
}

/** What every canton's computeReturn gives (docs/design/cantons.md, section 2). */
export interface TaxResult<Icc extends CantonalResult = CantonalResult> {
  taxYear: number;
  /**
   * The commune of residence: Geneva's slug, or a reference with its BFS number (Zurich, Bern), or
   * without one where the canton's official tables carry none (Vaud), as `Commune.bfs` in canton.ts.
   */
  commune: string | { bfs: number | null; name: string; rate: number | null };
  icc: Icc | null;
  ifd: IfdResult | null;
  /**
   * The taxes computed: in Geneva the cantonal and communal tax plus the federal tax, when both are;
   * in Zurich the same (its Bundessteuer column). The separate tax on pension capital (`capital`)
   * is a tax of its own and is not in this total.
   */
  total: number | null;
  /**
   * The separate tax on lump sums from the 2nd pillar and pillar 3a, in a canton that computes it
   * (Geneva). Absent when the household received none.
   */
  capital?: CapitalTax;
  /** Every estimate the result relies on (SPEC.md section 9). */
  estimates: EstimateNote[];
  /** Items that rely on values still awaiting the user's OK. */
  needsOk: number;
  /** False when some amount is known only in part: the taxes are then floors, not final. */
  complete: boolean;
  /** What is known only in part. */
  incomplete: Text[];
  /** What the engine was told to assume about the household. */
  assumptions: Text[];
  /** What is not in the calculation (for example costs with no amount given). */
  notCounted: Text[];
  /** Why a tax is not computed at all (fail closed). */
  unsupported: Text[];
  /** Rules applied whose detail the official documents don't spell out. */
  unverifiedRules: Text[];
  /**
   * Every cap, threshold, minimum or flat-or-actual choice a rule applied, in both taxes (SPEC.md
   * 10.0): what the final check reads for values at or near a limit. Absent: none reported.
   */
  limits?: LimitApplied[];
}
