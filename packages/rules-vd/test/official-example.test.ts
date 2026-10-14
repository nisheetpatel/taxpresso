// The official worked examples for Vaud, as printed (amounts in CHF):
// - vd-2025-guide p. 61: two complete computations of the cantonal and communal income tax, from
//   the taxable income and the parts, with the LRIPP reduction and Lausanne's rate;
// - vd-2025-guide p. 52 to 54: the rate-determining income (code 820), below and above the cap of
//   the quotient familial; p. 19 to 31 and 40 to 51: the examples of the deductions;
// - vd-2025-tariff-revenu and vd-2026-tariff-revenu p. 31: the scale above CHF 300,000.
import { describe, expect, it } from 'vitest';
import {
  assess,
  computeReturn,
  drivingCost,
  familyDeduction,
  flatShare,
  housingDeduction,
  modestDeduction,
  NOTE,
  publicTransportFlat,
  scaleTax,
  twoEarnerDeduction,
  vdParamsFor,
  type ItemAmount,
  type VdEngineInput,
  type VdFamily,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const A25 = vdParamsFor(2025).amounts;

/** The taxes from a taxable income alone, as the guide's examples start. */
function fromTaxable(
  taxYear: 2025 | 2026,
  taxable: number,
  family: VdFamily,
  commune = 'Lausanne',
  wealthItems: ItemAmount[] = [],
) {
  return assess({
    taxYear,
    commune,
    family,
    incomeItems: [{ code: '100', person: 'p1', amount: chf(taxable) }],
    wealthItems,
  });
}

const single: VdFamily = { base: 'single', fullChildren: 0, sharedChildren: 0 };
const married = (children: number): VdFamily => ({
  base: 'married',
  fullChildren: children,
  sharedChildren: 0,
});

describe('vd-2025-guide p. 61, examples of the tax for one year (Lausanne, 78.5 %)', () => {
  it('Example 1: single, taxable income 20,700', () => {
    // Base tax on 15,100: 603.00; 56 x 7.00 = 392.00; 995.00. Reduction 995.00 x 4.0 % = 39.80:
    // 955.20. Cantonal 955.20 x 155 % = 1,480.55. Communal 995.00 x 78.5 % = 781.10. 2,261.65.
    const r = fromTaxable(2025, 20_700, single);
    expect(r.taxableIncome.amount).toBe(chf(20_700));
    expect(r.parts).toBe(100);
    expect(r.taxes.incomeBase.amount).toBe(chf(995));
    expect(r.taxes.incomeReduction.amount).toBe(chf(-39.8));
    expect(r.taxes.cantonalIncome.amount).toBe(chf(1_480.55));
    expect(r.taxes.communalIncome.amount).toBe(chf(781.1));
    expect(r.taxes.total.amount).toBe(chf(2_261.65));
  });

  it('Example 2: married, two children (parts 2.8), taxable income 48,200', () => {
    // 48,200 / 2.8 = 17,200 (820). On 15,100: 603.00, 21 x 7.00 = 147.00: 750.00, 4.360465 % of
    // 17,200. 48,200 x 4.360465 % = 2,101.75. Reduction 84.05: 2,017.70. Cantonal 3,127.45.
    // Communal 2,101.75 x 78.5 % = 1,649.85. Total 4,777.30.
    const r = fromTaxable(2025, 48_200, married(2));
    expect(r.parts).toBe(280);
    expect(r.rateIncome.amount).toBe(chf(17_200));
    expect(r.taxes.incomeBase.how.en).toContain('4.360465 %');
    expect(r.taxes.incomeBase.amount).toBe(chf(2_101.75));
    expect(r.taxes.incomeReduction.amount).toBe(chf(-84.05));
    expect(r.taxes.cantonalIncome.amount).toBe(chf(3_127.45));
    expect(r.taxes.communalIncome.amount).toBe(chf(1_649.85));
    expect(r.taxes.total.amount).toBe(chf(4_777.3));
  });
});

describe('vd-2025-guide p. 52 to 54, the rate-determining income (code 820)', () => {
  const rate = (taxable: number, family: VdFamily) =>
    fromTaxable(2025, taxable, family).rateIncome.amount;

  it('spouses without children: 220,000 / 1.8 = 122,222, taken as 122,200 (never capped)', () => {
    expect(rate(220_000, married(0))).toBe(chf(122_200));
  });

  it('spouses with four children: 260,000 / 3.8 = 68,400; 300,000: 166,666 - 82,953 = 83,700', () => {
    expect(rate(260_000, married(4))).toBe(chf(68_400));
    expect(rate(300_000, married(4))).toBe(chf(83_700));
  });

  it('single parent (1.3) with two children: 195,000 / 2.3 = 84,700; 250,000: 192,308 - 79,097 = 113,200', () => {
    const f: VdFamily = { base: 'singleParent', fullChildren: 2, sharedChildren: 0 };
    expect(rate(195_000, f)).toBe(chf(84_700));
    expect(rate(250_000, f)).toBe(chf(113_200));
  });

  it('single (1.0) with two children: 195,000 / 2 = 97,500; 240,000 - 118,250 = 121,700', () => {
    const f: VdFamily = { base: 'single', fullChildren: 2, sharedChildren: 0 };
    expect(rate(195_000, f)).toBe(chf(97_500));
    expect(rate(240_000, f)).toBe(chf(121_700));
  });

  it('the tables are the law’s cap: the reduction at the threshold for n children (LI art. 43 al. 3)', () => {
    const q = A25.quotientCap.value;
    for (const [rows, base] of [
      [q.married, 1.8],
      [q.singleParent, 1.3],
      [q.single, 1],
    ] as const) {
      rows.forEach(([threshold, max], i) => {
        const T = threshold / 100;
        expect(Math.round(T / base - T / (base + 0.5 * (i + 1)))).toBe(max / 100);
        // 180,000 plus 20,000 per further child in the law, adjusted to 212,900 + 23,600 each.
        expect(threshold).toBe(chf(212_900 + 23_600 * i));
      });
    }
  });
});

describe('the scale above CHF 300,000 (tariff p. 31)', () => {
  it('2025: tax on 300,000 = 36,343.50; on 427,900 = 56,168.00, 13.126 %', () => {
    const s = vdParamsFor(2025).incomeScale.value;
    expect(scaleTax(s, chf(300_000))).toBe(chf(36_343.5));
    expect(scaleTax(s, chf(427_900))).toBe(chf(56_168));
    expect(Math.round((56_168 / 427_900) * 100_000) / 1000).toBe(13.126);
  });

  it('2026: tax on 300,000 = 36,335.50; on 427,900 = 56,160.00, 13.125 %', () => {
    const s = vdParamsFor(2026).incomeScale.value;
    expect(scaleTax(s, chf(300_000))).toBe(chf(36_335.5));
    expect(scaleTax(s, chf(427_900))).toBe(chf(56_160));
  });
});

describe('vd-2025-guide, the deductions’ examples', () => {
  it('140, public transport (p. 19): 19 km one way, 2,976 a year; 51 km and more, 4,080', () => {
    expect(publicTransportFlat(A25.publicTransport!.value, 19)).toBe(chf(2_976));
    expect(publicTransportFlat(A25.publicTransport!.value, 2)).toBe(chf(1_176));
    expect(publicTransportFlat(A25.publicTransport!.value, 1)).toBe(chf(1_176));
    expect(publicTransportFlat(A25.publicTransport!.value, 51)).toBe(chf(4_080));
    expect(publicTransportFlat(A25.publicTransport!.value, 80)).toBe(chf(4_080));
  });

  it('140, car (p. 21): 19 km x 2 x 240 days at 70 ct = 6,384; 45 km: 10,500 + 2,310 = 12,810', () => {
    expect(drivingCost(19, 240, A25.car.value)).toBe(chf(6_384));
    expect(drivingCost(45, 240, A25.car.value)).toBe(chf(12_810));
  });

  it('160 (p. 22): 3 % of the net salary, at least 2,000, at most 4,000, at most the salary', () => {
    expect(flatShare(chf(50_000), A25.professionalFlat.value)).toBe(chf(2_000));
    expect(flatShare(chf(100_000), A25.professionalFlat.value)).toBe(chf(3_000));
    expect(flatShare(chf(200_000), A25.professionalFlat.value)).toBe(chf(4_000));
    expect(flatShare(chf(1_500), A25.professionalFlat.value)).toBe(chf(1_500));
  });

  it('165 (p. 23): 300 -> 300; 6,000 -> 1,200; 15,000 -> 2,400', () => {
    expect(flatShare(chf(300), A25.sideJobFlat.value)).toBe(chf(300));
    expect(flatShare(chf(6_000), A25.sideJobFlat.value)).toBe(chf(1_200));
    expect(flatShare(chf(15_000), A25.sideJobFlat.value)).toBe(chf(2_400));
  });

  it('235 (p. 26): the lower net income 800 gives 800', () => {
    expect(twoEarnerDeduction(chf(800), A25.twoEarner.value)).toBe(chf(800));
    expect(twoEarnerDeduction(chf(30_000), A25.twoEarner.value)).toBe(chf(1_700));
    expect(twoEarnerDeduction(chf(-100), A25.twoEarner.value)).toBe(0);
  });

  it('660 (p. 44): a couple with two children, maximum rent 21,100', () => {
    const cap = A25.rentCap.value.family + 2 * A25.rentCap.value.perChild;
    expect(cap).toBe(chf(21_100));
    const h = A25.housing.value;
    expect(housingDeduction(chf(22_000), chf(60_000), cap, h)).toBe(chf(6_800));
    expect(housingDeduction(chf(18_000), chf(80_000), cap, h)).toBe(chf(2_000));
    expect(housingDeduction(chf(12_000), chf(70_000), cap, h)).toBe(0);
  });

  it('695 (p. 47): 49,295 with a maximum of 29,700 gives 19,900', () => {
    expect(modestDeduction(chf(49_295), chf(29_700))).toBe(chf(19_900));
    expect(modestDeduction(chf(10_000), chf(17_000))).toBe(chf(10_000));
  });

  it('695 (p. 46 and 47): tables 2a to 2c are the base, spouse, single parent and per child amounts', () => {
    const m = A25.modest.value;
    expect([1, 2, 3].map((n) => m.base + m.perChild * (n - 1))).toEqual(
      [17_000, 20_500, 24_000].map(chf),
    );
    expect([0, 1, 2].map((k) => m.base + m.spouse + m.perChild * k)).toEqual(
      [22_700, 26_200, 29_700].map(chf),
    );
    expect([1, 2].map((k) => m.base + m.singleParent + m.perChild * k)).toEqual(
      [23_700, 27_200].map(chf),
    );
  });

  it('695 (p. 46 and 47): tables 1a to 1c, the first income without the deduction', () => {
    // 1 person: 50,900; spouses, 2 persons: 68,000; single parent and child: 71,000.
    const limits: [number, number][] = [
      [50_900, 17_000],
      [68_000, 22_700],
      [71_000, 23_700],
      [71_900, 24_000],
      [120_500, 40_200],
    ];
    for (const [limit, max] of limits) {
      expect(modestDeduction(chf(limit), chf(max))).toBe(0);
      expect(modestDeduction(chf(limit - 1), chf(max))).toBe(chf(100));
    }
  });

  it('725 (p. 50): spouses with two children, 3,300 up to 128,399, then 100 less per 2,100', () => {
    const f = A25.family.value;
    const full = f.married + 2 * f.perChild;
    expect(full).toBe(chf(3_300));
    const rows: [number, number][] = [
      [126_300, 3_300],
      [128_399, 3_300],
      [128_400, 3_200],
      [130_500, 3_100],
      [162_000, 1_600],
      [164_100, 1_500],
      [165_099, 1_500],
      [165_100, 1_400],
      [168_099, 1_200],
      [179_100, 0],
    ];
    for (const [net, ded] of rows) {
      expect(familyDeduction(full, chf(net), f)).toBe(chf(ded));
    }
  });

  it('725 (p. 51), example 2: a single parent with two children, 2,800 + 1,000 + 1,000 = 4,800', () => {
    const f = A25.family.value;
    expect(familyDeduction(f.singleParent + 2 * f.perChild, chf(126_300), f)).toBe(chf(4_800));
  });

  const household = (over: Partial<VdEngineInput>): VdEngineInput => ({
    taxYear: 2025,
    commune: 'Lausanne',
    civilStatus: 'single',
    rent: amt(0),
    people: [{ id: 'p1', employments: [{ gross: amt(90_000) }] }],
    ...over,
  });
  const item = (r: ReturnType<typeof computeReturn>, code: string) =>
    r.icc?.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

  it('300 (p. 29 and 30): the four examples', () => {
    const cases: [Partial<VdEngineInput>, number, number, number][] = [
      // couple, premiums 10,250, no subsidy: at most 9,900.
      [{ civilStatus: 'married', people: [{ id: 'p1' }, { id: 'p2' }] }, 10_250, 0, 9_900],
      // couple with two children: 17,000 - 4,032 = 12,968, at most 12,500.
      [
        {
          civilStatus: 'married',
          people: [{ id: 'p1' }, { id: 'p2' }],
          children: [{ custody: 'full' }, { custody: 'full' }],
        },
        17_000,
        4_032,
        12_500,
      ],
      // single: 5,319 - 2,400 = 2,919 (under 5,000).
      [{}, 5_319, 2_400, 2_919],
      // single with one child: 8,800 - 2,300 = 6,500, at most 6,300.
      [{ ownHousehold: true, children: [{ custody: 'full' }] }, 8_800, 2_300, 6_300],
    ];
    for (const [over, premiums, subsidy, expected] of cases) {
      const r = computeReturn(
        household({
          ...over,
          household: { healthPremiums: amt(premiums), healthSubsidy: amt(subsidy) },
        }),
      );
      expect(item(r, '300')).toBe(chf(-expected));
    }
  });

  it('480 (p. 40): the maximum deductions, and never more than the interest', () => {
    const couple = {
      civilStatus: 'married' as const,
      people: [{ id: 'p1' as const }, { id: 'p2' as const }],
    };
    const kids = (n: number) => Array.from({ length: n }, () => ({ custody: 'full' as const }));
    const cases: [Partial<VdEngineInput>, number][] = [
      [{}, 1_600],
      [{ ownHousehold: true, children: kids(1) }, 1_900],
      [{ ownHousehold: true, children: kids(2) }, 2_200],
      [couple, 3_300],
      [{ ...couple, children: kids(1) }, 3_600],
      [{ ...couple, children: kids(2) }, 3_900],
      [{ ...couple, children: kids(3) }, 4_200],
      [{ ...couple, children: kids(4) }, 4_500],
    ];
    const movable = [{ owner: 'household' as const, value: amt(500_000), income: amt(9_000) }];
    for (const [over, max] of cases) {
      const r = computeReturn(
        household({ ...over, movable, household: { savingsInterest: amt(8_000) } }),
      );
      expect(item(r, '480')).toBe(chf(-max));
    }
    const small = computeReturn(household({ movable, household: { savingsInterest: amt(250) } }));
    expect(item(small, '480')).toBe(chf(-250));
  });

  it('725 (p. 51), example 3: a single person with children but not the part of 1.3 conflicts with LI art. 42a al. 1', () => {
    const r = computeReturn(
      household({ ownHousehold: false, children: [{ custody: 'full' }, { custody: 'full' }] }),
    );
    expect(r.icc).toBeNull();
    expect(r.unsupported).toContainEqual(NOTE.familyConflict);
  });
});
