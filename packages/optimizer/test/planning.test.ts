// Pension fund buy-in, 3a catch-up and the shared tax seam. Synthetic households only.
import { computeReturn } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  type HouseholdInput,
  lppBuyInPlan,
  ordinaryTaxEstimator,
  pillar3aCatchUpPlan,
  pillar3aPlan,
  savingOf,
} from '../src/index.js';

const CHF = (n: number) => n * 100;

/** Single, Meyrin, CHF 85,000 net, a pension fund: the 3a test's household. */
const single = (paid = 0): HouseholdInput => ({
  couple: false,
  children: 0,
  commune: 'meyrin',
  people: [
    { person: 'p1', hasPensionFund: true, paidCentimes: CHF(paid), netCentimes: CHF(85_000) },
  ],
});
/**
 * The same household straight through the rules engine: its income tax (cantonal and communal on
 * income, and federal) with 3a on 31.40, a pension fund buy-in on 31.30 and a 3a catch-up.
 */
const tax = (pillar3a: number, buyIn = 0, catchUp = 0) => {
  const r = computeReturn({
    taxYear: 2026,
    commune: 'meyrin',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        hasPensionFund: true,
        employments: [{ gross: { value: CHF(85_000) } }],
        ...(pillar3a ? { pillar3a: { value: CHF(pillar3a) } } : {}),
        ...(buyIn ? { pensionBuyIn: { value: CHF(buyIn) } } : {}),
        ...(catchUp ? { pillar3aCatchUp: { value: CHF(catchUp) } } : {}),
      },
    ],
  });
  return (
    r.icc!.taxes.incomeCantonal.amount + r.icc!.taxes.communalIncomeTotal.amount + r.ifd!.tax.amount
  );
};

describe('the tax seam (taxWith)', () => {
  it('is the engine run with the deductions, whatever their kind', () => {
    const e = ordinaryTaxEstimator(single())!;
    expect(e.taxWith([]).totalCentimes).toBe(tax(0));
    expect(
      e.taxWith([
        { person: 'p1', kind: 'pillar3a', centimes: CHF(7_258) },
        { person: 'p1', kind: 'lpp_buyin', centimes: CHF(10_000) },
      ]).totalCentimes,
    ).toBe(tax(7_258, 10_000));
    const s = savingOf(e.taxWith, [], [{ person: 'p1', kind: 'lpp_buyin', centimes: CHF(1_000) }]);
    expect(s.totalCentimes).toBe(s.cantonalCentimes + s.federalCentimes);
  });

  it('gives nothing without any salary (no figure is guessed)', () => {
    expect(
      ordinaryTaxEstimator({
        couple: false,
        children: 0,
        people: [{ person: 'p1', hasPensionFund: true, paidCentimes: 0 }],
      }),
    ).toBeUndefined();
  });

  it('follows the answer on child support for a parent sharing custody', () => {
    const parent = (known?: HouseholdInput['known']): HouseholdInput => ({
      ...single(),
      children: 1,
      custody: 'shared',
      ...(known ? { known } : {}),
    });
    const federal = (h: HouseholdInput) => ordinaryTaxEstimator(h)!.taxWith([]).federalCentimes;
    // Not answered: the parental scale, as before. The other parent earns more: the single scale,
    // so more federal tax. Child support paid: the child counts for the other parent.
    const assumed = federal(parent());
    expect(federal(parent({ childSupport: 'none', ifdParentalScale: true }))).toBe(assumed);
    expect(federal(parent({ childSupport: 'none', ifdParentalScale: false }))).toBeGreaterThan(
      assumed,
    );
    expect(federal(parent({ childSupport: 'pays' }))).toBe(federal(single()));
  });

  it('gives the 3a plan its saving from the engine', () => {
    const plan = pillar3aPlan(single());
    expect(plan.saving?.totalCentimes).toBe(tax(0) - tax(7_258));
  });
});

