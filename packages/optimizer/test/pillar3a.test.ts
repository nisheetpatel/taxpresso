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
    // By hand, from the official documents (2026: Geneva's 2025 values, Meyrin 2026: privileged
    // share 29 %, centimes 42; federal 2026). No health premiums known, so none deducted.
    // ICC without 3a: 85,000 - 1,812 (flat, max) = 83,188; base 6,996.00 + 5,670 x 14.20 % =
    // 805.14 -> 805.15: 7,801.15; centimes 3,705.546 -> 3,705.55; reduction 12 % x 11,506.70 =
    // 1,380.80; home care 78.00; cantonal 10,203.90; communal 2,262.35 x 42 % = 950.20 and 5,538.80
    // x 42 % = 2,326.30: 13,480.40. With 3a 7,258: 75,930; base 3,140.40 + 27,621 x 13.20 % =
    // 3,645.97 -> 3,645.95: 6,786.35; centimes 3,223.50; reduction 1,201.20; home care 67.85;
    // cantonal 8,876.50; communal 826.60 + 2,023.70: 11,726.80. Saving 1,753.60.
    // IFD: 85,000 - 2,550 (3 %) = 82,450 at 82,400: 1,502.95 + 3 x 6.60 = 1,522.75; with 3a 75,192
    // at 75,100: 612.00 + 171 x 2.97 = 1,119.87 -> 1,119.85. Saving 402.90. Total 2,156.50.
    expect(plan.saving?.totalCentimes).toBe(CHF(2_156.5));
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
