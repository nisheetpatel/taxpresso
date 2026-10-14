// "Before 31 December": pillar 3a room and the tax it would save (SPEC.md section 8, group B).
// The saving is the rules engine run twice, with and without paying the room in. It is an
// estimate: in Geneva on its 2025 scale (2026 is published in January 2027); in Zurich with the
// rules its documents don't spell out applied as in the estimate.
import { PILLAR3A_2026 } from '@taxpresso/rules-ch';
import {
  type Assumption,
  estimateSources,
  type HouseholdInput,
  netOf,
  ordinaryTaxEstimator,
  type PersonInput,
  pct,
  savingOf,
} from './tax-with.js';

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

export function pillar3aPlan(h: HouseholdInput): Pillar3aResult {
  const assumptions = new Set<Assumption>(
    h.other
      ? [h.other.plan.assumptions.preview, 'flat_deductions_only']
      : ['icc_2025_scale', 'flat_deductions_only', 'home_commune_rate'],
  );
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
  const sources = [PILLAR3A_2026.source, ...estimateSources(h)];
  const estimator = ordinaryTaxEstimator(h);
  if (!estimator) return { people, roomCentimes, assumptions: [...assumptions], sources };
  // The engine says what it assumed for this household.
  assumptions.clear();
  for (const a of estimator.assumptions) assumptions.add(a);
  // The room paid in on top of what each person already paid: the engine run with and without.
  const paid = h.people.map((p) => ({
    person: p.person,
    kind: 'pillar3a' as const,
    centimes: p.paidCentimes,
  }));
  const room = people.map((p) => ({
    person: p.person,
    kind: 'pillar3a' as const,
    centimes: p.roomCentimes,
  }));
  const saving = savingOf(estimator.taxWith, paid, room);
  return {
    people,
    roomCentimes,
    saving: {
      totalCentimes: saving.totalCentimes,
      cantonalCentimes: saving.cantonalCentimes,
      federalCentimes: saving.federalCentimes,
    },
    assumptions: [...assumptions],
    sources,
  };
}
