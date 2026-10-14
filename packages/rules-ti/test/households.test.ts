// Five synthetic households (no real person), each derived by hand in the comments from the
// documents: the 2025 decree and instructions, the 2026 decree, the tax law (LT) and the canton's
// table of communal multipliers. Amounts in CHF in the comments, centimes in the code.
import { describe, expect, it } from 'vitest';
import { computeReturn, type Item, type TiEngineInput, type TiTaxResult } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The amount of an item by line and person (household if not given). */
function line(r: TiTaxResult, code: string, person?: Item['person']) {
  const items = [...(r.icc?.items ?? []), ...(r.icc?.wealth.items ?? [])];
  const found = items.filter(
    (i) => i.code === code && (person === undefined || i.person === person),
  );
  if (found.length !== 1) throw new Error(`${code} ${person ?? ''}: ${found.length} items`);
  return found[0]!.amount;
}

describe('a single person in Lugano, 2025', () => {
  // Salary: gross 85,000, box 9 5,440, box 10.1 5,100: net salary (1.1) 74,460.
  // Professional costs (9.1, decree 2025 art. 3, 4, 7): public transport 1,000; lunch 200 days x 15
  // = 3,000 (at most 3,200); other costs, the flat amount 3,000 (work rate 100 %): 7,000.
  // Pillar 3a (11.1): 7,258, the limit with a pension fund.
  // Insurance (12): health premiums 4,800 + savings interest 50 = 4,850, under the cap of 5,500
  // (other taxpayers, paying into a pension fund): 4,850.
  // Accounts (4.1): income 50.
  // 8 = 74,460 + 50 = 74,510; 16 = 7,000 + 7,258 + 4,850 = 19,108; 19 = 55,402; 21 = 55,402.
  // Illness costs 1,500, under 5 % of 55,402 = 2,770: nothing (22.1). 23 = 55,402.
  // Donations 400, at most 20 % of 55,402 = 11,080: 400 (24). 26 = 55,002; 28 = 55,002.
  // Tariff for single people 2025 at 55,000: between 52,700 (3,245.50) and 58,100 (3,838.85):
  // 3,245.50 + 2,300 x 593.35 / 5,400 = 3,498.2231: 3,498.20 (the canton's table, p. 51: 3,498.20).
  // Cantonal tax: x 100 % = 3,498.20. Lugano 2025, 77 %: 2,693.614: 2,693.60.
  // Wealth 60,000: under 200,000, no tax. Personal tax 40.
  // Total: 3,498.20 + 2,693.60 + 40 = 6,231.80.
  const input: TiEngineInput = {
    taxYear: 2025,
    commune: 'Lugano',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_000),
        mealDays: 200,
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    household: {
      healthPremiums: amt(4_800),
      savingsInterest: amt(50),
      medicalCosts: amt(1_500),
      donations: amt(400),
    },
    movable: [{ owner: 'p1', value: amt(60_000), income: amt(50) }],
  };
  const r = computeReturn(input);

  it('gives the lines and subtotals of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '1.1', 'p1')).toBe(chf(74_460));
    expect(line(r, '9.1', 'p1')).toBe(-chf(7_000));
    expect(line(r, '11.1', 'p1')).toBe(-chf(7_258));
    expect(line(r, '12')).toBe(-chf(4_850));
    expect(line(r, '24')).toBe(-chf(400));
    expect(r.icc!.grossIncome.amount).toBe(chf(74_510));
    expect(r.icc!.totalDeductions.amount).toBe(-chf(19_108));
    expect(r.icc!.netIncome2.amount).toBe(chf(55_402));
    expect(r.icc!.taxableIncome.amount).toBe(chf(55_002));
    expect(r.icc!.incomeTariff).toBe('single');
    expect(r.notCounted.map((n) => n.en)).toContainEqual(
      expect.stringContaining('Illness costs (22.1)'),
    );
  });

  it('gives the taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(3_498.2));
    expect(x.cantonalIncome.amount).toBe(chf(3_498.2));
    expect(x.communalIncome.amount).toBe(chf(2_693.6));
    expect(x.wealthBase.amount).toBe(0);
    expect(x.personal.amount).toBe(chf(40));
    expect(r.total).toBe(chf(6_231.8));
    expect(r.commune).toEqual({ bfs: null, name: 'LUGANO', rate: 7_700 });
  });
});

