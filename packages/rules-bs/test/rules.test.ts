// The rules the documents state without a worked example, and every case where they leave the
// answer open: the engine computes only when each reading gives the same tax (fail closed).
// Synthetic households only; derivations in the comments, amounts in CHF.
import { describe, expect, it } from 'vitest';
import {
  assess,
  BsInputError,
  BsUnsupported,
  computeReturn,
  NOTE,
  type BsEngineInput,
  type ItemAmount,
  type PersonInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
  code,
  person,
  amount: chf(francs),
});

/** The taxes of a single person from a taxable income and wealth lines, in Basel. */
function single(taxable: number, wealth: ItemAmount[], commune = 'Basel') {
  return assess({
    taxYear: 2025,
    commune,
    incomeTariff: 'A',
    wealthTariff: 'A',
    lowIncomeFamily: false,
    incomeItems: [line('100', taxable, 'p1')],
    wealthItems: wealth,
  });
}

describe('StG § 51: the wealth tax of a low income', () => {
  it('reduced by 75 % when every reading puts the wealth under CHF 100,000', () => {
    // Taxable income 12,000 (under 14,000 in every reading). Net wealth 95,000, taxable 20,000:
    // both under 100,000, 75 %. Tariff A on 20,000: 90.00; reduction 67.50; 22.50.
    const r = single(12_000, [line('835', 95_000), line('891', -75_000)]);
    expect(r.taxes.wealthTariffTax.amount).toBe(chf(90));
    expect(r.taxes.wealthReduction.amount).toBe(chf(-67.5));
    expect(r.taxes.cantonalWealth.amount).toBe(chf(22.5));
    expect(r.taxes.wealthReduction.sources.join(' ')).toContain(
      'bs-2025-law-stg § 51 al. 1 (p. 21)',
    );
  });

  it('not computed when the net and the taxable wealth fall in different bands', () => {
    // Net 160,000 (50 %), taxable 85,000 (75 %).
    expect(() => single(12_000, [line('835', 160_000), line('891', -75_000)])).toThrow(
      BsUnsupported,
    );
  });

  it('not computed at exactly CHF 14,000: the law says at most, the guide less than', () => {
    expect(() => single(14_000, [line('835', 95_000), line('891', -75_000)])).toThrow(
      BsUnsupported,
    );
    // Above the limit in every reading: no reduction.
    expect(
      single(14_100, [line('835', 95_000), line('891', -75_000)]).taxes.wealthReduction.amount,
    ).toBe(0);
  });

  it('Riehen and Bettingen levy their share of the reduced tax, and the result says so', () => {
    // A retiree in Riehen with an AHV pension of 20,000: 709 15,800; 767 and 770: 23,000; taxable
    // income 0. Cash 90,000, allowance 75,000: taxable wealth 15,000, net 90,000, both 75 %.
    // Tariff A: 67.50; reduction 50.625, to 5 centimes 50.65; 16.85. The canton 50 %: 8.425, 8.45;
    // Riehen 46 %: 7.751, 7.75. Total 16.20.
    const r = computeReturn({
      taxYear: 2025,
      commune: 'Riehen',
      civilStatus: 'single',
      church: false,
      people: [{ id: 'p1', pensionAvs: amt(20_000), referenceAge: true }],
      household: { cash: amt(90_000) },
    });
    expect(r.unsupported).toEqual([]);
    expect(r.icc?.taxableIncome.amount).toBe(0);
    expect(r.icc?.taxes.wealthTariffTax.amount).toBe(chf(67.5));
    expect(r.icc?.taxes.wealthReduction.amount).toBe(chf(-50.65));
    expect(r.icc?.taxes.cantonalWealth.amount).toBe(chf(8.45));
    expect(r.icc?.taxes.communalWealth.amount).toBe(chf(7.75));
    expect(r.icc?.taxes.total.amount).toBe(chf(16.2));
    expect(r.unverifiedRules).toContainEqual(NOTE.reductionThenCommune);
  });
});

