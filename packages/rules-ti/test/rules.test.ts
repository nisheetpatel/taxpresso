// The engine fails closed: a fact it needs and was not given, or a case the documents leave open,
// gives no tax and says why (unsupported); a fact that makes no sense throws. Synthetic only.
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  NOTE,
  TiInputError,
  type PersonInput,
  type TiEngineInput,
  type TiTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

const worker = (more: Partial<PersonInput> = {}): PersonInput => ({
  id: 'p1',
  employments: [{ gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_800) }],
  commuteCost: amt(1_000),
  workRate: 100,
  ...more,
});

const base: TiEngineInput = {
  taxYear: 2025,
  commune: 'BIASCA',
  civilStatus: 'single',
  people: [worker()],
};

const unsupported = (r: TiTaxResult) => r.unsupported.map((n) => n.en);
const code = (r: TiTaxResult, c: string) =>
  [...(r.icc?.items ?? []), ...(r.icc?.wealth.items ?? [])].filter((i) => i.code === c);

describe('fails closed', () => {
  it('computes the base household', () => {
    const r = computeReturn(base);
    expect(r.unsupported).toEqual([]);
    expect(r.total).toBeGreaterThan(0);
    expect(r.unverifiedRules).toEqual([NOTE.tariffLine, NOTE.rounding]);
  });

  it('asks for the work rate when the flat amount would count', () => {
    const r = computeReturn({ ...base, people: [worker({ workRate: undefined })] });
    expect(r.icc).toBeNull();
    expect(unsupported(r)).toEqual([NOTE.workRate.en]);
    // Actual costs at least the flat amount: no question needed.
    const actual = computeReturn({
      ...base,
      people: [worker({ workRate: undefined, otherProfessionalCosts: amt(3_200) })],
    });
    expect(actual.unsupported).toEqual([]);
    expect(code(actual, '9.1')[0]!.amount).toBe(-chf(1_000 + 3_200));
  });

  it('does not compute part of a year of work, and says it assumed a whole year', () => {
    expect(unsupported(computeReturn({ ...base, people: [worker({ monthsWorked: 8 })] }))).toEqual([
      NOTE.partYear.en,
    ]);
    expect(computeReturn(base).assumptions).toContainEqual(NOTE.fullYear);
  });

  it('self-employment, a spouse who died in the year, driving in 2026', () => {
    expect(
      unsupported(computeReturn({ ...base, people: [worker({ selfEmploymentProfit: amt(1) })] })),
    ).toContain(NOTE.selfEmployed.en);
    expect(
      unsupported(computeReturn({ ...base, civilStatus: 'widowed', changedThisYear: true })),
    ).toContain(NOTE.widowedThisYear.en);
    const driving = worker({
      commuteCost: undefined,
      commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 230 },
    });
    expect(unsupported(computeReturn({ ...base, taxYear: 2026, people: [driving] }))).toContain(
      NOTE.drivingDays2026.en,
    );
    // 2025: at most 220 days (Istruzioni p. 23): 15 x 2 x 220 x 0.60 = 3,960.
    const r25 = computeReturn({ ...base, people: [driving] });
    expect(code(r25, '9.1')[0]!.amount).toBe(-chf(3_960 + 3_000));
    expect(r25.assumptions).toContainEqual(NOTE.daysCapped);
  });

  it('the tariff after a divorce or a death: asks whether it happened in the year', () => {
    expect(unsupported(computeReturn({ ...base, civilStatus: 'divorced' }))).toEqual([
      NOTE.statusChange.en,
    ]);
    expect(unsupported(computeReturn({ ...base, civilStatus: 'widowed' }))).toEqual([
      NOTE.statusChange.en,
    ]);
    const thisYear = computeReturn({ ...base, civilStatus: 'separated', changedThisYear: true });
    expect(thisYear.icc!.incomeTariff).toBe('family');
    const before = computeReturn({ ...base, civilStatus: 'divorced', changedThisYear: false });
    expect(before.icc!.incomeTariff).toBe('single');
  });

  it('shared custody: needs the answer on child support, and not for a married couple', () => {
    const child = { custody: 'shared' as const, under14: true, minor: true };
    expect(unsupported(computeReturn({ ...base, children: [child] }))).toEqual([
      NOTE.childSupport.en,
    ]);
    expect(
      unsupported(
        computeReturn({
          ...base,
          civilStatus: 'married',
          children: [child],
          childSupport: 'none',
        }),
      ),
    ).toContain(NOTE.marriedShared.en);
    expect(
      unsupported(computeReturn({ ...base, children: [child], childSupport: 'pays' })),
    ).toContain(NOTE.paysLiving.en);
    const away = computeReturn({
      ...base,
      children: [{ ...child, livesWithYou: false }],
      childSupport: 'pays',
      household: { childSupportPaid: amt(9_000) },
    });
    expect(away.unsupported).toEqual([]);
    expect(away.icc!.incomeTariff).toBe('single');
    expect(code(away, '14.2')[0]!.amount).toBe(-chf(9_000));
    expect(code(away, '25.1')).toEqual([]);
  });

  it('childcare: both spouses must have a salary', () => {
    const r = computeReturn({
      ...base,
      civilStatus: 'married',
      people: [worker(), { id: 'p2' }],
      children: [{ custody: 'full', under14: true, childcare: amt(5_000) }],
    });
    expect(unsupported(r)).toContain(NOTE.childcareWork.en);
  });

  it('both spouses work: no tax when the readings of the lower income differ', () => {
    const r = computeReturn({
      ...base,
      civilStatus: 'married',
      people: [
        worker(),
        {
          id: 'p2',
          employments: [{ gross: amt(6_000) }],
          commuteCost: amt(500),
          workRate: 20,
          unemploymentBenefits: amt(10_000),
        },
      ],
    });
    expect(unsupported(r)).toContain(NOTE.twoEarnerConflict.en);
  });

  it('professional costs above the salary', () => {
    const r = computeReturn({
      ...base,
      people: [worker({ employments: [{ gross: amt(2_000) }], workRate: 30 })],
    });
    expect(unsupported(r)).toContain(NOTE.costsAboveSalary.en);
  });

  it('a pillar 3a catch-up: not in 2025, on 10.3 from 2026', () => {
    const p = worker({ pillar3aCatchUp: amt(5_000) });
    expect(unsupported(computeReturn({ ...base, people: [p] }))).toContain(NOTE.catchUp2025.en);
    const r = computeReturn({ ...base, taxYear: 2026, people: [p] });
    expect(code(r, '10.3')[0]!.amount).toBe(-chf(5_000));
  });

  it('the brake on the wealth tax could apply: no tax', () => {
    const r = computeReturn({
      ...base,
      people: [{ id: 'p1', pensionOccupational: amt(15_000) }],
      movable: [{ owner: 'p1', value: amt(20_000_000), income: amt(0) }],
    });
    expect(unsupported(r)).toEqual([NOTE.wealthBrake.en]);
  });

  it('a minor child’s wealth deduction when the age is not given and it changes the tax', () => {
    const r = computeReturn({
      ...base,
      children: [{ custody: 'full' }],
      movable: [{ owner: 'p1', value: amt(500_000), income: amt(1_000) }],
    });
    expect(unsupported(r)).toEqual([NOTE.wealthChild.en]);
    const told = computeReturn({
      ...base,
      children: [{ custody: 'full', minor: true }],
      movable: [{ owner: 'p1', value: amt(500_000), income: amt(1_000) }],
    });
    expect(code(told, '35.2')[0]!.amount).toBe(-chf(30_000));
    expect(told.icc!.wealth.taxableWealth.amount).toBe(chf(470_000));
  });

  it('vehicles are taxable wealth (29.4); a couple pays the personal tax twice', () => {
    const r = computeReturn({
      ...base,
      civilStatus: 'married',
      people: [worker()],
      household: { vehicles: amt(25_000) },
    });
    expect(code(r, '29.4')[0]!.amount).toBe(chf(25_000));
    expect(r.icc!.taxes.personal.amount).toBe(chf(80));
  });

  it('throws on what makes no sense', () => {
    expect(() => computeReturn({ ...base, commune: 'Zurich' })).toThrow(TiInputError);
    expect(() => computeReturn({ ...base, commune: 'LEMA' })).toThrow(TiInputError);
    expect(() => computeReturn({ ...base, people: [worker(), { id: 'p2' }] })).toThrow(
      TiInputError,
    );
    expect(() => computeReturn({ ...base, people: [worker({ workRate: 120 })] })).toThrow(
      TiInputError,
    );
    expect(() => computeReturn({ ...base, taxYear: 2024 as never })).toThrow(RangeError);
  });
});