describe('a couple with two children in Bellinzona, 2026', () => {
  // Taxpayer: gross 110,000, box 9 7,040, box 10.1 8,800: net salary 94,160 (1.1). Professional costs
  // (9.1, decree 2026 art. 3, 4; LT art. 25 cpv. 2): public transport 1,200; lunch with a canteen,
  // 180 days x 7.50 = 1,350 (at most 1,600); other costs, the flat amount 3,500: 6,050.
  // Spouse: gross 45,000, box 9 2,880, box 10.1 1,800: net salary 40,320 (1.1). Bike 500, at most
  // 700: 500; other costs at a 50 % work rate (not under 50 %): 3,500; 9.2: 4,000.
  // Pillar 3a: 7,258 (11.1) and 3,000 (11.2).
  // Insurance (12): premiums 12,000, under the cap 10,900 + 2 x 1,200 = 13,300: 12,000.
  // Accounts (4.1): 120 + 2 (a child's) = 122. Debt interest 1,500, at most 122 + 50,000 (13.2).
  // Both spouses work (15.5): 8,100, the lower salary being 40,320 (in every reading).
  // 8 = 94,160 + 40,320 + 122 = 134,602; 16 = 6,050 + 4,000 + 7,258 + 3,000 + 12,000 + 1,500 + 8,100
  // = 41,908; 19 = 92,694. Childcare (20): 9,000 for the child under 14; 21 = 83,694; 23 = 83,694.
  // Children (25.1): 2 x 11,500 = 23,000; 26 = 60,694; 28 = 60,694.
  // Family tariff 2026 at 60,600, the top of a category: 2,203.85. Cantonal: 2,203.85.
  // Bellinzona 2026, 93 %: 2,049.5805: 2,049.60.
  // Wealth: 90,000 + 3,000 - debts 40,000 = 53,000, less 60,000 (35.1) and 2 x 30,000 (35.2): 0.
  // Personal tax: 2 x 40 = 80. Total: 2,203.85 + 2,049.60 + 80 = 4,333.45.
  const input: TiEngineInput = {
    taxYear: 2026,
    commune: 'BELLINZONA',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(110_000),
            socialContributions: amt(7_040),
            pensionFund: amt(8_800),
            canteen: true,
          },
        ],
        commuteCost: amt(1_200),
        mealDays: 180,
        pillar3a: amt(7_258),
        workRate: 100,
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(45_000), socialContributions: amt(2_880), pensionFund: amt(1_800) },
        ],
        commuteMode: { by: 'bike' },
        commuteCost: amt(500),
        pillar3a: amt(3_000),
        workRate: 50,
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(9_000) },
      { custody: 'full', under14: false, minor: true },
    ],
    household: { healthPremiums: amt(12_000), debtInterest: amt(1_500), debts: amt(40_000) },
    movable: [
      { owner: 'household', value: amt(90_000), income: amt(120) },
      { owner: 'child0', value: amt(3_000), income: amt(2) },
    ],
  };
  const r = computeReturn(input);

  it('gives the lines and subtotals of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '1.1', 'p1')).toBe(chf(94_160));
    expect(line(r, '1.1', 'p2')).toBe(chf(40_320));
    expect(line(r, '9.1', 'p1')).toBe(-chf(6_050));
    expect(line(r, '9.2', 'p2')).toBe(-chf(4_000));
    expect(line(r, '12')).toBe(-chf(12_000));
    expect(line(r, '13.2')).toBe(-chf(1_500));
    expect(line(r, '15.5')).toBe(-chf(8_100));
    expect(line(r, '20')).toBe(-chf(9_000));
    expect(line(r, '25.1')).toBe(-chf(23_000));
    expect(r.icc!.grossIncome.amount).toBe(chf(134_602));
    expect(r.icc!.netIncome.amount).toBe(chf(92_694));
    expect(r.icc!.taxableIncome.amount).toBe(chf(60_694));
    expect(r.icc!.incomeTariff).toBe('family');
    expect(line(r, '35.1')).toBe(-chf(60_000));
    expect(line(r, '35.2')).toBe(-chf(60_000));
    expect(r.icc!.wealth.netWealth.amount).toBe(chf(53_000));
    expect(r.icc!.wealth.taxableWealth.amount).toBe(0);
  });

  it('gives the taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(2_203.85));
    expect(x.communalIncome.amount).toBe(chf(2_049.6));
    expect(x.personal.amount).toBe(chf(80));
    expect(r.total).toBe(chf(4_333.45));
  });
});

