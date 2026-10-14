// The St. Gallen deduction rules one by one, as the law, the ordinance, the guide and the forms
// state them, and the cases the documents leave open or contradict (fail closed). Synthetic only.
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  educationDeduction,
  insuranceCap,
  NOTE,
  otherFlat,
  sgParamsFor,
  sideJobFlat,
  vehicleCost,
  type SgEngineInput,
  type SgTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: SgTaxResult, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);

const A25 = sgParamsFor(2025).amounts;
const A26 = sgParamsFor(2026).amounts;

describe('the rules as pure functions', () => {
  it('other professional costs (StV Art. 21): 700 plus 10 % of the net salary, at most 2,400', () => {
    expect(otherFlat(chf(10_000), A25.otherFlat.value)).toBe(chf(1_700));
    expect(otherFlat(chf(12_345), A25.otherFlat.value)).toBe(chf(1_935)); // 1,234.50 to the franc
    expect(otherFlat(chf(17_000), A25.otherFlat.value)).toBe(chf(2_400));
    expect(otherFlat(0, A25.otherFlat.value)).toBe(0);
  });

  it('a side job (guide p. 25): its costs up to 800, then 20 % between 800 and 2,400', () => {
    expect(sideJobFlat(chf(500), A25.sideJob.value)).toBe(chf(500));
    expect(sideJobFlat(chf(800), A25.sideJob.value)).toBe(chf(800));
    expect(sideJobFlat(chf(3_000), A25.sideJob.value)).toBe(chf(800));
    expect(sideJobFlat(chf(6_000), A25.sideJob.value)).toBe(chf(1_200));
    expect(sideJobFlat(chf(20_000), A25.sideJob.value)).toBe(chf(2_400));
  });

  it('a car (Form 4, 1.3): km one way x 2 x days x the rate per km', () => {
    expect(vehicleCost(15, 220, A25.travel.value.carPerKm)).toBe(chf(4_620));
    expect(vehicleCost(15, 220, A26.travel.value.carPerKm)).toBe(chf(4_950));
  });

  it('children’s education costs (23.3): above 3,200, at most the maximum, less scholarships', () => {
    const c = A25.child.value;
    expect(educationDeduction(chf(10_000), 0, c)).toEqual({ law: chf(6_800), form: chf(6_800) });
    expect(educationDeduction(chf(10_000), chf(2_000), c)).toEqual({
      law: chf(4_800),
      form: chf(4_800),
    });
    expect(educationDeduction(chf(2_000), 0, c)).toEqual({ law: 0, form: 0 });
    // Above the maximum with scholarships the law and Form 10 differ.
    expect(educationDeduction(chf(30_000), chf(5_000), c)).toEqual({
      law: chf(8_700),
      form: chf(13_700),
    });
  });

  it('insurance premiums (StG Art. 45 Abs. 1 lit. g): the maxima', () => {
    const i = A25.insurance.value;
    expect(insuranceCap(i, true, false, 2)).toBe(chf(9_000));
    expect(insuranceCap(i, true, true, 0)).toBe(chf(7_900));
    expect(insuranceCap(i, false, true, 1)).toBe(chf(5_000));
    expect(insuranceCap(i, false, false, 0)).toBe(chf(3_400));
  });
});

const employee = (over: Partial<SgEngineInput['people'][number]> = {}) => ({
  id: 'p1' as const,
  employments: [{ gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_000) }],
  ...over,
});
const single = (over: Partial<SgEngineInput> = {}): SgEngineInput => ({
  taxYear: 2025,
  commune: 'Wil',
  civilStatus: 'single',
  people: [employee()],
  ...over,
});

