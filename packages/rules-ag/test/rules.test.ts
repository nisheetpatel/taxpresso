// The deduction rules on their own, against the documents' wording.
import { describe, expect, it } from 'vitest';
import {
  agParamsFor,
  drivingCost,
  flatShare,
  lowIncomeDeduction,
  mealsDeduction,
  medicalDeduction,
  round10,
  twoEarnerDeduction,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

describe('travel by car (StGV § 13 Abs. 1)', () => {
  it('2026: 40 km x 2 x 220 = 17,600 km; 15,000 at 0.75 and 2,600 at 0.55 = 12,680', () => {
    const k = agParamsFor(2026).amounts.commuteKm.value;
    expect(drivingCost(40, 220, k.car, k)).toEqual({ km: 17_600, cost: chf(12_680) });
  });

  it('a motorbike has no lower rate beyond 15,000 km (§ 13 names the car)', () => {
    const k = agParamsFor(2026).amounts.commuteKm.value;
    expect(drivingCost(40, 220, k.motorbike)).toEqual({ km: 17_600, cost: chf(7_040) });
  });

  it('2025: 0.70 per km (Wegleitung 2025 p. 22); 2026: 0.75 (the table of deductions)', () => {
    expect(agParamsFor(2025).amounts.commuteKm.value.car).toBe(70);
    expect(agParamsFor(2026).amounts.commuteKm.value.car).toBe(75);
  });
});

describe('flat amounts (Wegleitung 2025 p. 22 to 24; the table of deductions)', () => {
  for (const year of [2025, 2026] as const) {
    const A = agParamsFor(year).amounts;
    it(`${year}: meals 15 a day, at most 3,200; half with a canteen, at most 1,600`, () => {
      expect(mealsDeduction(220, false, A.meals.value)).toBe(chf(3_200));
      expect(mealsDeduction(100, false, A.meals.value)).toBe(chf(1_500));
      expect(mealsDeduction(220, true, A.meals.value)).toBe(chf(1_600));
    });
    it(`${year}: 3 % of the net salary, 2,000 to 4,000; a side job 20 %, 800 to 2,400`, () => {
      expect(flatShare(chf(50_000), A.professionalFlat.value)).toBe(chf(2_000));
      expect(flatShare(chf(100_000), A.professionalFlat.value)).toBe(chf(3_000));
      expect(flatShare(chf(200_000), A.professionalFlat.value)).toBe(chf(4_000));
      expect(flatShare(chf(3_000), A.sideJobFlat.value)).toBe(chf(800));
      expect(flatShare(chf(20_000), A.sideJobFlat.value)).toBe(chf(2_400));
    });
  }
});

describe('medical costs (StG § 40 Abs. 1 lit. i; Wegleitung 2025 p. 31, Ziffer 18)', () => {
  it('the Selbstbehalt is the net income after the costs x 5 : 95, never more than the costs', () => {
    // 94,910 - 9,000 = 85,910; x 5 : 95 = 4,521.58, 4,522; 4,478 deducted, and 5 % of
    // 94,910 - 4,478 = 90,432 is 4,521.60: the law's own definition.
    expect(medicalDeduction(chf(9_000), chf(94_910), 500)).toEqual({
      selbstbehalt: chf(4_522),
      addBack: chf(4_522),
      deduction: chf(4_478),
    });
    expect(medicalDeduction(chf(1_000), chf(50_000), 500)).toEqual({
      selbstbehalt: chf(2_579),
      addBack: chf(1_000),
      deduction: 0,
    });
  });
});

describe('low incomes (StG § 42 Abs. 1bis)', () => {
  const steps = agParamsFor(2026).amounts.lowIncome.value;
  it('the steps, and the top of the step below', () => {
    expect(lowIncomeDeduction(chf(14_999), steps)).toEqual({ deduction: chf(12_000) });
    expect(lowIncomeDeduction(chf(15_000), steps)).toEqual({
      deduction: chf(7_500),
      previous: { top: chf(14_999), deduction: chf(12_000) },
    });
    expect(lowIncomeDeduction(chf(34_999), steps).deduction).toBe(chf(1_000));
    expect(lowIncomeDeduction(chf(35_000), steps)).toEqual({
      deduction: 0,
      previous: { top: chf(34_999), deduction: chf(1_000) },
    });
    expect(lowIncomeDeduction(chf(-500), steps).deduction).toBe(chf(12_000));
  });
});

describe('two earners and rounding', () => {
  it('600, at most what the second earner has left (Wegleitung 2025 p. 30)', () => {
    expect(twoEarnerDeduction(chf(38_200), chf(600))).toBe(chf(600));
    expect(twoEarnerDeduction(chf(450), chf(600))).toBe(chf(450));
    expect(twoEarnerDeduction(chf(-50), chf(600))).toBe(0);
  });

  it('taxes to 10 centimes (Wegleitung 2025 p. 45): 2,146.74 and 1,817.96', () => {
    expect(round10(193_400 * 111, 100)).toBe(chf(2_146.7));
    expect(round10(193_400 * 94, 100)).toBe(chf(1_818));
    expect(round10(193_400 * 15, 100)).toBe(chf(290.1));
  });
});