describe('a single parent in Locarno, 2025', () => {
  // Divorced, the child lives with you (full custody): the family tariff (LT art. 35 cpv. 2).
  // Salary: gross 72,000, box 9 4,608, box 10.1 3,600: net 63,792 (1.1). Costs (9.1): public
  // transport 800 + the flat amount 3,000 (work rate 80 %) = 3,800. Pillar 3a: 2,000 (11.1).
  // Child support received (3.6): 9,600. Accounts (4.1): 5.
  // Insurance (12): premiums 6,500 less the subsidy 1,200 = 5,300, under 5,500 + 1,200 = 6,700.
  // 8 = 63,792 + 9,600 + 5 = 73,397; 16 = 3,800 + 2,000 + 5,300 = 11,100; 19 = 62,297.
  // Childcare (20): 6,000 (you work); 21 = 56,297; 23 = 56,297. Child (25.1): 11,500; 26 = 44,797;
  // 28 = 44,797.
  // Family tariff 2025 at 44,700: between 42,300 (839.60) and 47,800 (1,199.30):
  // 839.60 + 2,400 x 359.70 / 5,500 = 996.56: 996.55. Locarno 2025, 90 %: 896.895: 896.90.
  // Wealth 15,000 less 30,000 for the minor child: 0. Personal tax 40.
  // Total: 996.55 + 896.90 + 40 = 1,933.45.
  const input: TiEngineInput = {
    taxYear: 2025,
    commune: 'locarno',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(72_000), socialContributions: amt(4_608), pensionFund: amt(3_600) },
        ],
        commuteCost: amt(800),
        pillar3a: amt(2_000),
        workRate: 80,
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(6_000) }],
    household: {
      childSupportReceived: amt(9_600),
      healthPremiums: amt(6_500),
      healthSubsidy: amt(1_200),
    },
    movable: [{ owner: 'p1', value: amt(15_000), income: amt(5) }],
  };
  const r = computeReturn(input);

  it('gives the lines, the family tariff and the taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '1.1', 'p1')).toBe(chf(63_792));
    expect(line(r, '3.6', 'household')).toBe(chf(9_600));
    expect(line(r, '9.1', 'p1')).toBe(-chf(3_800));
    expect(line(r, '12')).toBe(-chf(5_300));
    expect(line(r, '20')).toBe(-chf(6_000));
    expect(line(r, '25.1')).toBe(-chf(11_500));
    expect(r.icc!.grossIncome.amount).toBe(chf(73_397));
    expect(r.icc!.taxableIncome.amount).toBe(chf(44_797));
    expect(r.icc!.incomeTariff).toBe('family');
    expect(r.icc!.taxes.incomeBase.amount).toBe(chf(996.55));
    expect(r.icc!.taxes.communalIncome.amount).toBe(chf(896.9));
    expect(r.icc!.wealth.taxableWealth.amount).toBe(0);
    expect(r.total).toBe(chf(1_933.45));
  });
});

describe('a retiree with wealth in Mendrisio, 2026', () => {
  // Widowed before 2026, no child: the tariff for single people. Pensions: pension fund 30,000
  // (3.1), AVS 26,000 (3.2). Accounts (4.1): 9,000.
  // Insurance (12): premiums 6,200, under 5,500 + 2,300 (no pension fund or pillar 3a contributions)
  // = 7,800: 6,200. Costs of keeping securities (13.1): 400.
  // 8 = 30,000 + 26,000 + 9,000 = 65,000; 16 = 6,600; 19 = 58,400; 21 = 58,400.
  // Illness costs (22.1): 4,000 less 5 % of 58,400 = 2,920: 1,080. 23 = 57,320; 26 = 57,320.
  // AVS exemption (27): the net income 57,320 is above 42,000 (single tariff): nothing.
  // 28 = 57,320. Tariff for single people 2026 at 57,300: 3,245.50 + 4,600 x 593.35 / 5,400 =
  // 3,750.946: 3,750.95. Mendrisio 2026, 77 %: 2,888.2315: 2,888.25.
  // Wealth: accounts 900,000 + cash 5,000 + life insurance 50,000 = 955,000 = taxable (no social
  // deduction for a single person). Tariff (LT art. 49): 1,410 at 700,000 + 255,000 x 3 per mille
  // = 2,175.00; Mendrisio 77 %: 1,674.75.
  // The taxes (10,488.95) are under 60 % of the taxable income (34,392): no wealth tax brake.
  // Personal tax 40. Total: 3,750.95 + 2,888.25 + 2,175.00 + 1,674.75 + 40 = 10,528.95.
  const input: TiEngineInput = {
    taxYear: 2026,
    commune: 'Mendrisio',
    civilStatus: 'widowed',
    changedThisYear: false,
    people: [{ id: 'p1', pensionAvs: amt(26_000), pensionOccupational: amt(30_000) }],
    household: {
      healthPremiums: amt(6_200),
      medicalCosts: amt(4_000),
      bankFees: amt(400),
      lifeInsuranceValue: amt(50_000),
      cash: amt(5_000),
    },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(9_000) }],
  };
  const r = computeReturn(input);

  it('gives the lines, the wealth and the taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '3.1', 'p1')).toBe(chf(30_000));
    expect(line(r, '3.2', 'p1')).toBe(chf(26_000));
    expect(line(r, '12')).toBe(-chf(6_200));
    expect(line(r, '13.1')).toBe(-chf(400));
    expect(line(r, '22.1')).toBe(-chf(1_080));
    expect(() => line(r, '27')).toThrow();
    expect(r.icc!.taxableIncome.amount).toBe(chf(57_320));
    expect(r.icc!.incomeTariff).toBe('single');
    expect(r.icc!.wealth.taxableWealth.amount).toBe(chf(955_000));
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(3_750.95));
    expect(x.communalIncome.amount).toBe(chf(2_888.25));
    expect(x.wealthBase.amount).toBe(chf(2_175));
    expect(x.communalWealth.amount).toBe(chf(1_674.75));
    expect(r.total).toBe(chf(10_528.95));
  });

  it('a lower income gives the AVS exemption by its band', () => {
    // Only the AVS pension 26,000 and premiums 6,200: 8 = 26,000, 19 = 19,800 = 26 (no other
    // deduction): up to 21,000, the full 8,000 (single tariff, Istruzioni p. 32). 28 = 11,800,
    // under 12,500: no income tax.
    const small = computeReturn({
      taxYear: 2026,
      commune: 'Mendrisio',
      civilStatus: 'widowed',
      changedThisYear: false,
      people: [{ id: 'p1', pensionAvs: amt(26_000) }],
      household: { healthPremiums: amt(6_200) },
    });
    expect(line(small, '27')).toBe(-chf(8_000));
    expect(small.icc!.taxableIncome.amount).toBe(chf(11_800));
    expect(small.icc!.taxes.incomeBase.amount).toBe(0);
    expect(small.total).toBe(chf(40));
  });
});

