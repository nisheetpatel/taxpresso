import { describe, expect, it } from 'vitest';
import { formatMoneyPlain, invalidValue, isIsoDate, parseDate, parseMoney } from '../src/index.js';

const centimes = (text: string) => {
  const r = parseMoney(text);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};
const refused = (text: string) => {
  const r = parseMoney(text);
  return r.ok ? `accepted as ${r.value}` : r.reason;
};

describe('reading money printed on documents', () => {
  it('reads the usual Swiss and international ways of writing an amount', () => {
    expect(centimes("12'345.60")).toBe(1_234_560);
    expect(centimes('12’345.60')).toBe(1_234_560);
    expect(centimes('12 345,60')).toBe(1_234_560);
    expect(centimes('12\u202f345,60')).toBe(1_234_560);
    expect(centimes('12\u00a0345.60')).toBe(1_234_560);
    expect(centimes('CHF 12,345.60')).toBe(1_234_560);
    expect(centimes('12.345,60')).toBe(1_234_560);
    expect(centimes('12345.6')).toBe(1_234_560);
    expect(centimes('12345,60 CHF')).toBe(1_234_560);
    expect(centimes('1,234,567.05')).toBe(123_456_705);
    expect(centimes("1'234'567")).toBe(123_456_700);
    expect(centimes('1.234.567')).toBe(123_456_700);
    expect(centimes('85000')).toBe(8_500_000);
    expect(centimes('0.05')).toBe(5);
    expect(centimes('Fr. 80.-')).toBe(8_000);
    expect(centimes("CHF 1'200.\u2013")).toBe(120_000);
    expect(centimes('-50.00')).toBe(-5_000);
    expect(centimes('  7258.00  ')).toBe(725_800);
  });

  it('never uses floating point: every centime is exact', () => {
    // 0.1 + 0.2 style traps: these must come out exact.
    expect(centimes('0.29')).toBe(29);
    expect(centimes('1.15')).toBe(115);
    expect(centimes("9'999'999'999.99")).toBe(999_999_999_999);
  });

  it('refuses anything that could mean two amounts, and says why', () => {
    expect(refused('12,345')).toMatch(/ambiguous/);
    expect(refused('12.345')).toMatch(/ambiguous/);
    expect(refused('12.3456')).toMatch(/4 digits/);
    expect(refused("1'234.567")).toMatch(/3 digits/);
    expect(refused('1,2,3')).toMatch(/don't line up/);
    expect(refused("12'34.00")).toMatch(/don't line up/);
    expect(refused("1 234'567.00")).toMatch(/mixes/);
    expect(refused('1.234.56,00')).toMatch(/don't line up/);
    expect(refused('12.34.56')).toMatch(/don't line up/);
    expect(refused('1,234.56.7')).toMatch(/two decimal/);
    expect(refused('')).toMatch(/empty/);
    expect(refused('abc')).toMatch(/not an amount/);
    expect(refused('12a')).toMatch(/not an amount/);
    expect(refused('1e5')).toMatch(/not part of an amount/);
    expect(refused('$12.00')).toMatch(/not an amount/);
    expect(refused('99999999999999.00')).toMatch(/too large/);
  });

  it('writes amounts as typed on a form', () => {
    expect(formatMoneyPlain(1_234_560)).toBe('12345.60');
    expect(formatMoneyPlain(5)).toBe('0.05');
    expect(formatMoneyPlain(8_500_000)).toBe('85000.00');
    expect(formatMoneyPlain(-5_000)).toBe('-50.00');
  });
});

describe('reading dates', () => {
  it('reads ISO and Swiss dates, and refuses impossible ones', () => {
    expect(parseDate('2027-03-15')).toEqual({ ok: true, value: '2027-03-15' });
    expect(parseDate('15.03.2027')).toEqual({ ok: true, value: '2027-03-15' });
    expect(parseDate('1.3.2027')).toEqual({ ok: true, value: '2027-03-01' });
    expect(parseDate('29.02.2027').ok).toBe(false);
    expect(parseDate('29.02.2028').ok).toBe(true);
    expect(parseDate('03/15/2027').ok).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
  });

  it('checks date values in the ledger', () => {
    const def = { type: 'date' as const, perPerson: false, label: { en: 'd', fr: 'd' } };
    expect(invalidValue(def, '2027-03-15')).toBeUndefined();
    expect(invalidValue(def, '15.03.2027')).toMatch(/YYYY-MM-DD/);
    expect(invalidValue(def, 20270315)).toMatch(/YYYY-MM-DD/);
  });
});
