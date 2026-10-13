// The one question every plan asks: "how much income tax would this household pay with these
// extra deductions?" (SPEC.md section 8: run the engine with and without). Every saving and the TOU
// comparison go through `taxWith`, so pointing them at the full engine (computeReturn, items by
// rubric code) means replacing `ordinaryTaxEstimator` alone: each deduction already says whose it
// is and what it is (3a, 3a catch-up, pension fund buy-in), which is what a rubric code needs.
//
// Until then: Geneva's 2025 income scale (2026 is published in January 2027), the federal 2026
// scale, and only the flat deductions. All money in integer centimes.
import {
  COMMUNE_CENTIMES_2026,
  type CommuneSlug,
  ICC_2025_PROFESSIONAL_FLAT,
  iccBaseIncomeTax2025,
  iccTotalIncomeTax2025,
  type IccSplitting,
  IFD_2026_DEDUCTIONS,
  IFD_PROFESSIONAL_FLAT_RATE_BP,
  ifdTax2026,
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

export const ESTIMATE_SOURCES = [
  'ge-2025-icc-tariff-pdf p. 2, p. 4',
  ICC_2025_PROFESSIONAL_FLAT.source,
  COMMUNE_CENTIMES_2026.source,
  IFD_2026_DEDUCTIONS.source,
  'ch-2026-ifd-progression-deductions p. 4',
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const pct = (centimes: number, bp: number) => Math.round((centimes * bp) / 10_000);
/** Taxable income is counted in whole francs. */
const roundFranc = (centimes: number) => Math.floor(centimes / 100) * 100;

/** The salary a person's tax starts from: the net, or a share of the gross. */
export function netOf(p: PersonInput): number | undefined {
  if (p.netCentimes !== undefined) return p.netCentimes;
  if (p.grossCentimes !== undefined) return pct(p.grossCentimes, NET_SHARE_OF_GROSS_BP);
  return undefined;
}

/** Cantonal + communal + federal income tax on the salaries, minus `deducted`. */
function taxes(h: HouseholdInput, nets: number[], deducted: number, communeCentimes: number) {
  // Cantonal (ICC): net salaries minus the 3 % professional flat (640 to 1,812) minus deductions.
  const flatIcc = ICC_2025_PROFESSIONAL_FLAT.value;
  const iccIncome = Math.max(
    0,
    nets.reduce((sum, n) => sum + n - clamp(pct(n, flatIcc.rateBp), flatIcc.min, flatIcc.max), 0) -
      deducted,
  );
  // Splitting: couples and parents living with their children; half for shared custody.
  const splitting: IccSplitting = h.couple
    ? 'full'
    : h.children > 0 && h.custody !== 'elsewhere'
      ? h.custody === 'shared'
        ? 'partial'
        : 'full'
      : 'none';
  const cantonal = iccTotalIncomeTax2025(
    iccBaseIncomeTax2025(roundFranc(iccIncome), splitting),
    communeCentimes,
  );

  // Federal (IFD): professional flat (3 %, 2,000 to 4,000), insurance flat, married and child
  // deductions, minus deductions; the married scale also for single parents.
  const d = IFD_2026_DEDUCTIONS.value;
  const ifdIncome =
    nets.reduce(
      (sum, n) =>
        sum +
        n -
        clamp(pct(n, IFD_PROFESSIONAL_FLAT_RATE_BP.value), d.professionalMin, d.professionalMax),
      0,
    ) -
    (h.couple ? d.insuranceMarried : d.insuranceOther) -
    h.children * d.insurancePerChild -
    (h.couple ? d.married : 0) -
    h.children * d.child -
    deducted;
  const familyScale = h.couple || (h.children > 0 && h.custody !== 'elsewhere');
  const federal = ifdTax2026(
    Math.max(0, ifdIncome),
    familyScale ? 'married' : 'single',
    familyScale ? h.children : 0,
  );
  return { cantonal, federal };
}

/**
 * The household's income tax as a function of extra deductions, or undefined when no salary is
 * known (nothing to compute from: no figure is guessed).
 */
export function ordinaryTaxEstimator(h: HouseholdInput): Estimator | undefined {
  const nets = h.people.map(netOf);
  if (nets.every((n) => n === undefined)) return undefined;
  const assumptions: Assumption[] = ['icc_2025_scale', 'flat_deductions_only', 'home_commune_rate'];
  if (h.people.some((p) => p.netCentimes === undefined && p.grossCentimes !== undefined))
    assumptions.push('net_from_gross');
  if (nets.some((n) => n === undefined)) assumptions.push('no_income_for_some');
  if (!h.commune) assumptions.push('commune_default');
  const communeCentimes = COMMUNE_CENTIMES_2026.value[h.commune ?? 'geneve'];
  const known = nets.map((n) => n ?? 0);
  return {
    assumptions,
    sources: ESTIMATE_SOURCES,
    taxWith: (deductions) => {
      const deducted = deductions.reduce((sum, d) => sum + Math.max(0, d.centimes), 0);
      const { cantonal, federal } = taxes(h, known, deducted, communeCentimes);
      return {
        cantonalCentimes: cantonal,
        federalCentimes: federal,
        totalCentimes: cantonal + federal,
      };
    },
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
