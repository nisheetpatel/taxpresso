// The one question every plan asks: "how much income tax would this household pay with these
// extra deductions?" (SPEC.md section 8: run the engine with and without). Every saving and the TOU
// comparison go through `taxWith`, which runs the rules engine (computeReturn, @taxpresso/rules-ge)
// with each deduction under its rubric code: 3a and the 3a catch-up on 31.40/41.40, a pension fund
// buy-in on 31.30/41.30. The tax is the income tax: cantonal (base, centimes, 12 % reduction, home
// care) plus communal plus federal; the wealth tax and the taxe personnelle don't change with a
// deduction and are not part of what the source tax replaces. All money in integer centimes.
// A household of another canton runs on that canton's engine the same way, through the canton
// interface (CantonPlan, given by the extension's registry): 3a, the 3a catch-up and a buy-in on the
// shared household input, its income tax as the canton's result view says (packages/rules-ch,
// view.ts: Zurich's cantonal, communal and church tax on income plus the federal tax).
import type {
  CantonCode,
  HouseholdInput as SharedHousehold,
  TaxResult as SharedResult,
} from '@taxpresso/rules-ch';
import {
  computeReturn,
  type CommuneSlug,
  type EngineInput,
  type PersonInput as EnginePerson,
  type TaxResult,
} from '@taxpresso/rules-ge';

/**
 * Share of gross salary assumed to remain after social insurance and pension fund contributions,
 * when only the gross is known. A product assumption the user sees and can replace with their net
 * salary; not a tax constant.
 */
export const NET_SHARE_OF_GROSS_BP = 8800;

export interface PersonInput {
  person: 'p1' | 'p2';
  grossCentimes?: number;
  /** Net salary (salary certificate box 11). Wins over the gross when both are given. */
  netCentimes?: number;
  hasPensionFund: boolean;
  paidCentimes: number;
}

/** The cantons other than Geneva, by the prefix of their assumptions ("zh_preview"). */
type CantonPrefix = Lowercase<Exclude<CantonCode, 'GE'>>;

/**
 * How the plans run on a canton other than Geneva: its engine behind the canton interface and what
 * the plans assume for it (the extension's registry gives it, extension/src/cantons.ts).
 */
export interface CantonPlan {
  /** The cantonal, communal and federal tax of a household (CantonRules.computeReturn). */
  computeReturn(input: SharedHousehold): SharedResult;
  /** The income tax of a result, as the canton's result view says (ResultView.incomeTax). */
  incomeTax(r: SharedResult): TaxEstimate | undefined;
  /**
   * The commune assumed when none is answered, as the canton's engine takes it: its BFS number, or
   * its name where no document gives one (Basel-Stadt).
   */
  defaultCommune: string | number;
  /** The documents the canton's income tax rests on, for the year. */
  sources(taxYear: number): string[];
  /** The canton's assumptions: a preview, and the commune assumed. */
  assumptions: { preview: Assumption; communeDefault: Assumption };
  /**
   * A 3a catch-up: the field of the household input it goes on, and, when no document of the canton
   * gives its cantonal rule, the assumption that says so (no saving is shown: fail closed).
   */
  catchUp: { field: 'pillar3a' | 'pillar3aCatchUp'; unknownRule?: Assumption };
}

/** What a household of another canton's plans read besides the salaries (Workspace.planInput). */
export interface CantonPlanInput {
  plan: CantonPlan;
  /** The commune as the canton's engine takes it; unknown, the plan's default is assumed. */
  commune?: string | number;
  known?: Pick<
    SharedHousehold,
    'household' | 'movable' | 'childSupport' | 'ifdParentalScale' | 'cantonal'
  >;
}

