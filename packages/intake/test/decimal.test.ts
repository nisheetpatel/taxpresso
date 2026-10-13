import { describe, expect, it } from 'vitest';
import {
  addDecimals,
  detectDecimalSeparator,
  formatDecimal,
  parseDecimal,
  ratio,
  roundHalfAwayFromZero,
  toCentimes,
} from '../src/broker/decimal.js';

const d = (s: string, sep: '.' | ',' = '.') => {
  const v = parseDecimal(s, sep);
  return v ? formatDecimal(v) : undefined;
};

describe('decimal strings, never floats', () => {
  it('reads the number formats exports use', () => {
    expect(d('1234.56')).toBe('1234.56');
    expect(d("1'234.56")).toBe('1234.56');
    expect(d('1’234.56')).toBe('1234.56');
    expect(d('1,234,567.5')).toBe('1234567.5');
    expect(d('1 234,56', ',')).toBe('1234.56');
    expect(d('1.234,56', ',')).toBe('1234.56');
    expect(d('-0,61', ',')).toBe('-0.61');
    expect(d('(12.50)')).toBe('-12.5');
    expect(d('12.50-')).toBe('-12.5');
    expect(d('+3')).toBe('3');
    expect(d('0.000001')).toBe('0.000001');
    expect(d('.5')).toBe('0.5');
    expect(d('\u22127')).toBe('-7');
  });

  it('refuses what it can’t read for sure', () => {
    for (const bad of ['', '-', 'abc', '1e5', '1,23,4', '12.3.4', 'CHF 12', '1,2345,678', 'NaN']) {
      expect(parseDecimal(bad), bad).toBeUndefined();
    }
    // A grouping separator must sit between groups of three.
    expect(parseDecimal('12,34.5')).toBeUndefined();
  });

  it('keeps exact units, beyond what a float can hold', () => {
    const big = parseDecimal('123456789012345678.91')!;
    expect(big.units).toBe(12345678901234567891n);
    expect(big.scale).toBe(2);
    expect(formatDecimal(addDecimals(parseDecimal('0.1')!, parseDecimal('0.2')!))).toBe('0.3');
  });

  it('tells decimal commas from decimal points by the numbers in the file', () => {
    expect(detectDecimalSeparator(['1,23', '45,00'])).toEqual({ separator: ',', ambiguous: false });
    expect(detectDecimalSeparator(['1.234,56'])).toEqual({ separator: ',', ambiguous: false });
    expect(detectDecimalSeparator(['1,234.56', '7'])).toEqual({ separator: '.', ambiguous: false });
    expect(detectDecimalSeparator(['0.5'])).toEqual({ separator: '.', ambiguous: false });
    expect(detectDecimalSeparator(['1,234'])).toEqual({ separator: undefined, ambiguous: true });
    expect(detectDecimalSeparator(['12', 'USD'])).toEqual({
      separator: undefined,
      ambiguous: false,
    });
    expect(detectDecimalSeparator(['1,5', '1.5'])).toEqual({
      separator: undefined,
      ambiguous: true,
    });
  });
});

describe('CHF conversion and the one rounding rule', () => {
  const chf = (amount: string, rate: string) =>
    toCentimes(ratio.mul(ratio.of(parseDecimal(amount)!), ratio.of(parseDecimal(rate)!)));

  it('rounds to the centime once, halves away from zero, as integers', () => {
    expect(chf('5', '0.88125')).toBe(441); // 4.40625 CHF
    expect(chf('-0.75', '0.88125')).toBe(-66); // -0.6609375
    expect(chf('0.01', '0.5')).toBe(1); // 0.005 -> 0.01
    expect(chf('-0.01', '0.5')).toBe(-1); // -0.005 -> -0.01
    expect(chf('0.01', '0.4999')).toBe(0);
    for (const v of [chf('1255', '0.8'), chf('350.35', '0.8'), chf('2.5', '0.9')]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('sums exactly before rounding', () => {
    // 4.40625 + 4.406 = 8.81225 CHF: 881 centimes. Rounding each first would give 441 + 441 = 882.
    const sum = ratio.add(
      ratio.mul(ratio.of(parseDecimal('5')!), ratio.of(parseDecimal('0.88125')!)),
      ratio.mul(ratio.of(parseDecimal('5')!), ratio.of(parseDecimal('0.8812')!)),
    );
    expect(toCentimes(sum)).toBe(881);
  });

  it('divides by a cross rate exactly', () => {
    // USD 2.50 with CHF at 1.136 USD: 2.2007042... CHF.
    const exact = ratio.div(ratio.of(parseDecimal('2.5')!), ratio.of(parseDecimal('1.136')!));
    expect(toCentimes(exact)).toBe(220);
    expect(roundHalfAwayFromZero({ num: 5n, den: 2n })).toBe(3n);
    expect(roundHalfAwayFromZero({ num: -5n, den: 2n })).toBe(-3n);
    expect(roundHalfAwayFromZero({ num: 7n, den: 3n })).toBe(2n);
    expect(() => ratio.div(ratio.int(1), ratio.zero)).toThrow(RangeError);
  });

  it('refuses amounts beyond safe integers instead of losing precision', () => {
    expect(() => toCentimes(ratio.int(10n ** 20n))).toThrow(RangeError);
  });
});