describe('pension fund buy-in (rachat LPP)', () => {
  it('saves the tax of the amount, on top of the 3a already paid', () => {
    const plan = lppBuyInPlan(single(2_000), [
      { person: 'p1', capacityCentimes: CHF(31_000), amountCentimes: CHF(5_000) },
    ]);
    expect(plan.saving?.totalCentimes).toBe(tax(2_000) - tax(2_000, 5_000));
    expect(plan.saving!.totalCentimes).toBeLessThan(CHF(5_000));
    expect(plan.capacityUnknown).toBe(false);
    expect(plan.facts.threeYearRule).toMatch(/ch-na-law-lpp p. 66 \(art. 79b al. 3\)/);
    expect(plan.sources).toContain('ch-na-law-lpp p. 65 (art. 79b al. 1)');
  });

  it('refuses an amount above what the fund allows', () => {
    const plan = lppBuyInPlan(single(), [
      { person: 'p1', capacityCentimes: CHF(3_000), amountCentimes: CHF(5_000) },
    ]);
    expect(plan.problem).toBe('over_capacity');
    expect(plan.saving).toBeUndefined();
    expect(plan.people[0]?.overCapacity).toBe(true);
  });

  it('computes without the capacity but says the certificate is missing', () => {
    const plan = lppBuyInPlan(single(), [{ person: 'p1', amountCentimes: CHF(5_000) }]);
    expect(plan.capacityUnknown).toBe(true);
    expect(plan.saving?.totalCentimes).toBe(tax(0) - tax(0, 5_000));
  });

  it('needs a salary and an amount', () => {
    const noSalary: HouseholdInput = {
      couple: false,
      children: 0,
      people: [{ person: 'p1', hasPensionFund: true, paidCentimes: 0 }],
    };
    expect(lppBuyInPlan(noSalary, [{ person: 'p1', amountCentimes: CHF(5_000) }]).problem).toBe(
      'no_income',
    );
    const none = lppBuyInPlan(single(), [{ person: 'p1', capacityCentimes: CHF(31_000) }]);
    expect(none.saving).toBeUndefined();
    expect(none.problem).toBeUndefined();
  });

  it('saves less per franc after a 3a payment (marginal rates go down with the income)', () => {
    const per = (paid: number) =>
      lppBuyInPlan(single(paid), [{ person: 'p1', amountCentimes: CHF(10_000) }]).saving!
        .totalCentimes;
    expect(per(7_258)).toBeLessThanOrEqual(per(0));
  });
});

describe('3a catch-up (rachat 3a)', () => {
  const plan = (paid2025: number | undefined, room2026: number, hasPensionFund = true) =>
    pillar3aCatchUpPlan(
      {
        ...single(7_258 - room2026),
        people: [
          {
            person: 'p1',
            hasPensionFund,
            paidCentimes: CHF(7_258 - room2026),
            netCentimes: CHF(85_000),
          },
        ],
      },
      [
        {
          person: 'p1',
          hasPensionFund,
          room2026Centimes: CHF(room2026),
          ...(paid2025 !== undefined ? { paid2025Centimes: CHF(paid2025) } : {}),
        },
      ],
    );

  it('makes up the 2025 gap, after the full 2026 payment', () => {
    const p = plan(3_000, 0);
    expect(p.people[0]).toEqual({
      person: 'p1',
      status: 'possible',
      gapCentimes: CHF(4_258),
      isMaximum: false,
      catchUpCentimes: CHF(4_258),
    });
    // On top of the full 2026 payment (7,258), the catch-up of 4,258.
    expect(p.saving?.totalCentimes).toBe(tax(7_258) - tax(7_258, 0, 4_258));
    expect(p.assumptions).toContain('pension_fund_2025_same');
    expect(p.sources[0]).toMatch(/ch-na-law-opp3 p. 7 \(art. 7a al. 2\)/);
  });

  it('asks for the 2026 payment first', () => {
    expect(plan(0, 2_000).people[0]).toMatchObject({
      status: 'pay_this_year_first',
      catchUpCentimes: CHF(7_258),
    });
  });

  it('has nothing to make up when 2025 was paid in full, or unknown', () => {
    expect(plan(7_258, 0).people[0]).toMatchObject({ status: 'no_gap', catchUpCentimes: 0 });
    const unknown = plan(undefined, 0);
    expect(unknown.people[0]).toMatchObject({ status: 'unknown', catchUpCentimes: 0 });
    expect(unknown.saving).toBeUndefined();
    expect(unknown.assumptions).toEqual([]);
  });

  it('caps the catch-up at the small 3a limit, and says when the gap is only a maximum', () => {
    // No pension fund: the 2025 limit was 20 % of the 2025 earned income, at most 36,288.
    const p = plan(0, 0, false);
    expect(p.people[0]).toMatchObject({
      status: 'possible',
      gapCentimes: CHF(36_288),
      isMaximum: true,
      catchUpCentimes: CHF(7_258),
    });
  });
});
