// Worked examples and totals printed in ge-2025-icc-tariff-pdf, pp. 2 to 4, in centimes.
import { describe, expect, it } from 'vitest';
import { iccBaseIncomeTax2025, iccTotalIncomeTax2025 } from '../src/2025/icc.js';

describe('ICC 2025 base income tax', () => {
  it('matches the cumulative column of the scale (p. 2)', () => {
    const cumulative: [number, number][] = [
      [18_649, 0],
      [22_469, 27_885],
      [24_716, 46_310],
      [29_210, 89_230],
      [48_309, 314_040],
      [77_518, 699_600],
      [126_950, 1_401_535],
      [193_234, 2_409_275],
      [294_345, 4_010_425],
      [649_355, 10_162_435],
    ];
    for (const [income, tax] of cumulative)
      expect(iccBaseIncomeTax2025(income * 100), String(income)).toBe(tax);
  });

  it('matches the four worked examples (pp. 3 and 4)', () => {
    expect(iccBaseIncomeTax2025(7_751_800)).toBe(699_600); // example 1
    expect(iccBaseIncomeTax2025(5_000_000)).toBe(336_360); // example 2
    expect(iccBaseIncomeTax2025(9_661_800, 'full')).toBe(628_080); // example 3, splitting
    expect(iccBaseIncomeTax2025(8_694_900, 'partial')).toBe(565_225); // example 4, partial splitting
  });

  it('adds the cantonal and communal surcharges (p. 4)', () => {
    // No printed example: this pins the order of p. 4. Base 3,363.60 x 1.475 x 0.88 = 4,365.95,
    // + 1 % of the base = 33.64, + Meyrin 42 % of the base = 1,412.71: 5,812.30.
    expect(iccTotalIncomeTax2025(336_360, 4200)).toBe(581_230);
  });
});
