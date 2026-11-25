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
    // By hand, from the official documents (Geneva's 2026 scale and amounts: ge-2026-rcepf art. 17
    // and art. 6 al. 2; Meyrin 2026: privileged share 29 %, centimes 42; federal 2026). No health
    // premiums known, so none deducted.
    // ICC without 3a: 85,000 - 1,817 (flat, max) = 83,183; base 7,015.15 + 5,453 x 14.20 % =
    // 774.326 -> 774.35: 7,789.50; centimes 3,700.0125 -> 3,700.00; reduction 12 % x 11,489.50 =
    // 1,378.75; home care 77.90; cantonal 10,188.65; communal 2,258.95 x 42 % = 948.75 and 5,530.55
    // x 42 % = 2,322.85: 13,460.25. With 3a 7,258: 75,925; base 3,149.00 + 27,484 x 13.20 % =
    // 3,627.888 -> 3,627.90: 6,776.90; centimes 3,219.05; reduction 1,199.50; home care 67.75;
    // cantonal 8,864.20; communal 825.45 + 2,020.85: 11,710.50. Saving 1,749.75.
    // IFD: 85,000 - 2,550 (3 %) = 82,450 at 82,400: 1,502.95 + 3 x 6.60 = 1,522.75; with 3a 75,192
    // at 75,100: 612.00 + 171 x 2.97 = 1,119.87 -> 1,119.85. Saving 402.90. Total 2,152.65.
    expect(plan.saving?.totalCentimes).toBe(CHF(2_152.65));
    expect(plan.saving!.totalCentimes).toBeGreaterThan(CHF(1500));
    expect(plan.saving!.totalCentimes).toBeLessThan(CHF(3000));
    // What the plan assumes, in whatever order: flat deductions only and the commune of residence's
    // rate. Nothing about the scale any more: it is Geneva's official 2026 one.
    expect([...plan.assumptions].sort()).toEqual(['flat_deductions_only', 'home_commune_rate']);
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
