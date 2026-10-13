// The one question every plan asks: "how much income tax would this household pay with these
// extra deductions?" (SPEC.md section 8: run the engine with and without). Every saving and the TOU
// comparison go through `taxWith`, which runs the rules engine (computeReturn, @taxpresso/rules-ge)
// with each deduction under its rubric code: 3a and the 3a catch-up on 31.40/41.40, a pension fund
// buy-in on 31.30/41.30. The tax is the income tax: cantonal (base, centimes, 12 % reduction, home
// care) plus communal plus federal; the wealth tax and the taxe personnelle don't change with a
// deduction and are not part of what the source tax replaces. All money in integer centimes.
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

export interface HouseholdInput {
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
  known?: Pick<EngineInput, 'household' | 'wealthItems'>;
}

export type Assumption =
  | 'icc_2025_scale'
  | 'flat_deductions_only'
  | 'home_commune_rate'
  | 'net_from_gross'
  | 'commune_default'
  | 'no_income_for_some';

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
    // With shared custody the plans take the parental federal scale, as before the engine.
    ...(h.custody === 'shared' && !h.couple ? { ifdParentalScale: true } : {}),
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
