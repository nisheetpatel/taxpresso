// One test per rule, against the worked examples of the official documents where they have one
// (ge-2025-guide-declaration-pp, page given), otherwise against the rule as the document states it.
import { describe, expect, it } from 'vitest';
import { ICC_2025 } from '../src/2025/icc-amounts.js';
import { IFD_2025 } from '../src/2025/ifd.js';
import {
  donationDeduction,
  flatProfessional,
  mealsDeduction,
  medicalDeduction,
  pillar3aCapWithoutFund,
  twoEarnerFederal,
} from '@taxpresso/rules-ch';
import { avsDeduction, lifeInsuranceCap } from '../src/engine/rules.js';
import { computeReturn, type EngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const find = (items: readonly { code: string; amount: number }[], code: string) =>
  items.find((i) => i.code === code)?.amount;

describe('worked examples of the 2025 guide', () => {
  it('flat professional expenses (p. 19): 73,525 - 4,816 - 3,676 = 65,033; x 3 % = 1,951', () => {
    expect(flatProfessional(chf(65_033), ICC_2025.professionalFlat.value)).toBe(chf(1_812)); // limited to 1,812
    expect(flatProfessional(chf(65_033), IFD_2025.professionalFlat.value)).toBe(chf(2_000)); // minimum 2,000
    expect(flatProfessional(chf(40_000), ICC_2025.professionalFlat.value)).toBe(chf(1_200));
  });

  it('medical costs (p. 14): 7,000 less 0.5 % of 60,000 (ICC) and 5 % of 80,000 (IFD)', () => {
    expect(medicalDeduction(chf(7_000), chf(60_000), 50)).toEqual({
      threshold: chf(300),
      deduction: chf(6_700),
    });
    expect(medicalDeduction(chf(7_000), chf(80_000), 500)).toEqual({
      threshold: chf(4_000),
      deduction: chf(3_000),
    });
    expect(medicalDeduction(chf(3_000), chf(80_000), 500).deduction).toBe(0);
  });

  it('donations (p. 15): 12,200 limited to 20 % of 53,300 (ICC); in full under 20 % of 77,000 (IFD)', () => {
    expect(donationDeduction(chf(12_200), chf(53_300), 2000)).toEqual({
      cap: chf(10_660),
      deduction: chf(10_660),
    });
    expect(donationDeduction(chf(12_200), chf(77_000), 2000, chf(100))).toEqual({
      cap: chf(15_400),
      deduction: chf(12_200),
    });
    expect(donationDeduction(chf(99), chf(77_000), 2000, chf(100)).deduction).toBe(0); // IFD: at least 100
  });

  it('two earners, federal (p. 21): under 8,600 that income; to 17,200, 8,600; then 50 % up to 14,100', () => {
    const p = IFD_2025.twoEarner.value;
    expect(twoEarnerFederal(chf(5_000), p)).toBe(chf(5_000));
    expect(twoEarnerFederal(chf(10_000), p)).toBe(chf(8_600));
    expect(twoEarnerFederal(chf(17_200), p)).toBe(chf(8_600));
    expect(twoEarnerFederal(chf(20_000), p)).toBe(chf(10_000));
    expect(twoEarnerFederal(chf(40_000), p)).toBe(chf(14_100));
    expect(twoEarnerFederal(0, p)).toBe(0);
  });

  it('pillar 3a without a pension fund (p. 18): 20 % of earned income, at most 36,288', () => {
    const p = ICC_2025.pillar3a.value;
    expect(pillar3aCapWithoutFund(chf(60_000), p)).toBe(chf(12_000));
    expect(pillar3aCapWithoutFund(chf(200_000), p)).toBe(chf(36_288));
  });

  it('life insurance and savings interest, ICC (p. 28)', () => {
    const p = ICC_2025.lifeInsurance.value;
    expect(lifeInsuranceCap(p, false, 1, 0).cap).toBe(chf(2_345));
    expect(lifeInsuranceCap(p, false, 0, 0).cap).toBe(chf(4_690)); // doubled
    expect(lifeInsuranceCap(p, true, 2, 0).cap).toBe(chf(3_518)); // 2 x 1,759
    expect(lifeInsuranceCap(p, true, 1, 0).cap).toBe(chf(5_277)); // half as much again
    expect(lifeInsuranceCap(p, true, 0, 0).cap).toBe(chf(7_036)); // doubled
    expect(lifeInsuranceCap(p, true, 2, 2).cap).toBe(chf(3_518 + 2 * 959));
    // (3,518 + 959) x 1.5 = 6,715.50: the half franc is dropped.
    expect(lifeInsuranceCap(p, true, 1, 1)).toEqual({ exact: 671_550, cap: chf(6_715) });
  });

  it('AVS/AI pensioners (p. 16, tables 1 and 2)', () => {
    const { couple, other } = ICC_2025.avsDeduction.value;
    expect(avsDeduction(couple, chf(61_300), false)).toBe(chf(10_661));
    expect(avsDeduction(couple, chf(61_300), true)).toBe(chf(12_260));
    expect(avsDeduction(couple, chf(61_301), false)).toBe(chf(8_529));
    expect(avsDeduction(couple, chf(98_080), true)).toBe(chf(2_452));
    expect(avsDeduction(couple, chf(98_081), true)).toBe(0);
    expect(avsDeduction(other, chf(53_304), false)).toBe(chf(10_661));
    expect(avsDeduction(other, chf(85_287), false)).toBe(chf(2_132));
    expect(avsDeduction(other, chf(85_288), false)).toBe(0);
  });

  it('meals (p. 19): 15 a day up to 3,200; half (7.50, 1,600) with a canteen', () => {
    const p = IFD_2025.meals.value;
    expect(mealsDeduction(100, false, p)).toBe(chf(1_500));
    expect(mealsDeduction(220, false, p)).toBe(chf(3_200));
    expect(mealsDeduction(100, true, p)).toBe(chf(750));
    expect(mealsDeduction(220, true, p)).toBe(chf(1_600));
  });
});

const single = (extra: Partial<EngineInput['people'][number]> = {}): EngineInput => ({
  taxYear: 2025,
  commune: 'hermance',
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      employments: [
        {
          gross: { value: chf(73_525) },
          socialContributions: { value: chf(4_816) },
          pensionFund: { value: chf(3_676) },
        },
      ],
      ...extra,
    },
  ],
});