describe('a parent sharing custody without child support in Lugano, 2026', () => {
  // Divorced, a child under 14 in shared custody, no child support either way (childSupport
  // 'none'): the child deduction is half (LT art. 34 cpv. 1 lett. a): 5,750 (25.1). The child lives
  // with you and you provide for it: the family tariff (art. 35 cpv. 2), said in the result.
  // Salary: gross 90,000, box 9 5,760, box 10.1 6,300: net 77,940. Costs (9.1): public transport 900
  // + lunch 150 x 15 = 2,250 + the flat amount 3,500 = 6,650. Pillar 3a: 7,258.
  // Insurance (12): premiums 5,800, under 5,500 + 1,200 = 6,700 (the child counts in full here,
  // said in the result): 5,800. Accounts (4.1): 20.
  // 8 = 77,960; 16 = 6,650 + 7,258 + 5,800 = 19,708; 19 = 58,252. Childcare (20): 4,000, under half
  // the limit of 26,200; 21 = 54,252; 23 = 54,252. Donations (24): 2,000, at most 20 % of 54,252.
  // Child (25.1): 5,750. 26 = 46,502; 28 = 46,502.
  // Family tariff 2026 at 46,500: 839.60 + 4,200 x 359.70 / 5,500 = 1,114.28: 1,114.30.
  // Lugano 2026, 80 %: 891.44: 891.45.
  // Wealth 40,000: the deduction for the shared child (half or all of 30,000) is not settled, and
  // either way there is no wealth tax: left out, said in the result. Personal tax 40.
  // Total: 1,114.30 + 891.45 + 40 = 2,045.75.
  const input: TiEngineInput = {
    taxYear: 2026,
    commune: 'LUGANO',
    civilStatus: 'divorced',
    childSupport: 'none',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(6_300) },
        ],
        commuteCost: amt(900),
        mealDays: 150,
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(4_000) }],
    household: { healthPremiums: amt(5_800), donations: amt(2_000) },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(20) }],
  };
  const r = computeReturn(input);

  it('gives the lines, the family tariff and the taxes, and says what it assumed', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '9.1', 'p1')).toBe(-chf(6_650));
    expect(line(r, '12')).toBe(-chf(5_800));
    expect(line(r, '20')).toBe(-chf(4_000));
    expect(line(r, '24')).toBe(-chf(2_000));
    expect(line(r, '25.1')).toBe(-chf(5_750));
    expect(() => line(r, '35.2')).toThrow();
    expect(r.icc!.taxableIncome.amount).toBe(chf(46_502));
    expect(r.icc!.incomeTariff).toBe('family');
    expect(r.icc!.taxes.incomeBase.amount).toBe(chf(1_114.3));
    expect(r.icc!.taxes.communalIncome.amount).toBe(chf(891.45));
    expect(r.total).toBe(chf(2_045.75));
    const unverified = r.unverifiedRules.map((n) => n.en).join(' ');
    expect(unverified).toContain('family tariff');
    expect(unverified).toContain('CHF 1,200');
    expect(r.assumptions.map((n) => n.en).join(' ')).toContain('half and half');
  });
});
