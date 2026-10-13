// "Before 31 December": pillar 3a room and the tax it would save (SPEC.md section 8, group B).
// The saving is the rules engine run twice, with and without paying the room in. It is an
// estimate: Geneva's 2025 scale (2026 is published in January 2027), and only flat deductions.
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
  PILLAR3A_2026,
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

export interface PersonResult {
  person: 'p1' | 'p2';
  capCentimes: number;
  /** True when the cap depends on an income we don't know yet (no pension fund). */
  capIsMaximum: boolean;
  paidCentimes: number;
  roomCentimes: number;
}

export interface Pillar3aResult {
  people: PersonResult[];
  roomCentimes: number;
  /** Only when at least one income is known. */
  saving?: { totalCentimes: number; cantonalCentimes: number; federalCentimes: number };
  assumptions: Assumption[];
  sources: string[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pct = (centimes: number, bp: number) => Math.round((centimes * bp) / 10_000);

function netOf(p: PersonInput): number | undefined {
  if (p.netCentimes !== undefined) return p.netCentimes;
  if (p.grossCentimes !== undefined) return pct(p.grossCentimes, NET_SHARE_OF_GROSS_BP);
  return undefined;
}

function capOf(p: PersonInput): { cap: number; isMaximum: boolean } {
  const c = PILLAR3A_2026.value;
  if (p.hasPensionFund) return { cap: c.capWithPensionFund, isMaximum: false };
  const net = netOf(p);
  if (net === undefined) return { cap: c.capWithoutPensionFund, isMaximum: true };
  return {
    cap: Math.min(c.capWithoutPensionFund, pct(net, c.shareWithoutPensionFundBp)),
    isMaximum: false,
  };
}

/** Cantonal + communal + federal income tax on salaries, with `extra3a` paid on top. */
function taxes(h: HouseholdInput, nets: number[], paid: number, communeCentimes: number) {
  // Cantonal (ICC): net salaries minus the 3 % professional flat (640 to 1,812) minus 3a.
  const flatIcc = ICC_2025_PROFESSIONAL_FLAT.value;
  const iccIncome = Math.max(
    0,
    nets.reduce((sum, n) => sum + n - clamp(pct(n, flatIcc.rateBp), flatIcc.min, flatIcc.max), 0) -
      paid,
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
  // deductions, minus 3a; the married scale also for single parents.
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
    paid;
  const familyScale = h.couple || (h.children > 0 && h.custody !== 'elsewhere');
  const federal = ifdTax2026(
    Math.max(0, ifdIncome),
    familyScale ? 'married' : 'single',
    familyScale ? h.children : 0,
  );
  return { cantonal, federal };
}

/** Taxable income is counted in whole francs. */
const roundFranc = (centimes: number) => Math.floor(centimes / 100) * 100;

export function pillar3aPlan(h: HouseholdInput): Pillar3aResult {
  const assumptions = new Set<Assumption>([
    'icc_2025_scale',
    'flat_deductions_only',
    'home_commune_rate',
  ]);
  const people: PersonResult[] = h.people.map((p) => {
    const { cap, isMaximum } = capOf(p);
    return {
      person: p.person,
      capCentimes: cap,
      capIsMaximum: isMaximum,
      paidCentimes: p.paidCentimes,
      roomCentimes: Math.max(0, cap - p.paidCentimes),
    };
  });
  const roomCentimes = people.reduce((sum, p) => sum + p.roomCentimes, 0);
  const sources = [
    PILLAR3A_2026.source,
    'ge-2025-icc-tariff-pdf p. 2, p. 4',
    ICC_2025_PROFESSIONAL_FLAT.source,
    COMMUNE_CENTIMES_2026.source,
    IFD_2026_DEDUCTIONS.source,
    'ch-2026-ifd-progression-deductions p. 4',
  ];

  const nets = h.people.map(netOf);
  if (nets.every((n) => n === undefined))
    return { people, roomCentimes, assumptions: [...assumptions], sources };
  if (h.people.some((p) => p.netCentimes === undefined && p.grossCentimes !== undefined))
    assumptions.add('net_from_gross');
  if (nets.some((n) => n === undefined)) assumptions.add('no_income_for_some');
  if (!h.commune) assumptions.add('commune_default');
  const communeCentimes = COMMUNE_CENTIMES_2026.value[h.commune ?? 'geneve'];
  const known = nets.map((n) => n ?? 0);
  const paid = h.people.reduce((sum, p) => sum + p.paidCentimes, 0);

  const before = taxes(h, known, paid, communeCentimes);
  const after = taxes(h, known, paid + roomCentimes, communeCentimes);
  const cantonalCentimes = before.cantonal - after.cantonal;
  const federalCentimes = before.federal - after.federal;
  return {
    people,
    roomCentimes,
    saving: {
      totalCentimes: cantonalCentimes + federalCentimes,
      cantonalCentimes,
      federalCentimes,
    },
    assumptions: [...assumptions],
    sources,
  };
}
