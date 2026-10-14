// St. Gallen's income tariff (StG Art. 50): the einfache Steuer at 100 percent, by brackets, one
// tariff for everyone. 0 percent for the first bracket, then 4, 6, 8, 9.2 and 9.4 percent for the
// further amounts the law lists (Abs. 1); above the top amount, 8.5 percent of the whole income
// (Abs. 2). Married couples, and single parents who live with children and mainly bear their upkeep,
// pay the rate of half their taxable income on the whole income (Vollsplitting, Abs. 3 and 4).
//
// How the tax is found (the tariff of the year, sg-<year>-tariff-einkommen-vermoegen p. 1): "die
// Rappen sind kaufmännisch gerundet", which the table shows to be the nearest 5 Rappen (with
// Vollsplitting, 50,100 gives 1,442.88 and the table prints 1,442.90; 60,700 gives 2,079.4257 and it
// prints 2,079.45; scripts/sg-tariff.mjs --check finds no row that rounds otherwise); for Vollsplitting,
// the rate is the one for half the income rounded down to 100 francs, and above twice the top amount
// the whole income pays 8.5 percent. scripts/sg-tariff.mjs --check runs this module against every
// row of each year's tariff table, for a single person and with Vollsplitting;
// test/tariffs.test.ts keeps a sample with the table's page.
//
// Exact integers throughout: a rate in tenths of a percent times francs is tenths of centimes.
// No imports of values: scripts/sg-tariff.mjs reads this module with Node's type stripping.

export interface IncomeTariff {
  /**
   * [the bracket's width in CHF, its rate in tenths of a percent], from zero, in the law's order:
   * [11_600, 0] is "0 Prozent für die ersten Fr. 11 600", [4_200, 40] "4 Prozent für die weiteren
   * Fr. 4 200".
   */
  brackets: readonly (readonly [number, number])[];
  /** Above this taxable income (CHF), the whole income at `topRate` (Abs. 2). */
  topFrom: number;
  /** The rate on the whole income above `topFrom`, in tenths of a percent (8.5 % -> 85). */
  topRate: number;
}

/** The brackets' tax on `chf` francs, in tenths of centimes (an integer): chf at most `topFrom`. */
export function bracketTenths(f: IncomeTariff, chf: number): number {
  let left = Math.max(0, chf);
  let tenths = 0;
  for (const [width, rate] of f.brackets) {
    const part = Math.min(left, width);
    tenths += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  if (left > 0) throw new RangeError(`${chf} is above the brackets (${f.topFrom}).`);
  return tenths;
}

/** num / den tenths of centimes to the nearest 5 centimes, halves up (kaufmännisch). num >= 0. */
const centimes = (num: number, den: number) => Math.floor((2 * num + 50 * den) / (100 * den)) * 5;

export interface IncomeTariffTax {
  /** The einfache Steuer in centimes, a multiple of 5. */
  tax: number;
  /** The income that set the rate, in CHF: the taxable income, or half of it rounded down to 100. */
  rateIncome: number;
  /** The rate applied, as an exact fraction: numerator / denominator (0 / 1 when no tax). */
  rate: { num: number; den: number };
  /** Above the top amount: 8.5 percent of the whole income (Abs. 2). */
  top: boolean;
}

/**
 * The einfache Steuer on a taxable income in centimes (whole francs taken): by brackets, or with
 * Vollsplitting at the rate of half the income (rounded down to 100 francs), or above the top amount
 * (twice it with Vollsplitting) 8.5 percent of the whole income; to the nearest 5 Rappen.
 */
export function incomeTariffTax(
  f: IncomeTariff,
  taxableCentimes: number,
  splitting: boolean,
): IncomeTariffTax {
  const x = Math.floor(Math.max(0, taxableCentimes) / 100);
  if (!Number.isSafeInteger(x * 2_000_000)) throw new RangeError('Income too large.');
  const limit = splitting ? 2 * f.topFrom : f.topFrom;
  if (x > limit) {
    // x francs at topRate tenths of a percent: x * topRate tenths of centimes.
    return {
      tax: centimes(x * f.topRate, 1),
      rateIncome: splitting ? Math.floor(x / 200) * 100 : x,
      rate: { num: f.topRate, den: 1000 },
      top: true,
    };
  }
  if (!splitting) {
    const tenths = bracketTenths(f, x);
    return {
      tax: centimes(tenths, 1),
      rateIncome: x,
      rate: x ? { num: tenths, den: x * 1000 } : { num: 0, den: 1 },
      top: false,
    };
  }
  const h = Math.floor(x / 200) * 100;
  const tenths = bracketTenths(f, h);
  if (!h || !tenths) return { tax: 0, rateIncome: h, rate: { num: 0, den: 1 }, top: false };
  // x francs at the rate tenths / (h * 1000): x * tenths / h tenths of centimes.
  return {
    tax: centimes(x * tenths, h),
    rateIncome: h,
    rate: { num: tenths, den: h * 1000 },
    top: false,
  };
}

/** A rate as the tariff prints it, a percentage to four decimals: "4.3600 %" ("4,3600 %"). */
export function ratePercent(rate: { num: number; den: number }, lang: 'en' | 'fr'): string {
  // num / den as a fraction; x 100 percent; four decimals: x 1,000,000, halves up.
  const units = Math.floor((2 * rate.num * 1_000_000 + rate.den) / (2 * rate.den));
  const s = `${Math.floor(units / 10_000)}.${String(units % 10_000).padStart(4, '0')}`;
  return `${lang === 'fr' ? s.replace('.', ',') : s}\u00a0%`;
}

/** The wealth tax (StG Art. 65): per mille of the taxable wealth, francs under 1,000 dropped. */
export interface WealthTariff {
  /** The einfache Steuer in tenths of a per mille (1.7 per mille -> 17). */
  rate: number;
  /** Remainders under this many CHF are dropped (Abs. 2: Restbeträge unter Fr. 1000). */
  step: number;
}

/** The einfache Steuer on a taxable wealth in centimes: the wealth in whole steps, at the rate. */
export function wealthTariffTax(
  w: WealthTariff,
  taxableCentimes: number,
): {
  tax: number;
  base: number;
} {
  const chf = Math.floor(Math.max(0, taxableCentimes) / 100);
  const base = Math.floor(chf / w.step) * w.step;
  // base CHF x rate tenths of a per mille = base x rate / 10,000 CHF = base x rate / 100 centimes.
  return { tax: Math.floor((2 * base * w.rate + 100) / 200), base: base * 100 };
}