describe('the rules in the engine', () => {
  it('actual professional costs replace the flat amount when higher (Form 4, 3.2)', () => {
    const r = computeReturn(single({ people: [employee({ otherProfessionalCosts: amt(3_100) })] }));
    expect(find(r, '418', 'p1')).toBe(chf(-3_100));
    expect(find(r, '416', 'p1')).toBe(0);
    const lower = computeReturn(
      single({ people: [employee({ otherProfessionalCosts: amt(900) })] }),
    );
    expect(find(lower, '416', 'p1')).toBe(chf(-2_400));
  });

  it('the flat amount is a share of the salary before the buy-ins (StV Art. 21 Abs. 2)', () => {
    // 15,000 - 960 - 750 = 13,290; buy-in 3,000: the net salary 10,290; the flat 700 + 1,329.
    const r = computeReturn(
      single({
        people: [
          {
            id: 'p1',
            employments: [
              {
                gross: amt(15_000),
                socialContributions: amt(960),
                pensionFund: amt(750),
                pensionBuyIn: amt(3_000),
              },
            ],
          },
        ],
      }),
    );
    expect(find(r, '100', 'p1')).toBe(chf(10_290));
    expect(find(r, '416', 'p1')).toBe(chf(-2_029));
    expect(r.unverifiedRules).toContainEqual(NOTE.otherFlatRounding);
  });

  it('travel to work is capped at 8,000; a motorbike without public transport fails closed', () => {
    const far = computeReturn(
      single({
        people: [
          employee({ commuteMode: { by: 'car', transitUsable: false, kmOneWay: 40, days: 220 } }),
        ],
      }),
    );
    expect(find(far, '406', 'p1')).toBe(chf(-8_000));
    const moto = computeReturn(
      single({
        people: [
          employee({
            commuteMode: { by: 'motorbike', transitUsable: false, kmOneWay: 10, days: 200 },
          }),
        ],
      }),
    );
    expect(moto.icc).toBeNull();
    expect(moto.unsupported).toEqual([NOTE.motorbikeRate]);
  });

  it('a side job alone is the main job (guide p. 25)', () => {
    const r = computeReturn(
      single({ people: [{ id: 'p1', employments: [{ gross: amt(6_000), side: true }] }] }),
    );
    expect(find(r, '100', 'p1')).toBe(chf(6_000));
    expect(find(r, '104', 'p1')).toBe(0);
    expect(find(r, '432', 'p1')).toBe(0);
    expect(find(r, '416', 'p1')).toBe(chf(-1_300));
    expect(r.unverifiedRules).toContainEqual(NOTE.sideOnly);
  });

  it('professional training: the flat 400 in 2025 (employees, cantonal tax), none in 2026', () => {
    const r25 = computeReturn(single({ people: [employee({ trainingCosts: amt(150) })] }));
    expect(find(r25, '223', 'p1')).toBe(chf(-400));
    const r26 = computeReturn(
      single({ taxYear: 2026, people: [employee({ trainingCosts: amt(150) })] }),
    );
    expect(find(r26, '223', 'p1')).toBe(chf(-150));
    expect(r26.notCounted).toContainEqual(NOTE.trainingFlat2026);
    const big = computeReturn(single({ people: [employee({ trainingCosts: amt(20_000) })] }));
    expect(find(big, '223', 'p1')).toBe(chf(-13_000));
  });

  it('pillar 3a catch-up: not in 2025; from 2026, at most the small maximum (Merkblatt 8)', () => {
    const r25 = computeReturn(single({ people: [employee({ pillar3aCatchUp: amt(5_000) })] }));
    expect(find(r25, '208', 'p1')).toBe(0);
    expect(r25.notCounted).toContainEqual(NOTE.catchUp2025);
    const r26 = computeReturn(
      single({
        taxYear: 2026,
        people: [employee({ pillar3a: amt(7_258), pillar3aCatchUp: amt(9_000) })],
      }),
    );
    expect(find(r26, '208', 'p1')).toBe(chf(-7_258 - 7_258));
    expect(r26.notCounted).toContainEqual(NOTE.catchUpCap);
  });

  it('insurance: the higher maximum only when neither spouse deducts pension contributions', () => {
    const couple = (p2: SgEngineInput['people'][number]): SgEngineInput => ({
      taxYear: 2025,
      commune: 'Wil',
      civilStatus: 'married',
      people: [{ id: 'p1', pensionAvs: amt(30_000) }, p2],
      household: { healthPremiums: amt(12_000) },
    });
    const retired = computeReturn(couple({ id: 'p2', pensionAvs: amt(25_000) }));
    expect(find(retired, '600')).toBe(chf(-7_900));
    const oneSaves = computeReturn(couple({ id: 'p2', pensionAvs: amt(25_000), pillar3a: amt(1) }));
    // p2 has no earned income: the 3a deduction is nothing, so nothing is deducted for 3a.
    expect(find(oneSaves, '208')).toBe(0);
    expect(find(oneSaves, '600')).toBe(chf(-7_900));
    const works = computeReturn(couple(employee({ id: 'p2' } as never)));
    expect(find(works, '600')).toBe(chf(-6_800));
  });

  it('medical costs under 2 % of the Nettoeinkommen and donations under 100: nothing', () => {
    const r = computeReturn(single({ household: { medicalCosts: amt(100), donations: amt(99) } }));
    expect(find(r, '240')).toBe(0);
    expect(find(r, '244')).toBe(0);
    expect(r.notCounted).toContainEqual(NOTE.medicalThreshold);
    expect(r.notCounted).toContainEqual(NOTE.donationsMinimum);
  });

  it('donations are capped at 20 % of the Nettoeinkommen (234), not of the Reineinkommen', () => {
    // 80,000 - 5,120 - 4,000 = 70,880; 2,400 flat: 234 = 68,480; 20 % = 13,696.
    const r = computeReturn(single({ household: { donations: amt(50_000) } }));
    expect(r.icc?.netIncomeBase.amount).toBe(chf(68_480));
    expect(find(r, '244')).toBe(chf(-13_696));
  });

  it('the child needs its stage, and a child in school whether it is a minor', () => {
    const noStage = computeReturn(single({ children: [{ custody: 'full' }] }));
    expect(noStage.unsupported).toEqual([NOTE.childStage]);
    const noMinor = computeReturn(single({ children: [{ custody: 'full', stage: 'school' }] }));
    expect(noMinor.unsupported).toEqual([NOTE.childMinor]);
    expect(() =>
      computeReturn(single({ children: [{ custody: 'full', stage: 'preschool', minor: false }] })),
    ).toThrow(/preschool/);
  });

  it('education costs with scholarships where the law and Form 10 differ: not computed', () => {
    const r = computeReturn(
      single({
        children: [
          {
            custody: 'full',
            stage: 'school',
            minor: false,
            educationCosts: amt(30_000),
            scholarships: amt(5_000),
          },
        ],
      }),
    );
    expect(r.icc).toBeNull();
    expect(r.unsupported).toEqual([NOTE.educationScholarships]);
  });

  it('a married couple with a child in shared custody, or self-employment: not computed', () => {
    const r = computeReturn({
      ...single({ civilStatus: 'married', people: [employee(), { id: 'p2' }] }),
      children: [{ custody: 'shared', stage: 'school', minor: true }],
    });
    expect(r.unsupported).toEqual([NOTE.marriedShared]);
    const self = computeReturn(single({ people: [employee({ selfEmploymentProfit: amt(1) })] }));
    expect(self.unsupported).toContainEqual(NOTE.selfEmployed);
  });

  it('another religious community: the church tax, and so the tax, is not computed', () => {
    const r = computeReturn(single({ church: { p1: 'other' } }));
    expect(r.icc).toBeNull();
    expect(r.unsupported).toEqual([NOTE.churchOther]);
  });

  it('refuses a p2 for a single person, and an unknown commune', () => {
    expect(() => computeReturn(single({ people: [employee(), { id: 'p2' }] }))).toThrow(/spouse/);
    expect(() => computeReturn(single({ commune: 'Basel' }))).toThrow(/Unknown St. Gallen commune/);
  });
});