describe('StG § 52: wealth with a low yield', () => {
  it('computed while the wealth tax is at most 5 per mille of the taxable wealth', () => {
    // 325,000: 1,612.50, under 1,625.
    expect(
      single(50_000, [line('835', 400_000), line('891', -75_000)]).taxes.wealthTariffTax.amount,
    ).toBe(chf(1_612.5));
  });

  it('not computed above: 345,000 gives 1,742.50, more than 1,725', () => {
    try {
      single(50_000, [line('835', 420_000), line('891', -75_000)]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BsUnsupported);
      expect((e as BsUnsupported).note).toEqual(NOTE.lowYield);
    }
  });
});

describe('the questions the tax rests on, and the cases the documents leave open', () => {
  const employee = (more: Partial<PersonInput> = {}): PersonInput => ({
    id: 'p1',
    employments: [{ gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_800) }],
    workRate: 100,
    referenceAge: false,
    ...more,
  });
  const base: BsEngineInput = {
    taxYear: 2025,
    commune: 'Basel',
    civilStatus: 'single',
    church: false,
    people: [employee()],
  };
  const unsupported = (input: BsEngineInput) => {
    const r = computeReturn(input);
    expect(r.total).toBeNull();
    expect(r.icc).toBeNull();
    return r.unsupported;
  };

  it('computes the base case', () => {
    expect(computeReturn(base).total).toBeGreaterThan(0);
  });

  it('the work rate, only when the flat amount could be chosen', () => {
    expect(unsupported({ ...base, people: [employee({ workRate: undefined })] })).toEqual([
      NOTE.workRate,
    ]);
    // Actual costs above the whole flat amount: the work rate does not matter.
    const r = computeReturn({
      ...base,
      people: [employee({ workRate: undefined, otherProfessionalCosts: amt(5_000) })],
    });
    expect(r.unsupported).toEqual([]);
    expect(r.icc?.items.find((i) => i.code === '519')?.amount).toBe(chf(-5_000));
  });

  it('the professional costs never exceed the earned income', () => {
    const r = computeReturn({
      ...base,
      people: [employee({ employments: [{ gross: amt(3_000) }], workRate: 70 })],
    });
    expect(r.icc?.items.find((i) => i.code === '519')?.amount).toBe(chf(-3_000));
  });

  it('a single parent: whether you live as a couple', () => {
    const parent: BsEngineInput = { ...base, children: [{ custody: 'full' }] };
    expect(unsupported(parent)).toEqual([NOTE.cohabitingAsk]);
    expect(unsupported({ ...parent, cohabiting: true })).toEqual([NOTE.cohabiting]);
    expect(computeReturn({ ...parent, cohabiting: false }).icc?.incomeTariff).toBe('B');
  });

  it('shared custody: child support must be known; a married couple with a shared child is not computed', () => {
    expect(unsupported({ ...base, children: [{ custody: 'shared' }] })).toEqual([
      NOTE.childSupport,
    ]);
    expect(
      unsupported({
        ...base,
        civilStatus: 'married',
        people: [employee(), { ...employee(), id: 'p2' }],
        children: [{ custody: 'shared' }],
      }),
    ).toEqual([NOTE.marriedShared]);
    // Paying child support: the child counts for the other parent.
    const r = computeReturn({ ...base, children: [{ custody: 'shared' }], childSupport: 'pays' });
    expect(r.unsupported).toEqual([]);
    expect(r.icc?.items.find((i) => i.code === '750')).toBeUndefined();
    expect(r.assumptions).toContainEqual(NOTE.childSupportPaid);
  });

  it('self-employment and vehicles are not supported', () => {
    expect(
      unsupported({ ...base, people: [employee({ selfEmploymentProfit: amt(10_000) })] }),
    ).toEqual([NOTE.selfEmployed]);
    expect(unsupported({ ...base, household: { vehicles: amt(20_000) } })).toEqual([NOTE.vehicles]);
  });

  it('the reference age, unless every reading of the pension share already settles it', () => {
    expect(unsupported({ ...base, people: [employee({ referenceAge: undefined })] })).toEqual([
      NOTE.referenceAge,
    ]);
    // Only pensions: at least half in every reading, the age does not matter.
    const r = computeReturn({
      ...base,
      people: [{ id: 'p1', pensionAvs: amt(30_000), pensionOccupational: amt(20_000) }],
    });
    expect(r.icc?.items.find((i) => i.code === '770')?.amount).toBe(chf(-3_500));
    // Pension fund 20,000, accident pension 10,000, earnings 25,000 (net): against pensions and
    // earnings, 20,000 of 45,000 or 30,000 of 55,000; the readings differ.
    expect(
      unsupported({
        ...base,
        people: [
          {
            id: 'p1',
            employments: [{ gross: amt(25_000) }],
            workRate: 30,
            pensionOccupational: amt(20_000),
            pensionOther: amt(10_000),
            referenceAge: false,
          },
        ],
      }),
    ).toEqual([NOTE.retireeConflict]);
  });

  it('accounts and securities need their income; a 2025 catch-up into pillar 3a is refused', () => {
    expect(unsupported({ ...base, movable: [{ owner: 'p1', value: amt(10_000) }] })).toEqual([
      NOTE.movableIncome,
    ]);
    expect(
      unsupported({
        ...base,
        people: [employee({ pillar3a: amt(7_258), pillar3aCatchUp: amt(2_000) })],
      }),
    ).toEqual([NOTE.catchUp2025]);
  });

  it('two earners: the law and the guide differ on replacement income', () => {
    expect(
      unsupported({
        ...base,
        civilStatus: 'married',
        people: [employee(), { id: 'p2', replacementIncome: amt(20_000) }],
      }),
    ).toEqual([NOTE.twoEarnerConflict]);
  });

  it('childcare in shared custody above half the limit, and training above the limit for a couple', () => {
    expect(
      unsupported({
        ...base,
        cohabiting: false,
        mainUpkeep: true,
        childSupport: 'none',
        children: [{ custody: 'shared', under14: true, childcare: amt(14_000) }],
      }),
    ).toEqual([NOTE.sharedChildcare]);
    expect(
      unsupported({
        ...base,
        civilStatus: 'married',
        people: [
          employee({ trainingCosts: amt(12_000) }),
          { ...employee({ trainingCosts: amt(10_000) }), id: 'p2' },
        ],
      }),
    ).toEqual([NOTE.trainingCouple]);
  });

  it('the wealth allowance per minor child, when the child’s age changes the tax', () => {
    // Single parent, net wealth 200,000 less 150,000: 50,000; 15,000 more or not changes it. (A
    // salary of 100,000: the taxable income is far from the limit of § 51, CHF 20,000.)
    const parent: BsEngineInput = {
      ...base,
      people: [employee({ employments: [{ gross: amt(100_000) }] })],
      cohabiting: false,
      children: [{ custody: 'full', under14: false }],
      household: { cash: amt(200_000) },
    };
    expect(unsupported(parent)).toEqual([NOTE.minorChild]);
    const r = computeReturn({ ...parent, children: [{ custody: 'full', minor: true }] });
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(35_000));
  });

  it('§ 51 near the limit: the taxable income before and after its rounding to CHF 100', () => {
    // Single parent: 70,080 - 4,200 - 4,200 = 61,680; less 9,000 and 32,600: 20,080, above 20,000;
    // in whole CHF 100, 20,000, at the limit. With wealth to tax, the readings differ.
    expect(
      unsupported({
        ...base,
        cohabiting: false,
        children: [{ custody: 'full', minor: true }],
        household: { cash: amt(200_000) },
      }),
    ).toEqual([NOTE.lowIncome]);
  });

  it('fails closed on what it cannot read', () => {
    expect(() => computeReturn({ ...base, commune: 'Liestal' })).toThrow(BsInputError);
    expect(() => computeReturn({ ...base, taxYear: 2024 as 2025 })).toThrow(RangeError);
    expect(() =>
      computeReturn({ ...base, people: [employee(), { ...employee(), id: 'p2' }] }),
    ).toThrow(BsInputError);
  });
});
