// Ordinary taxation after source tax (TOU), SPEC.md section 8, group C: the tax withheld at source
// for the year next to the ordinary tax on the same income, when TOU is compulsory, the 31 March
// deadline and that a request can't be withdrawn. Taxpresso compares; the user decides and files
// the request (DRIS/TOU form) themselves.
//
// What is a fact and what is a choice (`mode`): TOU already in place stays every year while taxed
// at source (LISP art. 4 al. 5, art. 5 al. 5), and compulsory TOU must be announced (LISP art. 4
// al. 1): both are facts, with no comparison and nothing to decide. Only when none of the
// compulsory cases applies is TOU a choice, with the comparison and the "can't be withdrawn" step.
//
// Without TOU the tax withheld is final and no deduction is added (LISP art. 5 al. 4); with it,
// the ordinary tax counts the deductions (3a, pension fund buy-ins) and the tax withheld is
// credited (LISP art. 4 al. 6). So: difference = withheld - ordinary tax with those deductions.
import { type TouThresholds, TOU_FACTS, touDeadline, touThresholds } from '@taxpresso/rules-ge';
import {
  type Assumption,
  type Deduction,
  ESTIMATE_SOURCES,
  type HouseholdInput,
  ordinaryTaxEstimator,
  type TaxEstimate,
} from './tax-with.js';

export interface TouWithheld {
  centimes: number;
  /**
   * From documents (salary certificate box 12, the benefits attestation), a figure the user or
   * Claude read from an official statement, or the barème on the gross salary (an estimate).
   */
  from: 'certificate' | 'stated' | 'tariff';
  /** The barème used, when estimated from it. */
  tariff?: string;
}

export interface TouPerson {
  person: 'p1' | 'p2';
  taxedAtSource: boolean;
  /** Already taxed ordinarily after source tax before this year (profile.tou). */
  tou?: 'already' | 'no';
  /**
   * Gross income taxed at source for the year (salary, and benefits not paid through the
   * employer), when every part of it is known.
   */
  grossCentimes?: number;
  /** The part of that gross known so far: enough to say TOU is compulsory when it reaches the limit. */
  grossAtLeastCentimes?: number;
  /** Had a salary, benefits or self-employment income; undefined when not answered. */
  working?: boolean;
  /** Not taxed at source, but with income of their own (a salary, benefits, a pension). */
  ownIncome?: boolean;
  /** Has income the comparison doesn't count yet (a pension). */
  uncounted?: boolean;
  /** Has benefits whose amount isn't known yet (no attestation). */
  benefitsUnknown?: boolean;
  withheld?: TouWithheld;
}

export interface TouInput {
  taxYear: number;
  /** YYYY-MM-DD, to tell whether the deadline has passed. */
  today: string;
  household: HouseholdInput;
  people: TouPerson[];
  /** Other income not taxed at source over the limit; undefined when not answered. */
  otherIncome?: boolean;
  taxableWealth?: boolean;
  /** Deductions that only count with TOU: 3a paid, pension fund buy-ins. */
  deductions: Deduction[];
  /** Some figures come from documents the user hasn't confirmed yet. */
  unconfirmed?: boolean;
  /**
   * A departure abroad: the request (or the announcement of a compulsory TOU) goes with the
   * departure form, before leaving (ge-<year>-source-directives ch. 8.5), not by 31 March.
   */
  deadline?: { date: string; source: string };
}

export type TouReasonId =
  'gross' | 'other_income' | 'taxable_wealth' | 'previous_tou' | 'spouse_without_activity';

/** 'check': one official source lists it, another doesn't (see ge/NOTES.md). */
export type TouStatus = 'yes' | 'no' | 'unknown' | 'check';

/**
 * in_place: already in TOU, it stays (a fact). compulsory: TOU must be announced (a fact).
 * choice: none of the compulsory cases applies, the user decides. check: possibly compulsory,
 * to ask the tax office. unknown: an answer that decides it is missing.
 */
export type TouMode = 'in_place' | 'compulsory' | 'choice' | 'check' | 'unknown';

export interface TouReason {
  id: TouReasonId;
  status: TouStatus;
  source: string;
}

export type TouProblem =
  /**
   * A couple where one is taxed at source and the other isn't, with income of their own (an
   * international civil servant, for one): Taxpresso doesn't compare, the tax office does.
   */
  | 'mixed_couple'
  /** No salary or benefits known for the ordinary tax. */
  | 'no_income'
  /** Benefits whose amount isn't known yet: the ordinary tax would leave them out. */
  | 'benefits_unknown'
  /** A pension in the household: the comparison doesn't count pensions yet. */
  | 'income_not_counted';

export type TouAssumption =
  | Assumption
  | 'income_tax_only'
  | 'withheld_from_tariff'
  | 'tariff_c_correction'
  | 'values_to_confirm'
  /** Only flat deductions so far: the real ordinary tax is likely lower, TOU likely better. */
  | 'ordinary_may_be_lower';

export interface TouResult {
  /** Someone in the household is taxed at source. */
  applies: boolean;
  /** What TOU is for this household; only when it applies. */
  mode?: TouMode;
  compulsory: TouStatus;
  reasons: TouReason[];
  withheld?: { totalCentimes: number; people: ({ person: 'p1' | 'p2' } & TouWithheld)[] };
  /** Taxed at source, but no figure for the tax withheld yet. */
  missingWithheld: ('p1' | 'p2')[];
  /** The ordinary tax, compared only when TOU may be a choice (not in place, not compulsory). */
  ordinary?: TaxEstimate;
  /** Withheld minus ordinary tax: above 0, TOU would give that much back; below 0, it costs it. */
  differenceCentimes?: number;
  problem?: TouProblem;
  deadline: string;
  deadlinePassed: boolean;
  thresholds: {
    grossCentimes: number;
    otherIncomeCentimes: number;
    wealthFree: TouThresholds['wealthFree']['value'];
  };
  assumptions: TouAssumption[];
  facts: typeof TOU_FACTS;
  sources: string[];
}