describe('professional expenses: flat or actual (p. 22)', () => {
  it('example 1: actual costs under the flat deduction, the flat one is used', () => {
    const r = computeReturn(
      single({ commuteCost: { value: chf(800) }, otherProfessionalCosts: { value: chf(120) } }),
    );
    expect(find(r.icc!.items, '31.50')).toBe(-chf(1_812));
    expect(find(r.icc!.items, '31.70')).toBeUndefined();
    // IFD: the flat 3 % for the other costs and the commute on its own (at most 3,300).
    expect(find(r.ifd!.items, '31.20')).toBe(-chf(2_000));
    expect(find(r.ifd!.items, '31.71')).toBe(-chf(800));
  });

  it('example 2: more than 2 hours a day by public transport, actual costs 534 + 3,200 + 120 = 3,854', () => {
    const r = computeReturn(
      single({
        commuteCost: { value: chf(1_200) },
        mealDays: 220,
        mealsIccAllowed: true,
        otherProfessionalCosts: { value: chf(120) },
      }),
    );
    expect(find(r.icc!.items, '31.50')).toBeUndefined();
    expect(find(r.icc!.items, '31.70')).toBe(-chf(534));
    expect(find(r.icc!.items, '31.60')).toBe(-chf(3_200));
    expect(find(r.icc!.items, '31.63')).toBe(-chf(120));
    expect(find(r.ifd!.items, '31.60')).toBe(-chf(3_200));
  });

  it('box F (free transport): no commuting deduction', () => {
    const r = computeReturn({
      ...single({ commuteCost: { value: chf(800) } }),
      people: [
        {
          id: 'p1',
          employments: [{ gross: { value: chf(60_000) }, freeTransport: true }],
          commuteCost: { value: chf(800) },
        },
      ],
    });
    expect(find(r.ifd!.items, '31.71')).toBeUndefined();
    expect(r.notCounted.some((n) => /Box F/.test(n.en))).toBe(true);
  });
});

