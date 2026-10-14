// One test per deduction rule, against the rule as the cited document states it (the official
// worked example's own figures are in official-example.test.ts).
import { describe, expect, it } from 'vitest';
import {
  donationDeduction,
  drivingCost,
  flatShare,
  insuranceCap,
  mealsDeduction,
  medicalDeduction,
  pillar3aCap,
  twoEarner,
  zhParamsFor,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const A25 = zhParamsFor(2025).amounts;
const A26 = zhParamsFor(2026).amounts;

describe('Berufsauslagen (Verfügung 631.33)', () => {
  it('other costs: 3 % of the net salary, at least 2,000, at most 4,000 (Ziff. I.3)', () => {
    expect(flatShare(chf(50_000), A26.professionalFlat.value)).toBe(chf(2_000));
    expect(flatShare(chf(100_000), A26.professionalFlat.value)).toBe(chf(3_000));
    expect(flatShare(chf(200_000), A26.professionalFlat.value)).toBe(chf(4_000));
  });

  it('side jobs: 20 % of their income, at least 800, at most 2,400 (Ziff. I.4)', () => {
    expect(flatShare(chf(3_000), A26.sideJobFlat.value)).toBe(chf(800));
    expect(flatShare(chf(9_360), A26.sideJobFlat.value)).toBe(chf(1_872));
    expect(flatShare(chf(20_000), A26.sideJobFlat.value)).toBe(chf(2_400));
  });

  it('meals: 15 a day, at most 3,200; with a canteen 7.50, at most 1,600 (Ziff. I.2)', () => {
    expect(mealsDeduction(100, false, A26.meals.value)).toBe(chf(1_500));
    expect(mealsDeduction(240, false, A26.meals.value)).toBe(chf(3_200));
    expect(mealsDeduction(100, true, A26.meals.value)).toBe(chf(750));
    expect(mealsDeduction(0, false, A26.meals.value)).toBe(0);
  });

  it('driving when public transport can’t be used: 0.70 a km in 2025, 0.75 in 2026 (Ziff. I.1)', () => {
    expect(drivingCost(10, 200, A25.commuteKm.value.car)).toBe(chf(2_800)); // 10 x 2 x 200 x 0.70
    expect(drivingCost(10, 200, A26.commuteKm.value.car)).toBe(chf(3_000)); // x 0.75
    expect(drivingCost(10, 200, A26.commuteKm.value.motorbike)).toBe(chf(1_600)); // x 0.40
    expect(A26.commuteMax.value).toBe(chf(5_200)); // StG § 26 Abs. 1 lit. a, both years
    expect(A25.commuteMax.value).toBe(chf(5_200));
  });
});

describe('general deductions (StG § 31, § 32)', () => {
  it('insurance: 2,900 / 5,800, half as much again without pension fund or 3a, 1,300 per child', () => {
    const p = A26.insurance.value;
    expect(insuranceCap(p, false, true, 0, 0)).toBe(chf(2_900));
    expect(insuranceCap(p, false, false, 0, 0)).toBe(chf(4_350));
    expect(insuranceCap(p, true, false, 0, 0)).toBe(chf(8_700));
    expect(insuranceCap(p, true, true, 3, 0)).toBe(chf(5_800 + 3 * 1_300));
    expect(insuranceCap(p, false, true, 0, 1)).toBe(chf(2_900 + 650)); // half child deduction
  });

  it('pillar 3a: 7,258 with a pension fund; without, 20 % of earned income up to 36,288', () => {
    expect(pillar3aCap(true, chf(30_000), A26.pillar3a.value)).toBe(chf(7_258));
    expect(pillar3aCap(false, chf(60_000), A26.pillar3a.value)).toBe(chf(12_000));
    expect(pillar3aCap(false, chf(300_000), A25.pillar3a.value)).toBe(chf(36_288));
  });

  it('both spouses earn: the lower earned income, at most 6,100 (2025) or 6,200 (2026)', () => {
    expect(twoEarner(chf(4_000), A25.twoEarner.value)).toBe(chf(4_000));
    expect(twoEarner(chf(40_000), A25.twoEarner.value)).toBe(chf(6_100));
    expect(twoEarner(chf(40_000), A26.twoEarner.value)).toBe(chf(6_200));
    expect(twoEarner(0, A26.twoEarner.value)).toBe(0);
  });

  it('medical costs: only above 5 % of the Nettoeinkommen', () => {
    expect(medicalDeduction(chf(6_000), chf(94_300), 500)).toEqual({
      threshold: chf(4_715),
      deduction: chf(1_285),
    });
    expect(medicalDeduction(chf(3_000), chf(94_300), 500).deduction).toBe(0);
  });

  it('donations: at least 100 in the year, at most 20 % of the Nettoeinkommen', () => {
    const p = A26.donations.value;
    expect(donationDeduction(chf(99), chf(80_000), p).deduction).toBe(0);
    expect(donationDeduction(chf(100), chf(80_000), p).deduction).toBe(chf(100));
    expect(donationDeduction(chf(20_000), chf(80_000), p)).toEqual({
      cap: chf(16_000),
      deduction: chf(16_000),
    });
  });

  it('the amounts indexed for 2026 (cold-progression ordinance from 1 January 2026)', () => {
    expect([A25.child.value, A26.child.value]).toEqual([chf(9_300), chf(9_400)]);
    expect([A25.childcareMax.value, A26.childcareMax.value]).toEqual([chf(25_000), chf(25_300)]);
    expect([A25.trainingMax.value, A26.trainingMax.value]).toEqual([chf(12_400), chf(12_600)]);
    expect([A25.partyMax.value.other, A26.partyMax.value.other]).toEqual([
      chf(10_300),
      chf(10_500),
    ]);
    expect([A25.partyMax.value.married, A26.partyMax.value.married]).toEqual([
      chf(20_600),
      chf(21_000),
    ]);
  });
});
