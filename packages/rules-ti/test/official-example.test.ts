// The worked examples and tables of the 2025 instructions (ti-2025-guide-istruzioni-pf-pdf) other
// than the tariffs (test/tariffs.test.ts), and the rules as the decrees and the law state them. The
// instructions have no worked example of a whole return.
import { describe, expect, it } from 'vitest';
import {
  avsExemption,
  debtInterestDeduction,
  drivingCost,
  insuranceCap,
  mealsCost,
  otherFlat,
  shareOfTax,
  tiParamsFor,
  twoEarnerDeduction,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

describe('private debt interest (13.2), p. 27', () => {
  // Income from securities 20,000 (4.1) + other movable 5,000 (4.2) + rental values 19,000 (5.1 to
  // 5.3) = 44,000; with 50,000 more, at most 94,000.
  const extra = tiParamsFor(2025).amounts.debtInterestExtra.value;
  it('example 1: 80,000 paid, 80,000 deducted', () => {
    expect(debtInterestDeduction(chf(80_000), chf(44_000), extra)).toEqual({
      cap: chf(94_000),
      deduction: chf(80_000),
    });
  });
  it('example 2: 120,000 paid, 94,000 deducted', () => {
    expect(debtInterestDeduction(chf(120_000), chf(44_000), extra).deduction).toBe(chf(94_000));
  });
  it('interest up to 50,000 is deductible without any income from wealth', () => {
    expect(debtInterestDeduction(chf(30_000), 0, extra).deduction).toBe(chf(30_000));
  });
});

describe('the exemption for AVS and AI pensioners (27), p. 32', () => {
  // [net income (cifra 26) in CHF, exemption for single people, for spouses and families].
  const TABLE: readonly (readonly [number, number, number])[] = [
    [21_000, 8_000, 8_000],
    [21_001, 7_000, 8_000],
    [24_000, 7_000, 8_000],
    [24_001, 6_000, 8_000],
    [27_000, 6_000, 8_000],
    [27_001, 5_000, 7_000],
    [30_000, 5_000, 7_000],
    [30_001, 4_000, 6_000],
    [33_000, 4_000, 6_000],
    [33_001, 3_000, 5_000],
    [36_000, 3_000, 5_000],
    [36_001, 2_000, 4_000],
    [39_000, 2_000, 4_000],
    [39_001, 1_000, 3_000],
    [42_000, 1_000, 3_000],
    [42_001, 0, 2_000],
    [45_000, 0, 2_000],
    [45_001, 0, 1_000],
    [48_000, 0, 1_000],
    [48_001, 0, 0],
  ];
  for (const year of [2025, 2026] as const) {
    const p = tiParamsFor(year).amounts.avsExemption.value;
    it(`${year}: every band of the table`, () => {
      for (const [income, single, family] of TABLE) {
        expect(avsExemption(p, chf(income), false, chf(30_000)), `single ${income}`).toBe(
          chf(single),
        );
        expect(avsExemption(p, chf(income), true, chf(30_000)), `family ${income}`).toBe(
          chf(family),
        );
      }
      expect(avsExemption(p, chf(10_000), false, chf(30_000))).toBe(chf(8_000));
    });
  }
  it('a partial pension: never more than the pension (LT art. 34 cpv. 2)', () => {
    const p = tiParamsFor(2025).amounts.avsExemption.value;
    expect(avsExemption(p, chf(20_000), false, chf(5_000))).toBe(chf(5_000));
  });
});

describe('insurance premiums and savings interest (12), Modulo 6', () => {
  for (const year of [2025, 2026] as const) {
    const p = tiParamsFor(year).amounts.insurance.value;
    it(`${year}: 10,900 for spouses, 5,500 for others; 4,500 and 2,300 more without pension contributions; 1,200 per child`, () => {
      expect(insuranceCap(p, { married: true, noPension: false, children: 0 })).toBe(chf(10_900));
      expect(insuranceCap(p, { married: true, noPension: true, children: 2 })).toBe(
        chf(10_900 + 4_500 + 2 * 1_200),
      );
      expect(insuranceCap(p, { married: false, noPension: false, children: 1 })).toBe(
        chf(5_500 + 1_200),
      );
      expect(insuranceCap(p, { married: false, noPension: true, children: 0 })).toBe(chf(7_800));
    });
  }
  it('the deduction table (p. 50): 15,400 and 7,800 without pension contributions', () => {
    const p = tiParamsFor(2025).amounts.insurance.value;
    expect(insuranceCap(p, { married: true, noPension: true, children: 0 })).toBe(chf(15_400));
    expect(insuranceCap(p, { married: false, noPension: true, children: 0 })).toBe(chf(7_800));
  });
});

describe('professional costs (Modulo 4; decrees art. 3 to 8)', () => {
  it('lunch away from home: 15 a day, at most 3,200; with a canteen, 7.50 and 1,600', () => {
    for (const year of [2025, 2026] as const) {
      const m = tiParamsFor(year).amounts.meals.value;
      expect(mealsCost(100, m.perDay, m.perYear)).toBe(chf(1_500));
      expect(mealsCost(220, m.perDay, m.perYear)).toBe(chf(3_200));
      expect(mealsCost(220, m.reducedPerDay, m.reducedPerYear)).toBe(chf(1_600));
    }
  });
  it('driving when no public transport can be used: km x 2 x days x 0.60 (car)', () => {
    const c = tiParamsFor(2025).amounts.commute.value;
    expect(drivingCost(12, 200, c.carPerKm)).toBe(chf(2_880));
    expect(drivingCost(12, 200, c.motorbikePerKm)).toBe(chf(1_920));
  });
  it('other costs: 3,000 in 2025, 3,500 from 2026; halved under 50 % or under 6 months', () => {
    const f25 = tiParamsFor(2025).amounts.otherFlat.value;
    const f26 = tiParamsFor(2026).amounts.otherFlat.value;
    expect(otherFlat(f25, 100, 12)).toBe(chf(3_000));
    expect(otherFlat(f25, 50, 12)).toBe(chf(3_000));
    expect(otherFlat(f25, 40, 12)).toBe(chf(1_500));
    expect(otherFlat(f25, 100, 5)).toBe(chf(1_500));
    expect(otherFlat(f26, 100, 12)).toBe(chf(3_500));
    expect(otherFlat(f26, 30, 12)).toBe(chf(1_750));
  });
});

describe('both spouses work (15.5)', () => {
  it('8,100 at most, never more than the lower income, nothing when one has none', () => {
    const max = tiParamsFor(2025).amounts.twoEarner.value;
    expect(twoEarnerDeduction([chf(90_000), chf(40_000)], max)).toBe(chf(8_100));
    expect(twoEarnerDeduction([chf(90_000), chf(6_000)], max)).toBe(chf(6_000));
    expect(twoEarnerDeduction([chf(90_000), 0], max)).toBe(0);
  });
});

describe('the cantonal coefficient and the communal multiplier', () => {
  it('100 % in 2025 (Istruzioni p. 51) and 2026 (LT art. 1b)', () => {
    expect(tiParamsFor(2025).amounts.coefficient.value).toBe(10_000);
    expect(tiParamsFor(2026).amounts.coefficient.value).toBe(10_000);
    expect(shareOfTax(chf(3_498.2), 10_000)).toBe(chf(3_498.2));
  });
  it('a multiplier applied to the base tax, to 5 centimes', () => {
    expect(shareOfTax(chf(3_498.2), 7_700)).toBe(chf(2_693.6));
    expect(shareOfTax(chf(996.55), 9_000)).toBe(chf(896.9));
  });
});
