// Federal direct tax (IFD), tax year 2026. All money in integer centimes.
// Sources: ch-2026-ifd-progression-deductions (circular of 11 September 2025): p. 4 the scales of
// art. 36 LIFD, al. 2bis and al. 3; p. 2 the deductions. ch-2026-ifd-tarif-personnes-physiques
// (Form. 58c 2026), footnotes 1 and 2 for rounding.
import type { Cited } from '../core/cited.js';

/** [income in CHF where the step starts, tax there in centimes, centimes per further CHF 100]. */
type Step = readonly [number, number, number];

export const IFD_2026_SINGLE: Cited<readonly Step[]> = {
  source: 'ch-2026-ifd-progression-deductions p. 4 (art. 36 al. 1)',
  value: [
    [15_200, 0, 77],
    [33_200, 13_860, 88],
    [43_500, 22_920, 264],
    [58_000, 61_200, 297],
    [76_200, 115_250, 594],
    [82_100, 150_295, 660],
    [108_900, 327_175, 880],
    [141_500, 614_055, 1100],
    [185_100, 1_093_655, 1320],
    [794_000, 9_131_000, 1150],
  ],
};

/** Married couples living together; also single-parent families (Form. 58c, column header). */
export const IFD_2026_MARRIED: Cited<readonly Step[]> = {
  source: 'ch-2026-ifd-progression-deductions p. 4 (art. 36 al. 2)',
  value: [
    [29_700, 0, 100],
    [53_400, 23_700, 200],
    [61_300, 39_500, 300],
    [79_100, 92_900, 400],
    [94_900, 156_100, 500],
    [108_700, 225_100, 600],
    [120_600, 296_500, 700],
    [130_500, 365_800, 800],
    [138_400, 429_000, 900],
    [144_300, 482_100, 1000],
    [148_300, 522_100, 1100],
    [150_400, 545_200, 1200],
    [152_400, 569_200, 1300],
    [941_400, 10_826_100, 1150],
  ],
};

export const IFD_2026_CHILD_TAX_REDUCTION: Cited<number> = {
  value: 26_300,
  source: 'ch-2026-ifd-progression-deductions p. 4 (art. 36 al. 2bis)',
};
export const IFD_2026_MINIMUM_COLLECTED: Cited<number> = {
  value: 2_500,
  source: 'ch-2026-ifd-progression-deductions p. 4 (art. 36 al. 3)',
};

/** Deductions for tax year 2026, p. 2. */
export const IFD_2026_DEDUCTIONS: Cited<{
  professionalMin: number;
  professionalMax: number;
  insuranceMarried: number;
  insuranceOther: number;
  insurancePerChild: number;
  child: number;
  married: number;
}> = {
  source: 'ch-2026-ifd-progression-deductions p. 2',
  value: {
    professionalMin: 200_000,
    professionalMax: 400_000,
    insuranceMarried: 370_000, // with contributions to the 2nd pillar and 3a
    insuranceOther: 180_000, // with contributions to the 2nd pillar and 3a
    insurancePerChild: 70_000,
    child: 680_000,
    married: 280_000,
  },
};

/** 3 % rate of the professional expenses flat (same in the cantonal guide). */
export const IFD_PROFESSIONAL_FLAT_RATE_BP: Cited<number> = {
  value: 300,
  source: 'ge-2025-guide-declaration-pp p. 11',
};

/** The scale itself (Form. 58c lists these values before rounding). */
export function ifdScaleTax2026(taxableCentimes: number, scale: 'single' | 'married'): number {
  const income = Math.floor(Math.max(0, taxableCentimes) / 10_000) * 100; // fractions under CHF 100 dropped
  const steps = (scale === 'single' ? IFD_2026_SINGLE : IFD_2026_MARRIED).value;
  let tax = 0;
  for (const [start, base, per100] of steps) {
    if (income >= start) tax = base + ((income - start) / 100) * per100;
  }
  return tax;
}

/**
 * IFD due on a taxable income: the scale, rounded down to 5 centimes (Form. 58c footnotes 1, 2),
 * minus CHF 263 per child on the married and single-parent scale, nothing collected under CHF 25.
 */
export function ifdTax2026(
  taxableCentimes: number,
  scale: 'single' | 'married',
  children = 0,
): number {
  let tax = Math.floor(ifdScaleTax2026(taxableCentimes, scale) / 5) * 5;
  if (scale === 'married') tax = Math.max(0, tax - children * IFD_2026_CHILD_TAX_REDUCTION.value);
  return tax < IFD_2026_MINIMUM_COLLECTED.value ? 0 : tax;
}
