// Geneva cantonal and communal income tax (ICC), tax year 2025. All money in integer centimes.
// Source: ge-2025-icc-tariff-pdf (Barèmes 2025), p. 2 (income scale, splitting), p. 3 and 4
// (worked examples and the cantonal and communal surcharges). The 2026 scale is published in
// January 2027; until then this is the latest official scale.
import type { Cited } from '@taxpresso/rules-ch';

/** [upper bound of the bracket in CHF, rate in hundredths of a percent]. p. 2. */
export const ICC_2025_INCOME_SCALE: Cited<readonly (readonly [number, number])[]> = {
  source: 'ge-2025-icc-tariff-pdf p. 2',
  value: [
    [18_649, 0],
    [22_469, 730],
    [24_716, 820],
    [26_962, 910],
    [29_210, 1000],
    [34_827, 1090],
    [39_320, 1130],
    [43_815, 1230],
    [48_309, 1280],
    [77_518, 1320],
    [126_950, 1420],
    [170_764, 1500],
    [193_234, 1560],
    [276_369, 1580],
    [294_345, 1600],
    [414_554, 1680],
    [649_355, 1760],
    [Number.POSITIVE_INFINITY, 1800],
  ],
};

/** Cantonal surcharge 47.5 %, then minus 12 %, then plus 1 % of the base for home care. p. 4. */
export const ICC_2025_CANTONAL_CENTIMES_BP: Cited<number> = {
  value: 4750,
  source: 'ge-2025-icc-tariff-pdf p. 4',
};
export const ICC_2025_REDUCTION_BP: Cited<number> = {
  value: 1200,
  source: 'ge-2025-icc-tariff-pdf p. 4',
};
export const ICC_2025_HOME_CARE_BP: Cited<number> = {
  value: 100,
  source: 'ge-2025-icc-tariff-pdf p. 4',
};

/**
 * Splitting (LIPP art. 41, quoted on p. 2): the rate is the one for 50 % of the income for couples
 * living together and single parents supporting their children (al. 2, 3); 55.56 % for a parent
 * sharing custody half and half (al. 4).
 */
export type IccSplitting = 'none' | 'full' | 'partial';
const SPLIT_SHARE_PER_10000: Record<IccSplitting, number> = {
  none: 10_000,
  full: 5_000,
  partial: 5_556,
};

/** Rounds centimes to the nearest 5, as the scale's own figures do (p. 2, p. 3 example 2). */
const round5 = (centimes: number) => Math.round(centimes / 5) * 5;

/** Base tax on an income, before any surcharge (p. 3, example 2). */
function scaleTax(incomeCentimes: number): number {
  let previousUpper = 0;
  let cumulative = 0;
  for (const [upperChf, rate] of ICC_2025_INCOME_SCALE.value) {
    const upper = upperChf === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : upperChf * 100;
    if (incomeCentimes <= upper) {
      return cumulative + round5(((incomeCentimes - previousUpper) * rate) / 10_000);
    }
    cumulative += round5(((upper - previousUpper) * rate) / 10_000);
    previousUpper = upper;
  }
  return cumulative;
}

/** ICC base income tax ("impôt de base"), p. 2 to 4. Income in whole francs, as centimes. */
export function iccBaseIncomeTax2025(
  incomeCentimes: number,
  splitting: IccSplitting = 'none',
): number {
  if (incomeCentimes <= 0) return 0;
  if (splitting === 'none') return scaleTax(incomeCentimes);
  // Rate income = share of the income, in whole francs; tax = income x tax(rate income) / rate
  // income (examples 3 and 4: 86,949 x 55.56 % is taken as 48,309).
  const rateIncome =
    Math.round((incomeCentimes * SPLIT_SHARE_PER_10000[splitting]) / 1_000_000) * 100;
  return round5((incomeCentimes * scaleTax(rateIncome)) / rateIncome);
}

/**
 * Cantonal and communal income tax from the base tax (p. 4): base + 47.5 %, minus 12 % of that,
 * plus 1 % of the base, plus the commune's centimes on the base. `communeCentimes` in hundredths
 * (e.g. 45.49 -> 4549). Simplification: the whole communal part at the home commune's rate.
 */
export function iccTotalIncomeTax2025(baseCentimes: number, communeCentimes: number): number {
  const cantonal = (baseCentimes * (10_000 + ICC_2025_CANTONAL_CENTIMES_BP.value)) / 10_000;
  const afterReduction = (cantonal * (10_000 - ICC_2025_REDUCTION_BP.value)) / 10_000;
  const homeCare = (baseCentimes * ICC_2025_HOME_CARE_BP.value) / 10_000;
  const communal = (baseCentimes * communeCentimes) / 10_000;
  return round5(afterReduction + homeCare + communal);
}

/** Professional expenses flat deduction for ICC 2025: 3 % of net salary, min 640, max 1,812. */
export const ICC_2025_PROFESSIONAL_FLAT: Cited<{ rateBp: number; min: number; max: number }> = {
  value: { rateBp: 300, min: 64_000, max: 181_200 },
  source: 'ge-2025-guide-declaration-pp p. 11',
};
