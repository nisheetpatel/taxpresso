// Ordinary taxation after source tax (TOU), SPEC.md section 8, group C: the tax withheld at source
// for the year next to the ordinary tax on the same income, when TOU is compulsory, the 31 March
// deadline and that a request can't be withdrawn. Taxpresso compares; the user decides and files
// the request (DRIS/TOU form) themselves.
//
// Without TOU the tax withheld is final and no deduction is added (LISP art. 5 al. 4); with it,
// the ordinary tax counts the deductions (3a, pension fund buy-ins) and the tax withheld is
// credited (LISP art. 4 al. 6). So: difference = withheld - ordinary tax with those deductions.
import {
  TOU_2026_GROSS_THRESHOLD,
  TOU_2026_OTHER_INCOME_THRESHOLD,
  TOU_2026_WEALTH_FREE,
  TOU_FACTS,
  touDeadline,
} from '@taxpresso/rules-ge';
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
  /** From salary certificates (box 12), a figure the user gave, or the tariff on the gross. */
  from: 'certificate' | 'stated' | 'tariff';
  /** The tariff used, when estimated from it. */
  tariff?: string;
}

export interface TouPerson {
  person: 'p1' | 'p2';
  taxedAtSource: boolean;
  /** The answer to "Are you taxed ordinarily instead (TOU), or thinking about it?". */
  tou?: 'already' | 'considering' | 'no';
  /** Gross salary for the year (certificate box 8, or what the user said). */
  grossCentimes?: number;
  /** Had a salary, benefits or self-employment income; undefined when not answered. */
  working?: boolean;
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
}

export type TouReasonId =
  'gross' | 'other_income' | 'taxable_wealth' | 'previous_tou' | 'spouse_without_activity';

/** 'check': one official source lists it, another doesn't (see ge/NOTES.md). */
export type TouStatus = 'yes' | 'no' | 'unknown' | 'check';

export interface TouReason {
  id: TouReasonId;
  status: TouStatus;
  source: string;
}

export type TouProblem =
  /** A couple where only one person is taxed at source: ask the AFC, Taxpresso doesn't compare. */
  | 'mixed_couple'
  /** No salary known for the ordinary tax. */
  | 'no_income';

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
  compulsory: TouStatus;
  reasons: TouReason[];
  withheld?: { totalCentimes: number; people: ({ person: 'p1' | 'p2' } & TouWithheld)[] };
  /** Taxed at source, but no figure for the tax withheld yet. */
  missingWithheld: ('p1' | 'p2')[];
  ordinary?: TaxEstimate;
  /** Withheld minus ordinary tax: above 0, TOU would give that much back; below 0, it costs it. */
  differenceCentimes?: number;
  problem?: TouProblem;
  deadline: string;
  deadlinePassed: boolean;
  thresholds: {
    grossCentimes: number;
    otherIncomeCentimes: number;
    wealthFree: typeof TOU_2026_WEALTH_FREE.value;
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

export function touPlan(input: TouInput): TouResult {
  const atSource = input.people.filter((p) => p.taxedAtSource);
  const couple = input.household.couple;

  const gross: TouStatus = atSource.some(
    (p) => p.grossCentimes !== undefined && p.grossCentimes >= TOU_2026_GROSS_THRESHOLD.value,
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
    { id: 'gross', status: gross, source: TOU_2026_GROSS_THRESHOLD.source },
    {
      id: 'other_income',
      status: answered(input.otherIncome),
      source: TOU_2026_OTHER_INCOME_THRESHOLD.source,
    },
    {
      id: 'taxable_wealth',
      status: answered(input.taxableWealth),
      source: TOU_FACTS.compulsoryCases,
    },
    { id: 'previous_tou', status: previous, source: TOU_FACTS.previousTou },
    { id: 'spouse_without_activity', status: spouse, source: TOU_FACTS.spouseWithoutActivity },
  ];

  const deadline = touDeadline(input.taxYear);
  const result: TouResult = {
    applies: atSource.length > 0,
    compulsory: worst(reasons.map((r) => r.status)),
    reasons,
    missingWithheld: atSource.filter((p) => !p.withheld).map((p) => p.person),
    deadline,
    deadlinePassed: input.today > deadline,
    thresholds: {
      grossCentimes: TOU_2026_GROSS_THRESHOLD.value,
      otherIncomeCentimes: TOU_2026_OTHER_INCOME_THRESHOLD.value,
      wealthFree: TOU_2026_WEALTH_FREE.value,
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

  const withheldPeople = atSource
    .filter((p) => p.withheld)
    .map((p) => ({ person: p.person, ...p.withheld! }));
  if (withheldPeople.length) {
    result.withheld = {
      totalCentimes: withheldPeople.reduce((sum, p) => sum + p.centimes, 0),
      people: withheldPeople,
    };
  }
  if (couple && atSource.length !== input.people.length)
    return { ...result, problem: 'mixed_couple' };
  const estimator = ordinaryTaxEstimator(input.household);
  if (!estimator) return { ...result, problem: 'no_income' };

  // Read the other way round than for a saving: fewer deductions make the ordinary tax too high.
  const assumptions: TouAssumption[] = [
    ...estimator.assumptions.map((a) =>
      a === 'flat_deductions_only' ? ('ordinary_may_be_lower' as const) : a,
    ),
    'income_tax_only',
  ];
  if (withheldPeople.some((p) => p.from === 'tariff')) assumptions.push('withheld_from_tariff');
  // Both spouses working: tariff C, whose tax the AFC may correct on both real incomes.
  if (couple && input.people.every((p) => p.working !== false)) {
    assumptions.push('tariff_c_correction');
  }
  if (input.unconfirmed) assumptions.push('values_to_confirm');
  const ordinary = estimator.taxWith(input.deductions);
  return {
    ...result,
    ordinary,
    ...(result.withheld && result.missingWithheld.length === 0
      ? { differenceCentimes: result.withheld.totalCentimes - ordinary.totalCentimes }
      : {}),
    assumptions,
  };
}