describe('household rules', () => {
  it('two earners, cantonal: 1,051, never more than the lower earned income', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(90_000) } }] },
        { id: 'p2', employments: [{ gross: { value: chf(1_500) } }] },
      ],
    });
    // B: 1,500 less the flat 640 = 860 earned, under 1,051.
    expect(find(r.icc!.items, '41.95')).toBe(-chf(860));
    // IFD: 1,500 less the flat 2,000 = -500, nothing earned: no deduction.
    expect(find(r.ifd!.items, '41.90')).toBeUndefined();
  });

  it('health premiums, cantonal: at most the limits of the adults and children (p. 29)', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [{ id: 'p1', age: 'young' }],
      children: [{ custody: 'full', age: 'child' }],
      household: { healthPremiums: { value: chf(20_000) } },
    });
    expect(find(r.icc!.items, '52.21')).toBe(-chf(12_842 + 3_965));
  });

  it('health subsidy: income for the cantonal tax, premiums net of it for the federal tax', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(40_000) } }] }],
      household: { healthPremiums: { value: chf(5_000) }, healthSubsidy: { value: chf(4_000) } },
    });
    expect(find(r.icc!.items, '16.30')).toBe(chf(4_000));
    expect(find(r.icc!.items, '52.21')).toBe(-chf(5_000));
    expect(find(r.ifd!.items, '16.30')).toBeUndefined();
    expect(find(r.ifd!.items, '52.00')).toBe(-chf(1_000));
    expect(r.unverifiedRules.some((n) => /subsidy/.test(n.en))).toBe(true);
  });

  it('childcare: none when only one spouse works', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'married',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(90_000) } }] }, { id: 'p2' }],
      children: [{ custody: 'full', childcare: { value: chf(10_000) } }],
    });
    expect(find(r.icc!.items, '59.10')).toBeUndefined();
    expect(find(r.icc!.items, '61.25')).toBe(-chf(13_660)); // full family charge, no childcare
  });

  it('debt interest: at most the income from wealth + 50,000 (p. 37)', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(200_000) } }] }],
      household: { debtInterest: { value: chf(60_000) }, debts: { value: chf(100_000) } },
      movable: [{ owner: 'p1', value: { value: chf(300_000) }, income: { value: chf(2_000) } }],
    });
    expect(find(r.icc!.items, '55.10')).toBe(-chf(52_000));
    expect(find(r.ifd!.items, '55.10')).toBe(-chf(52_000));
    // Wealth: 300,000 - 100,000 debts = 200,000 net, less 87,632.
    expect(r.icc!.wealth.taxableWealth.amount).toBe(chf(112_368));
  });

  it('wealth social deduction (p. 16): single, single parent, couple with children', () => {
    const earner = { id: 'p1' as const, employments: [{ gross: { value: chf(300_000) } }] };
    const run = (input: Partial<EngineInput>) =>
      computeReturn({
        taxYear: 2025,
        commune: 'geneve',
        civilStatus: 'single',
        people: [earner],
        movable: [{ owner: 'p1', value: { value: chf(1_000_000) } }],
        ...input,
      }).icc!.wealth.socialDeduction.amount;
    expect(run({})).toBe(-chf(87_632));
    expect(run({ children: [{ custody: 'full' }] })).toBe(-chf(175_264 + 43_816));
    expect(
      run({
        civilStatus: 'married',
        people: [earner, { id: 'p2' }],
        children: [{ custody: 'full' }, { custody: 'full' }],
      }),
    ).toBe(-chf(175_264 + 2 * 43_816));
    // Limited to the net wealth.
    expect(run({ movable: [{ owner: 'p1', value: { value: chf(10_000) } }] })).toBe(-chf(10_000));
  });

  it('taxe personnelle (LCP art. 375, 377): 25, except without wealth and with a small income', () => {
    const tax = (gross: number, children = 0) =>
      computeReturn({
        taxYear: 2025,
        commune: 'geneve',
        civilStatus: 'single',
        people: [{ id: 'p1', employments: [{ gross: { value: chf(gross) } }] }],
        children: Array.from({ length: children }, () => ({ custody: 'full' as const })),
      }).icc!.taxes.personalTax.amount;
    expect(tax(4_000)).toBe(0); // 4,000 - 640 = 3,360, at most 3,400
    expect(tax(4_100)).toBe(chf(25)); // 3,460
    // With full splitting the limit is 5,000.
    expect(tax(19_000, 1)).toBe(0); // 19,000 - 640 - 13,660 = 4,700
    expect(tax(20_000, 1)).toBe(chf(25)); // 5,700
  });

  it('salary earned in another commune: the rest goes to it in proportion to all income', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'thonex',
      civilStatus: 'single',
      people: [
        { id: 'p1', employments: [{ gross: { value: chf(80_000) }, workCommune: 'geneve' }] },
      ],
      movable: [{ owner: 'p1', income: { value: chf(20_000) } }],
    });
    const split = r.icc!.taxes.communalIncome;
    const rest = r.icc!.taxes.incomeBase.amount - split.privileged.base.amount;
    // 80,000 of the 100,000 gross income is earned in Genève.
    expect(split.rest.find((s) => s.commune === 'geneve')!.base.amount).toBe(
      Math.floor((rest * 0.8) / 5 + 0.5) * 5,
    );
    expect(split.rest.reduce((s, x) => s + x.base.amount, 0)).toBe(rest);
  });

  it('tax shield (LIPP art. 60): fails closed when it may apply', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [{ id: 'p1' }],
      movable: [{ owner: 'p1', value: { value: chf(5_000_000) } }],
    });
    expect(r.icc).toBeNull();
    expect(r.ifd).not.toBeNull();
    expect(r.unsupported[0]!.en).toMatch(/tax shield/);
  });
});