export interface HouseholdInput {
  /** The canton of the year; Geneva when absent. */
  canton?: CantonCode;
  /** Another canton's engine, commune and what the ledger knows, for a household not in Geneva. */
  other?: CantonPlanInput;
  couple: boolean;
  children: number;
  custody?: 'with_household' | 'shared' | 'elsewhere';
  commune?: CommuneSlug;
  people: PersonInput[];
  /** The tax year the plans are for. Default 2026. */
  taxYear?: 2025 | 2026;
  /**
   * What the ledger already knows besides the salaries and the plans' own deductions (health
   * premiums, childcare, donations, the état des titres...), so the plans run on the real tax.
   */
  known?: Pick<EngineInput, 'household' | 'wealthItems' | 'childSupport' | 'ifdParentalScale'>;
}

export type Assumption =
  | 'icc_2025_scale'
  | 'flat_deductions_only'
  | 'home_commune_rate'
  | 'net_from_gross'
  | 'commune_default'
  | 'no_income_for_some'
  /** Another canton: commune not answered, its default assumed ("zh_commune_default"). */
  | `${CantonPrefix}_commune_default`
  /** A preview canton: the rules its documents don't spell out, as in the estimate. */
  | `${CantonPrefix}_preview`
  /** No document of the canton gives the cantonal rule of a 3a catch-up yet: no saving. */
  | `${CantonPrefix}_catchup_rule`;

/** What a deduction is, for the engine's rubric codes (31.40/41.40, 31.30/41.30 in the guide). */
export type DeductionKind = 'pillar3a' | 'pillar3a_catchup' | 'lpp_buyin';

export interface Deduction {
  person: 'p1' | 'p2';
  kind: DeductionKind;
  centimes: number;
}

export interface TaxEstimate {
  cantonalCentimes: number;
  federalCentimes: number;
  totalCentimes: number;
}

/** Income tax (cantonal, communal and federal) with these deductions. */
export type TaxWith = (deductions: readonly Deduction[]) => TaxEstimate;

export interface Estimator {
  taxWith: TaxWith;
  assumptions: Assumption[];
  sources: string[];
}

/** The documents the engine's income tax rests on (each line of it cites its own page). */
export const ESTIMATE_SOURCES = [
  'ge-2025-icc-tariff-pdf p. 2, p. 4',
  'ge-2025-guide-declaration-pp p. 11',
  'ge-2026-communal-centimes-arca',
  'ge-2026-part-privilegiee-communique p. 11',
  'ch-2026-ifd-progression-deductions p. 2, p. 4',
];

/** The documents the plans' savings rest on, for this household's canton. */
export function estimateSources(h: HouseholdInput): string[] {
  return h.other ? h.other.plan.sources(h.taxYear ?? 2026) : ESTIMATE_SOURCES;
}

export const pct = (centimes: number, bp: number) => Math.round((centimes * bp) / 10_000);

/** The salary a person's tax starts from: the net, or a share of the gross. */
export function netOf(p: PersonInput): number | undefined {
  if (p.netCentimes !== undefined) return p.netCentimes;
  if (p.grossCentimes !== undefined) return pct(p.grossCentimes, NET_SHARE_OF_GROSS_BP);
  return undefined;
}

/** The engine's input for the household, before the plans' deductions. */
function engineInput(h: HouseholdInput, nets: (number | undefined)[]): EngineInput {
  const kids = h.custody === 'elsewhere' ? 0 : h.children;
  return {
    taxYear: h.taxYear ?? 2026,
    commune: h.commune ?? 'geneve',
    civilStatus: h.couple ? 'married' : 'single',
    // The salary after social and pension fund contributions, as the plans know it: the engine's
    // flat professional deductions then start from it, as they do from 11.00 less 31.10 and 31.12.
    people: h.people.map((p, i): EnginePerson => {
      const net = nets[i];
      return {
        id: p.person,
        hasPensionFund: p.hasPensionFund,
        ...(net !== undefined
          ? { employments: [{ gross: { value: net, status: 'estimate' } }] }
          : {}),
      };
    }),
    children: Array.from({ length: kids }, () => ({
      custody: h.custody === 'shared' ? ('shared' as const) : ('full' as const),
    })),
    // With shared custody the plans follow the answer about child support (who has the children
    // and the parental federal scale); not answered yet, they take the parental scale.
    ...(h.custody === 'shared' && !h.couple
      ? {
          ...(h.known?.childSupport ? { childSupport: h.known.childSupport } : {}),
          ifdParentalScale: h.known?.ifdParentalScale ?? true,
        }
      : {}),
    ...(h.known?.household ? { household: h.known.household } : {}),
    ...(h.known?.wealthItems ? { wealthItems: h.known.wealthItems } : {}),
  };
}

