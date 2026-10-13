import { iccBaseIncomeTax2025, iccTotalIncomeTax2025, ifdTax2026 } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import { pillar3aPlan } from '../src/index.js';

const CHF = (n: number) => n * 100;

describe('pillar 3a before 31 December', () => {
  it('gives the room left from the 2026 caps, with or without a pension fund', () => {
    const plan = pillar3aPlan({
      couple: true,
      children: 0,
      people: [
        { person: 'p1', hasPensionFund: true, paidCentimes: CHF(2000) },
        { person: 'p2', hasPensionFund: false, paidCentimes: 0, netCentimes: CHF(50_000) },
      ],
    });
    expect(plan.people.map((p) => [p.capCentimes, p.roomCentimes])).toEqual([
      [CHF(7258), CHF(5258)],
      [CHF(10_000), CHF(10_000)], // 20 % of 50,000
    ]);
    expect(plan.roomCentimes).toBe(CHF(15_258));
  });

  it('shows the maximum when the cap depends on an unknown income, and no saving without any income', () => {
    const plan = pillar3aPlan({
      couple: false,
      children: 0,
      people: [{ person: 'p1', hasPensionFund: false, paidCentimes: 0 }],
    });
    expect(plan.people[0]).toMatchObject({ capCentimes: CHF(36_288), capIsMaximum: true });
    expect(plan.saving).toBeUndefined();
  });

  it('computes the saving as the engine run twice (single, Meyrin, CHF 85,000 net)', () => {
    const plan = pillar3aPlan({
      couple: false,
      children: 0,
      commune: 'meyrin',
      people: [{ person: 'p1', hasPensionFund: true, paidCentimes: 0, netCentimes: CHF(85_000) }],
    });
    // Cantonal: net minus the 1,812 flat. Federal: net minus the 2,550 flat (3 %) and 1,800 insurance.
    const icc = (income: number) => iccTotalIncomeTax2025(iccBaseIncomeTax2025(CHF(income)), 4200);
    const ifd = (income: number) => ifdTax2026(CHF(income), 'single');
    const expected =
      icc(85_000 - 1_812) -
      icc(85_000 - 1_812 - 7_258) +
      (ifd(85_000 - 2_550 - 1_800) - ifd(85_000 - 2_550 - 1_800 - 7_258));
    expect(plan.saving?.totalCentimes).toBe(expected);
    expect(plan.saving!.totalCentimes).toBeGreaterThan(CHF(1500));
    expect(plan.saving!.totalCentimes).toBeLessThan(CHF(3000));
    expect(plan.assumptions).toContain('icc_2025_scale');
  });

  it('never saves more than it costs, and more income never saves less (monotonic)', () => {
    let previous = 0;
    for (const net of [40_000, 60_000, 80_000, 100_000, 140_000, 200_000]) {
      const plan = pillar3aPlan({
        couple: false,
        children: 0,
        people: [{ person: 'p1', hasPensionFund: true, paidCentimes: 0, netCentimes: CHF(net) }],
      });
      const saving = plan.saving!.totalCentimes;
      expect(saving).toBeLessThan(plan.roomCentimes);
      expect(saving).toBeGreaterThanOrEqual(previous);
      previous = saving;
    }
  });

  it('saves less for the same income when a couple splits it', () => {
    const one = (couple: boolean) =>
      pillar3aPlan({
        couple,
        children: 0,
        people: [{ person: 'p1', hasPensionFund: true, paidCentimes: 0, netCentimes: CHF(90_000) }],
      }).saving!.totalCentimes;
    expect(one(true)).toBeLessThan(one(false));
  });
});
