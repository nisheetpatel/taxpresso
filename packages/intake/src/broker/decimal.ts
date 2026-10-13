// Exact decimal arithmetic for amounts read from broker exports. Money is integer centimes, never
// floats (SPEC.md section 4), and that includes currency conversion: a decimal string becomes a
// scaled BigInt, conversions multiply and divide exact fractions, and the result is rounded once.
//
// Rounding rule (the only one): an amount in CHF is computed exactly, summed exactly, and rounded
// once, when it becomes a fact, to the nearest centime, halves away from zero (0.005 -> 0.01,
// -0.005 -> -0.01).

/** units / 10^scale, e.g. 12.30 = { units: 1230n, scale: 2 }. */
export interface Decimal {
  readonly units: bigint;
  readonly scale: number;
}

/** num / den, den > 0. */
export interface Ratio {
  readonly num: bigint;
  readonly den: bigint;
}

export type DecimalSeparator = '.' | ',';

/** Characters people and banks use to group thousands: spaces, apostrophes, underscores. */
const GROUPING = /[\s\u00a0\u202f'\u2019_]/g;
const MAX_DIGITS = 40;

/**
 * Parses "1'234.56", "1,234.56", "1.234,56" (with ","), "-0,61", "(12.50)", "12.50-" and "+3".
 * Returns undefined for anything else: no exponents, no currency signs, no guessing.
 */
export function parseDecimal(text: string, decimal: DecimalSeparator = '.'): Decimal | undefined {
  let s = text.trim();
  if (!s) return undefined;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-') || s.startsWith('\u2212')) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  } else if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(GROUPING, '');
  const group = decimal === '.' ? ',' : '.';
  const parts = s.split(decimal);
  if (parts.length > 2) return undefined;
  let int = parts[0] ?? '';
  const frac = parts[1] ?? '';
  if (int.includes(group)) {
    // A grouping separator only between groups of three digits: "1,234,567".
    if (!new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`).test(int)) return undefined;
    int = int.split(group).join('');
  }
  if (!/^\d*$/.test(int) || !/^\d*$/.test(frac)) return undefined;
  if (int === '' && frac === '') return undefined;
  if (parts.length === 2 && frac === '' && int === '') return undefined;
  const digits = (int || '0') + frac;
  if (digits.length > MAX_DIGITS) return undefined;
  const units = BigInt(digits);
  return { units: negative ? -units : units, scale: frac.length };
}

/**
 * Which character a file uses as its decimal separator, from its numbers. "1,234" alone proves
 * nothing (a thousand, or one and a bit); "1,23", "1.234,56" or "0.5" do.
 */
export function detectDecimalSeparator(samples: readonly string[]): {
  separator: DecimalSeparator | undefined;
  ambiguous: boolean;
} {
  const votes = { '.': 0, ',': 0 };
  let ambiguous = false;
  for (const raw of samples) {
    const s = raw.replace(GROUPING, '').replace(/^[(+\u2212-]+|[)-]+$/g, '');
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) continue;
    const dots = s.split('.').length - 1;
    const commas = s.split(',').length - 1;
    if (dots && commas) {
      votes[s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',']++;
    } else if (dots || commas) {
      const sep: DecimalSeparator = dots ? '.' : ',';
      const other: DecimalSeparator = dots ? ',' : '.';
      if ((dots || commas) > 1) votes[other]++;
      else if (s.length - s.lastIndexOf(sep) - 1 !== 3) votes[sep]++;
      else ambiguous = true;
    }
  }
  if (votes['.'] && votes[',']) return { separator: undefined, ambiguous: true };
  if (votes['.']) return { separator: '.', ambiguous: false };
  if (votes[',']) return { separator: ',', ambiguous: false };
  return { separator: undefined, ambiguous };
}

/** "-12.5", "0.0001", "1234": no grouping, no trailing zeros. */
export function formatDecimal(d: Decimal): string {
  const negative = d.units < 0n;
  let digits = (negative ? -d.units : d.units).toString();
  if (d.scale > 0) {
    digits = digits.padStart(d.scale + 1, '0');
    const int = digits.slice(0, digits.length - d.scale);
    const frac = digits.slice(digits.length - d.scale).replace(/0+$/, '');
    digits = frac ? `${int}.${frac}` : int;
  }
  return negative && digits !== '0' ? `-${digits}` : digits;
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
}

function reduce(num: bigint, den: bigint): Ratio {
  if (den === 0n) throw new RangeError('division by zero');
  if (den < 0n) [num, den] = [-num, -den];
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export const ratio = {
  of: (d: Decimal): Ratio => reduce(d.units, pow10(d.scale)),
  int: (n: bigint | number): Ratio => ({ num: BigInt(n), den: 1n }),
  zero: { num: 0n, den: 1n } as Ratio,
  add: (a: Ratio, b: Ratio): Ratio => reduce(a.num * b.den + b.num * a.den, a.den * b.den),
  mul: (a: Ratio, b: Ratio): Ratio => reduce(a.num * b.num, a.den * b.den),
  div: (a: Ratio, b: Ratio): Ratio => {
    if (b.num === 0n) throw new RangeError('division by zero');
    return reduce(a.num * b.den, a.den * b.num);
  },
  neg: (a: Ratio): Ratio => ({ num: -a.num, den: a.den }),
  isZero: (a: Ratio): boolean => a.num === 0n,
  sign: (a: Ratio): -1 | 0 | 1 => (a.num < 0n ? -1 : a.num > 0n ? 1 : 0),
};

/** The integer nearest to `r`, halves away from zero. */
export function roundHalfAwayFromZero(r: Ratio): bigint {
  const q = r.num / r.den; // truncates toward zero
  const rem = r.num % r.den;
  const twice = 2n * (rem < 0n ? -rem : rem);
  if (twice >= r.den) return r.num < 0n ? q - 1n : q + 1n;
  return q;
}

/** An exact amount in CHF, rounded once to integer centimes (the rounding rule above). */
export function toCentimes(chf: Ratio): number {
  const centimes = roundHalfAwayFromZero(ratio.mul(chf, ratio.int(100)));
  const n = Number(centimes);
  if (!Number.isSafeInteger(n)) throw new RangeError('amount too large');
  return n;
}

/** Adds decimals exactly (for quantities). */
export function addDecimals(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return {
    units: a.units * pow10(scale - a.scale) + b.units * pow10(scale - b.scale),
    scale,
  };
}

/** a * b exactly. */
export function mulDecimals(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export const isZeroDecimal = (d: Decimal): boolean => d.units === 0n;