/** The input with the plans' deductions added, each under its rubric. */
function withDeductions(base: EngineInput, deductions: readonly Deduction[]): EngineInput {
  const add = (
    p: EnginePerson,
    field: 'pillar3a' | 'pillar3aCatchUp' | 'pensionBuyIn',
    v: number,
  ) => {
    const had = p[field]?.value ?? 0;
    return { ...p, [field]: { value: had + v, status: 'estimate' } };
  };
  const field = {
    pillar3a: 'pillar3a',
    pillar3a_catchup: 'pillar3aCatchUp',
    lpp_buyin: 'pensionBuyIn',
  } as const;
  return {
    ...base,
    people: base.people.map((p) =>
      deductions
        .filter((d) => d.person === p.id && d.centimes > 0)
        .reduce((q, d) => add(q, field[d.kind], d.centimes), p),
    ),
  };
}

/** The income tax of a result: cantonal and communal on income, and federal. */
function incomeTax(r: TaxResult): TaxEstimate | undefined {
  if (!r.icc || !r.ifd) return undefined;
  const cantonal = r.icc.taxes.incomeCantonal.amount + r.icc.taxes.communalIncomeTotal.amount;
  const federal = r.ifd.tax.amount;
  return {
    cantonalCentimes: cantonal,
    federalCentimes: federal,
    totalCentimes: cantonal + federal,
  };
}

/**
 * The household's income tax as a function of extra deductions, from the rules engine, or
 * undefined when no salary is known or the engine computes no tax for the household (nothing is
 * guessed).
 */
export function ordinaryTaxEstimator(h: HouseholdInput): Estimator | undefined {
  if (h.other) return cantonEstimator(h, h.other);
  const nets = h.people.map(netOf);
  if (nets.every((n) => n === undefined)) return undefined;
  const base = engineInput(h, nets);
  const first = incomeTax(computeReturn(base));
  if (!first) return undefined;
  const assumptions: Assumption[] = ['home_commune_rate'];
  if ((h.taxYear ?? 2026) === 2026) assumptions.unshift('icc_2025_scale');
  if (!Object.keys(h.known?.household ?? {}).length) assumptions.push('flat_deductions_only');
  if (h.people.some((p) => p.netCentimes === undefined && p.grossCentimes !== undefined))
    assumptions.push('net_from_gross');
  if (nets.some((n) => n === undefined)) assumptions.push('no_income_for_some');
  if (!h.commune) assumptions.push('commune_default');
  return {
    assumptions,
    sources: ESTIMATE_SOURCES,
    // A combination the engine can't compute (it never happens with deductions alone) keeps the
    // tax without them: no saving is shown rather than a guess.
    taxWith: (deductions) => incomeTax(computeReturn(withDeductions(base, deductions))) ?? first,
  };
}

/** What `extra` saves on top of `base`: the engine run with and without (SPEC.md section 8). */
export function savingOf(
  taxWith: TaxWith,
  base: readonly Deduction[],
  extra: readonly Deduction[],
): TaxEstimate {
  const before = taxWith(base);
  const after = taxWith([...base, ...extra]);
  return {
    cantonalCentimes: before.cantonalCentimes - after.cantonalCentimes,
    federalCentimes: before.federalCentimes - after.federalCentimes,
    totalCentimes: before.totalCentimes - after.totalCentimes,
  };
}

