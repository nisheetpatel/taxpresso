// The tariffs against rows of the canton's tables, as printed (Tarif A and Tarif B, "Steuerbetrag
// in Franken"; wealth to the centime). scripts/ag-tariff.mjs --check runs every row; these are a
// sample with their pages, so the test runs without the PDFs.
import { describe, expect, it } from 'vitest';
import {
  agParamsFor,
  incomeSimpleTax,
  stepsTotal,
  tariffFraction,
  wealthSimpleTax,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

/** ag-2025-tariff-einkommenssteuer: [page, income, Tarif A, Tarif B]. */
const INCOME_ROWS = [
  [3, 4_300, 0, 0],
  [3, 4_400, 1, 0],
  [4, 8_700, 50, 1],
  [7, 25_000, 639, 262],
  [12, 51_400, 2_496, 1_348],
  [13, 60_000, 3_227, 1_864],
  [17, 77_200, 4_772, 3_006],
  [21, 100_000, 6_938, 4_768],
  [30, 150_000, 11_887, 9_126],
  [57, 300_000, 27_505, 23_775],
  [70, 1_000_000, 104_242, 98_484],
] as const;

/** ag-2025-tariff-vermoegenssteuer: [page, wealth, einfache Steuer]. */
const WEALTH_ROWS = [
  [3, 107_000, 74.9],
  [3, 108_000, 75.9],
  [6, 428_000, 460.1],
  [6, 429_000, 461.7],
  [16, 1_670_000, 2_447.3],
] as const;

describe('income tariff (StG § 43, Progressionsverordnung 2025 § 1)', () => {
  for (const year of [2025, 2026] as const) {
    const T = agParamsFor(year).incomeTariff.value;
    for (const [page, income, a, b] of INCOME_ROWS) {
      it(`${year}: ${income} gives A ${a}, B ${b} (p. ${page})`, () => {
        expect(incomeSimpleTax(T, chf(income), 'A')).toBe(chf(a));
        expect(incomeSimpleTax(T, chf(income), 'B')).toBe(chf(b));
      });
    }
    it(`${year}: the last step ends at 352,700 (11 % above); nothing below 4,300`, () => {
      expect(stepsTotal(T)).toBe(352_700);
      expect(T.above).toBe(110);
      expect(tariffFraction(T, chf(4_300))).toBe(0);
    });
  }
});

describe('wealth tariff (StG § 55)', () => {
  for (const year of [2025, 2026] as const) {
    const W = agParamsFor(year).wealthTariff.value;
    for (const [page, wealth, tax] of WEALTH_ROWS) {
      it(`${year}: ${wealth} gives ${tax} (p. ${page})`, () => {
        expect(wealthSimpleTax(W, chf(wealth))).toBe(chf(tax));
      });
    }
    it(`${year}: 1.6 per mille above 428,000; only whole CHF 1,000`, () => {
      expect(stepsTotal(W)).toBe(428_000);
      expect(() => wealthSimpleTax(W, chf(1_500))).toThrow(RangeError);
    });
  }
});

describe('cantonal Steuerfuss (ag-2026-communal-kantonssteuerfuss-zinssaetze p. 1)', () => {
  it('2025: 108 % + 3 % = 111 %; 2026: 100 % + 3 % = 103 %', () => {
    expect(agParamsFor(2025).cantonalRate.value).toBe(111);
    expect(agParamsFor(2026).cantonalRate.value).toBe(103);
  });
});