function worst(statuses: TouStatus[]): TouStatus {
  for (const s of ['yes', 'check', 'unknown'] as const) if (statuses.includes(s)) return s;
  return 'no';
}

const answered = (v: boolean | undefined): TouStatus =>
  v === undefined ? 'unknown' : v ? 'yes' : 'no';

function modeOf(previous: TouStatus, compulsory: TouStatus): TouMode {
  if (previous === 'yes') return 'in_place';
  if (compulsory === 'yes') return 'compulsory';
  if (compulsory === 'check') return 'check';
  if (compulsory === 'unknown') return 'unknown';
  return 'choice';
}

export function touPlan(input: TouInput): TouResult {
  const atSource = input.people.filter((p) => p.taxedAtSource);
  const couple = input.household.couple;
  // A year without its directives' amounts throws: nothing is guessed.
  const limits = touThresholds(input.taxYear);

  const gross: TouStatus = atSource.some(
    (p) => (p.grossAtLeastCentimes ?? p.grossCentimes ?? 0) >= limits.gross.value,
  )
    ? 'yes'
    : atSource.some((p) => p.grossCentimes === undefined)
      ? 'unknown'
      : 'no';
  const previous: TouStatus = atSource.some((p) => p.tou === 'already')
    ? 'yes'
    : atSource.every((p) => p.tou !== undefined)
      ? 'no'
      : 'unknown';
  const spouse: TouStatus = !couple
    ? 'no'
    : input.people.some((p) => p.working === false)
      ? 'check'
      : input.people.every((p) => p.working === true)
        ? 'no'
        : 'unknown';
  const reasons: TouReason[] = [
    { id: 'gross', status: gross, source: limits.gross.source },
    {
      id: 'other_income',
      status: answered(input.otherIncome),
      source: limits.otherIncome.source,
    },
    {
      id: 'taxable_wealth',
      status: answered(input.taxableWealth),
      source: TOU_FACTS.compulsoryCases,
    },
    { id: 'previous_tou', status: previous, source: TOU_FACTS.previousTou },
    { id: 'spouse_without_activity', status: spouse, source: TOU_FACTS.spouseWithoutActivity },
  ];

  const deadline = input.deadline?.date ?? touDeadline(input.taxYear);
  const compulsory = worst(reasons.map((r) => r.status));
  const result: TouResult = {
    applies: atSource.length > 0,
    compulsory,
    reasons,
    missingWithheld: atSource.filter((p) => !p.withheld).map((p) => p.person),
    deadline,
    deadlinePassed: input.today > deadline,
    thresholds: {
      grossCentimes: limits.gross.value,
      otherIncomeCentimes: limits.otherIncome.value,
      wealthFree: limits.wealthFree.value,
    },
    assumptions: [],
    facts: TOU_FACTS,
    sources: [
      TOU_FACTS.compulsoryCases,
      TOU_FACTS.deadline,
      TOU_FACTS.irrevocable,
      TOU_FACTS.everyYearAfter,
      ...ESTIMATE_SOURCES,
    ],
  };
  if (!result.applies) return result;
  const mode = modeOf(previous, compulsory);
  result.mode = mode;

  const withheldPeople = atSource
    .filter((p) => p.withheld)
    .map((p) => ({ person: p.person, ...p.withheld! }));
  if (withheldPeople.length) {
    result.withheld = {
      totalCentimes: withheldPeople.reduce((sum, p) => sum + p.centimes, 0),
      people: withheldPeople,
    };
  }
  const assumptions: TouAssumption[] = [];
  if (withheldPeople.some((p) => p.from === 'tariff')) assumptions.push('withheld_from_tariff');
  if (input.unconfirmed) assumptions.push('values_to_confirm');
  // TOU in place or compulsory: a fact, nothing to compare or decide.
  if (mode === 'in_place' || mode === 'compulsory') return { ...result, assumptions };

  // One spouse taxed at source, the other not but with income of their own.
  if (couple && input.people.some((p) => !p.taxedAtSource && p.ownIncome)) {
    return { ...result, problem: 'mixed_couple', assumptions };
  }
  if (input.people.some((p) => p.uncounted)) {
    return { ...result, problem: 'income_not_counted', assumptions };
  }
  if (input.people.some((p) => p.benefitsUnknown)) {
    return { ...result, problem: 'benefits_unknown', assumptions };
  }
  const estimator = ordinaryTaxEstimator(input.household);
  if (!estimator) return { ...result, problem: 'no_income', assumptions };

  // Read the other way round than for a saving: fewer deductions make the ordinary tax too high.
  const all: TouAssumption[] = [
    ...estimator.assumptions.map((a) =>
      a === 'flat_deductions_only' ? ('ordinary_may_be_lower' as const) : a,
    ),
    'income_tax_only',
    ...assumptions.filter((a) => a === 'withheld_from_tariff'),
  ];
  // Both spouses working: tariff C, whose tax the AFC may correct on both real incomes.
  if (couple && input.people.every((p) => p.working !== false)) {
    all.push('tariff_c_correction');
  }
  if (input.unconfirmed) all.push('values_to_confirm');
  const ordinary = estimator.taxWith(input.deductions);
  return {
    ...result,
    ordinary,
    ...(result.withheld && result.missingWithheld.length === 0
      ? { differenceCentimes: result.withheld.totalCentimes - ordinary.totalCentimes }
      : {}),
    assumptions: all,
  };
}