// ---- Another canton ----------------------------------------------------------------------------

/** The canton's input for the household, before the plans' deductions: income only, no wealth. */
function cantonInput(
  h: HouseholdInput,
  c: CantonPlanInput,
  nets: (number | undefined)[],
): SharedHousehold {
  const kids = h.custody === 'elsewhere' ? 0 : h.children;
  const known = c.known;
  // Deductions don't change the wealth tax: leave wealth out, so the tax is the income tax.
  const household = known?.household && {
    ...known.household,
    cash: undefined,
    lifeInsuranceValue: undefined,
    vehicles: undefined,
    otherAssets: undefined,
    debts: undefined,
  };
  const movable = known?.movable
    ?.filter((m) => m.income)
    .map((m) => ({ owner: m.owner, income: m.income }));
  return {
    taxYear: h.taxYear ?? 2026,
    commune: c.commune ?? c.plan.defaultCommune,
    civilStatus: h.couple ? 'married' : 'single',
    people: h.people.map((p, i) => {
      const net = nets[i];
      return {
        id: p.person,
        hasPensionFund: p.hasPensionFund,
        ...(net !== undefined
          ? { employments: [{ gross: { value: net, status: 'estimate' as const } }] }
          : {}),
      };
    }),
    children: Array.from({ length: kids }, () => ({
      custody: h.custody === 'shared' ? ('shared' as const) : ('full' as const),
    })),
    ...(h.custody === 'shared' && !h.couple
      ? {
          ...(known?.childSupport ? { childSupport: known.childSupport } : {}),
          ifdParentalScale: known?.ifdParentalScale ?? true,
        }
      : {}),
    ...(household
      ? {
          household: Object.fromEntries(
            Object.entries(household).filter(([, v]) => v !== undefined),
          ),
        }
      : {}),
    ...(movable?.length ? { movable } : {}),
    ...(known?.cantonal ? { cantonal: known.cantonal } : {}),
  };
}

/** The input with the plans' deductions added: 3a, the 3a catch-up and a buy-in. */
function cantonWith(
  base: SharedHousehold,
  deductions: readonly Deduction[],
  catchUp: CantonPlan['catchUp']['field'],
): SharedHousehold {
  return {
    ...base,
    people: base.people.map((p) => {
      let q = p;
      for (const d of deductions) {
        if (d.person !== p.id || d.centimes <= 0) continue;
        const field =
          d.kind === 'lpp_buyin'
            ? 'pensionBuyIn'
            : d.kind === 'pillar3a_catchup'
              ? catchUp
              : 'pillar3a';
        q = { ...q, [field]: { value: (q[field]?.value ?? 0) + d.centimes, status: 'estimate' } };
      }
      return q;
    }),
  };
}

function cantonEstimator(h: HouseholdInput, c: CantonPlanInput): Estimator | undefined {
  const nets = h.people.map(netOf);
  if (nets.every((n) => n === undefined)) return undefined;
  const plan = c.plan;
  const base = cantonInput(h, c, nets);
  const run = (input: SharedHousehold) => plan.incomeTax(plan.computeReturn(input));
  const first = run(base);
  if (!first) return undefined;
  const assumptions: Assumption[] = [plan.assumptions.preview];
  if (!Object.keys(c.known?.household ?? {}).length) assumptions.push('flat_deductions_only');
  if (h.people.some((p) => p.netCentimes === undefined && p.grossCentimes !== undefined))
    assumptions.push('net_from_gross');
  if (nets.some((n) => n === undefined)) assumptions.push('no_income_for_some');
  if (c.commune === undefined) assumptions.push(plan.assumptions.communeDefault);
  return {
    assumptions,
    sources: plan.sources(h.taxYear ?? 2026),
    taxWith: (deductions) => run(cantonWith(base, deductions, plan.catchUp.field)) ?? first,
  };
}