describe('estimates and values awaiting the user’s OK', () => {
  it('flags items that rest on an estimate or an extracted value, and every line built on them', () => {
    const r = computeReturn({
      taxYear: 2025,
      commune: 'geneve',
      civilStatus: 'single',
      people: [
        {
          id: 'p1',
          employments: [{ gross: { value: chf(80_000), status: 'extracted', facts: ['f_1'] } }],
          pillar3a: { value: chf(7_000), status: 'estimate', facts: ['f_2'] },
        },
      ],
    });
    const gross = r.icc!.items.find((i) => i.code === '11.10')!;
    expect(gross.needsOk).toBe(true);
    expect(gross.facts).toEqual(['f_1']);
    expect(r.icc!.items.find((i) => i.code === '31.40')!.estimates).toEqual(['input-estimate']);
    expect(r.icc!.taxes.total.needsOk).toBe(true);
    expect(r.icc!.taxes.total.estimates).toEqual(['input-estimate']);
    expect(r.needsOk).toBeGreaterThan(0);
    expect(r.estimates.find((e) => e.id === 'input-estimate')!.what.en).toBe(
      'Figures you gave as estimates: 31.40 Cotisations au 3ème pilier A (A).',
    );
  });

  it('explains every line in English and French, with its sources', () => {
    const r = computeReturn(single());
    for (const line of [...r.icc!.items, r.icc!.taxes.incomeBase, r.icc!.taxes.total, r.ifd!.tax]) {
      expect(line.how.en.length).toBeGreaterThan(5);
      expect(line.how.fr.length).toBeGreaterThan(5);
      expect(line.label.fr.length).toBeGreaterThan(2);
      expect(line.sources.length).toBeGreaterThan(0);
      expect(`${line.how.en} ${line.how.fr}`).not.toMatch(/[–—]/); // no en or em dashes
    }
  });
});

describe('the état des titres in the engine', () => {
  const w = (
    code: string,
    part: 'income' | 'deduction' | 'wealth' | 'wealth_deduction' | 'credit',
    centimes: number,
    extra: { complete?: boolean; taxes?: ('icc' | 'ifd')[] } = {},
  ) => ({
    code,
    part,
    person: 'p1' as const,
    centimes,
    taxes: extra.taxes ?? ['icc', 'ifd'],
    estimate: false,
    complete: extra.complete ?? true,
    label: { en: code, fr: code },
    source: 'ge-2025-declaration-specimen p. 21',
  });
  const run = (items: ReturnType<typeof w>[]) => computeReturn({ ...single(), wealthItems: items });

  it('takes income, wealth, fees and credits by rubric', () => {
    const r = run([
      w('14.00', 'income', chf(2_000)),
      w('14.00', 'wealth', chf(300_000), { taxes: ['icc'] }),
      w('56.20', 'deduction', chf(150)),
      w('F1.IA', 'credit', chf(350), { taxes: ['icc'] }),
    ]);
    expect(find(r.icc!.items, '14.00')).toBe(chf(2_000));
    expect(find(r.ifd!.items, '14.00')).toBe(chf(2_000));
    expect(find(r.icc!.items, '56.20')).toBe(-chf(150));
    expect(r.icc!.wealth.grossWealth.amount).toBe(chf(300_000));
    expect(r.icc!.credits.withholdingTax?.amount).toBe(chf(350));
    expect(r.icc!.taxes.total.amount).toBeGreaterThan(0);
  });

  it('puts savings interest and life insurance premiums within the insurance limits (52.15, 52.00)', () => {
    const r = run([w('56.30', 'deduction', chf(500)), w('52.11', 'deduction', chf(3_000))]);
    expect(find(r.icc!.items, '52.15')).toBe(-chf(2_345)); // single, with a pension fund: 2,345
    expect(find(r.ifd!.items, '52.00')).toBe(-chf(1_800));
    expect(find(r.icc!.items, '56.30')).toBeUndefined();
  });

  it('flags every tax built on an amount known only in part', () => {
    const r = run([w('14.00', 'income', chf(2_000), { complete: false })]);
    expect(r.complete).toBe(false);
    expect(r.incomplete[0]!.en).toMatch(/floor/);
    expect(r.icc!.taxes.total.incomplete).toBe(true);
    expect(r.ifd!.tax.incomplete).toBe(true);
  });
});
