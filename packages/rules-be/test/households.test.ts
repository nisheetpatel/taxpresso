// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The einfache Steuer of each
// taxable income is the one the canton's table prints (test/tariffs.test.ts gives the pages).
import { describe, expect, it } from 'vitest';
import { allLines, BeInputError, computeReturn, NOTE, type BeEngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: ReturnType<typeof computeReturn>, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);

describe('H1: single, Bern, 2026, employed, public transport, own household', () => {
  // Salary: 85,000 - 5,440 (box 9) - 5,100 (box 10.1) = 74,460 (2.21).
  // 6.1: public transport 900. 6.2: 200 days x 15 = 3,000 (under 3,200). 6.4: 3 % of 74,460 =
  // 2,233.80, 2,234 (between 2,000 and 4,000). 3a: 7,258 with a pension fund. 4.2: with pension
  // fund contributions the fixed 2,450 (paid 4,200). Account 30,000, interest 60.
  // Einkünfte 74,460 + 60 = 74,520; Aufwendungen 900 + 3,000 + 2,234 + 7,258 + 2,450 = 15,842;
  // Reineinkommen 58,678. Allgemeiner Abzug 5,300; alone in own household 2,400: taxable 50,978.
  // Modest income: 50,978 + 3,000 is far above 16,700. Wealth 30,000: under 100,000, no wealth tax.
  // Tariff Art. 42 Abs. 2 2026 at 50,900: 1,999.80. Canton 2.975: 5,949.405, 5,949.41. Bern 1.54:
  // 3,079.692, 3,079.69. Total 9,029.10.
  const input: BeEngineInput = {
    taxYear: 2026,
    commune: 351,
    civilStatus: 'single',
    ownHousehold: true,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(900),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_200) },
    movable: [{ owner: 'p1', value: amt(30_000), income: amt(60) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '2.21-haupt')).toBe(chf(74_460));
    expect(find(r, '6.1')).toBe(chf(-900));
    expect(find(r, '6.2')).toBe(chf(-3_000));
    expect(find(r, '6.4')).toBe(chf(-2_234));
    expect(find(r, 'saeule-3a')).toBe(chf(-7_258));
    expect(find(r, '4.2')).toBe(chf(-2_450));
    expect(find(r, 'alleinstehend')).toBe(chf(-2_400));
    expect(r.icc?.grossIncome.amount).toBe(chf(74_520));
    expect(r.icc?.totalDeductions.amount).toBe(chf(-15_842));
    expect(r.icc?.netIncome.amount).toBe(chf(58_678));
    expect(r.icc?.taxableIncome.amount).toBe(chf(50_978));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(30_000));
    expect(r.icc?.tariff).toBe('other');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(1_999.8));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(0);
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(5_949.41));
    expect(r.icc?.taxes.communal.amount).toBe(chf(3_079.69));
    expect(r.icc?.taxes.church).toBeNull();
    expect(r.total).toBe(chf(9_029.1));
    expect(r.commune).toEqual({ bfs: 351, name: 'Bern', rate: 15_400 });
    expect(r.ifd).toBeNull();
    expect(r.unsupported).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.notCounted).toContainEqual(NOTE.fireLevy);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.cantonal.sources.join(' ')).toContain(
      'be-2026-steueranlagen-gemeinden-de p. 7',
    );
  });
});

describe('H2: married, two earners, two children, Thun, 2025, Reformed church tax', () => {
  // Person 1: 110,000 - 7,040 - 7,700 = 95,260. Car, no usable public transport, 18 km, 220 days:
  // 18 x 2 x 220 x 0.70 = 5,544 (under 7,000). Canteen: 220 x 7.50 = 1,650, at most 1,600.
  // 3 % of 95,260 = 2,857.80, 2,858. 3a 7,258.
  // Person 2: 50,000 - 3,200 - 2,500 = 44,300. Public transport 1,100. 3 % = 1,329, at least
  // 2,000. 3a 3,000.
  // Debt interest 3,000 (under 1,500 + 50,000). Insurance: contributions, fixed 4,900 + 2 x 700 =
  // 6,300. Childcare 12,000 for the younger child (under 16,000). Two earners: 2 % of 95,260 +
  // 44,300 = 139,560 is 2,791.20, 2,791; the lower earned income after costs and 3a, 44,300 -
  // 3,100 - 3,000 = 38,200, is higher: 2,791.
  // Einkünfte 95,260 + 44,300 + 1,500 = 141,060. Aufwendungen 5,544 + 1,600 + 2,858 + 7,258 +
  // 1,100 + 2,000 + 3,000 + 3,000 + 6,300 + 12,000 + 2,791 = 47,451. Reineinkommen 93,609.
  // Donations 1,500 (under 20 %). Medical 9,000 less 5 % of 93,609 (4,680.45, 4,680) = 4,320.
  // Allgemeiner Abzug 2 x 5,300 = 10,600; children 2 x 8,300 = 16,600. Taxable 93,609 - 1,500 -
  // 4,320 - 10,600 - 16,600 = 60,589.
  // Wealth 150,000 - debts 90,000 - spouses 18,000 - children 2 x 18,000 = 6,000: no wealth tax.
  // Tariff Art. 42 Abs. 1 2025 at 60,500: 2,043.70. Canton 2.975: 6,080.0075, 6,080.01. Thun 1.66:
  // 3,392.542, 3,392.54. Reformed 0.207: 423.0459, 423.05. Total 9,895.60.
  const r = computeReturn({
    taxYear: 2025,
    commune: 942,
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(110_000),
            socialContributions: amt(7_040),
            pensionFund: amt(7_700),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 18, days: 220 },
        mealDays: 220,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(50_000), socialContributions: amt(3_200), pensionFund: amt(2_500) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_100),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', under14: false },
    ],
    household: {
      healthPremiums: amt(13_000),
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
    movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
  });

  it('lines of the return', () => {
    expect(find(r, '2.21-haupt', 'p1')).toBe(chf(95_260));
    expect(find(r, '2.21-haupt', 'p2')).toBe(chf(44_300));
    expect(find(r, '6.1', 'p1')).toBe(chf(-5_544));
    expect(find(r, '6.2', 'p1')).toBe(chf(-1_600));
    expect(find(r, '6.4', 'p1')).toBe(chf(-2_858));
    expect(find(r, '6.4', 'p2')).toBe(chf(-2_000));
    expect(find(r, '4.2')).toBe(chf(-6_300));
    expect(find(r, '4.3')).toBe(chf(-3_000));
    expect(find(r, '2.1-betreuung')).toBe(chf(-12_000));
    expect(find(r, 'zweiverdiener')).toBe(chf(-2_791));
    expect(r.icc?.netIncome.amount).toBe(chf(93_609));
    expect(find(r, '5.3')).toBe(chf(-1_500));
    expect(find(r, '5.4')).toBe(chf(-4_320));
    expect(find(r, 'allgemein')).toBe(chf(-10_600));
    expect(find(r, '2.1-kinder')).toBe(chf(-16_600));
    expect(r.icc?.taxableIncome.amount).toBe(chf(60_589));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(6_000));
    expect(r.icc?.tariff).toBe('married');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(2_043.7));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(6_080.01));
    expect(r.icc?.taxes.communal.amount).toBe(chf(3_392.54));
    expect(r.icc?.taxes.church?.amount).toBe(chf(423.05));
    expect(r.total).toBe(chf(9_895.6));
  });
});

describe('H3: widowed retiree, Biel/Bienne, 2026, securities, Roman Catholic church tax', () => {
  // AHV 28,000 and pension fund 24,000 (2.22). Securities 400,000, income 6,000 (3.0), costs 300.
  // No pension fund or 3a contributions: insurance what was paid, 7,200, at most 3,600.
  // Einkünfte 28,000 + 24,000 + 6,000 - 300 = 57,700; Reineinkommen 57,700 - 3,600 = 54,100.
  // Medical 3,000 less 5 % of 54,100 (2,705) = 295. Allgemeiner Abzug 5,300; alone 2,400.
  // Taxable 54,100 - 295 - 5,300 - 2,400 = 46,105. Modest income: far above.
  // Wealth 400,000: tariff Art. 65, 260.90. Tariff Art. 42 Abs. 2 2026 at 46,100: 1,786.20.
  // Simple tax 2,047.10. Maximum burden: wealth tax 260.90 x (2.975 + 1.63 + 0.23) = 1,261.45;
  // 25 % of the income from wealth (6,000 - 300 = 5,700) is 1,425: no cut.
  // Canton: 2,047.10 x 2.975 = 6,090.1225, 6,090.12. Biel/Bienne 1.63: 3,336.773, 3,336.77.
  // Roman Catholic 0.23: 470.833, 470.83. Total 9,897.72.
  const r = computeReturn({
    taxYear: 2026,
    commune: 371,
    civilStatus: 'widowed',
    ownHousehold: true,
    church: { p1: 'catholic' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(24_000) }],
    household: { healthPremiums: amt(7_200), medicalCosts: amt(3_000), bankFees: amt(300) },
    movable: [{ owner: 'p1', value: amt(400_000), income: amt(6_000) }],
  });

  it('lines and taxes', () => {
    expect(find(r, '2.22-ahv')).toBe(chf(28_000));
    expect(find(r, '2.22-bv')).toBe(chf(24_000));
    expect(find(r, '3.0-kosten')).toBe(chf(-300));
    expect(find(r, '4.2')).toBe(chf(-3_600));
    expect(find(r, '5.4')).toBe(chf(-295));
    expect(r.icc?.netIncome.amount).toBe(chf(54_100));
    expect(r.icc?.taxableIncome.amount).toBe(chf(46_105));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(400_000));
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(1_786.2));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(chf(260.9));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(6_090.12));
    expect(r.icc?.taxes.communal.amount).toBe(chf(3_336.77));
    expect(r.icc?.taxes.church?.amount).toBe(chf(470.83));
    expect(r.icc?.taxes.wealthCap).toBeNull();
    expect(r.total).toBe(chf(9_897.72));
    expect(r.assumptions).toContainEqual(NOTE.pensions100);
  });
});

describe('H4: married high earners with wealth, Muri, 2026, no church, maximum burden', () => {
  // Person 1: 300,000 - 19,200 - 24,000 = 256,800. Public transport (GA) 3,000. 3 % = 7,704, at
  // most 4,000. 3a 7,258. Buy-in paid directly 20,000.
  // Person 2: 60,000 - 3,840 - 3,600 = 52,560. Bike 700. 3 % = 1,576.80, at least 2,000. 3a 7,258.
  // Two earners: 2 % of 309,360 = 6,187.20, 6,187; the lower income after its costs and 3a
  // (52,560 - 2,700 - 7,258 = 42,602) is higher. Person 1's buy-in does not change it.
  // Insurance: fixed 4,900. Securities 3,000,000, income 15,000, costs 2,000. Donations 10,000.
  // Einkünfte 256,800 + 52,560 + 15,000 - 2,000 = 322,360. Aufwendungen 3,000 + 4,000 + 7,258 +
  // 20,000 + 700 + 2,000 + 7,258 + 4,900 + 6,187 = 55,303. Reineinkommen 267,057.
  // Donations 10,000 (under 20 %), Allgemeiner Abzug 10,600: taxable 246,457.
  // Wealth 3,000,000 - 18,000 = 2,982,000: tariff Art. 65, 3,432.60. Tariff Art. 42 Abs. 1 2026 at
  // 246,400: 12,021.20. Simple tax 15,453.80. Canton 2.975: 45,975.055, 45,975.06. Muri 1.14:
  // 17,617.332, 17,617.33.
  // Maximum burden: wealth tax 3,432.60 x (2.975 + 1.14) = 14,125.149, 14,125.15; 25 % of the
  // income from wealth (15,000 - 2,000 = 13,000) is 3,250; 2.4 per mille of 2,982,000 is 7,156.80,
  // the higher: cut 14,125.15 - 7,156.80 = 6,968.35. Total 45,975.06 + 17,617.33 - 6,968.35 =
  // 56,624.04.
  const input: BeEngineInput = {
    taxYear: 2026,
    commune: 356,
    civilStatus: 'married',
    church: { p1: 'none', p2: 'none' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(300_000), socialContributions: amt(19_200), pensionFund: amt(24_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(3_000),
        pillar3a: amt(7_258),
        pensionBuyIn: amt(20_000),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(3_600) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(12_000), donations: amt(10_000), bankFees: amt(2_000) },
    movable: [{ owner: 'household', value: amt(3_000_000), income: amt(15_000) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '6.4', 'p1')).toBe(chf(-4_000));
    expect(find(r, '6.1', 'p2')).toBe(chf(-700));
    expect(find(r, 'einkauf-bv', 'p1')).toBe(chf(-20_000));
    expect(find(r, 'zweiverdiener')).toBe(chf(-6_187));
    expect(r.icc?.totalDeductions.amount).toBe(chf(-55_303));
    expect(r.icc?.netIncome.amount).toBe(chf(267_057));
    expect(r.icc?.taxableIncome.amount).toBe(chf(246_457));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(2_982_000));
  });

  it('taxes, cut by the maximum burden', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(12_021.2));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(chf(3_432.6));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(45_975.06));
    expect(r.icc?.taxes.communal.amount).toBe(chf(17_617.33));
    expect(r.icc?.taxes.church).toBeNull();
    expect(r.icc?.taxes.wealthCap?.amount).toBe(chf(-6_968.35));
    expect(r.total).toBe(chf(56_624.04));
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.wealthCapRounding]);
  });

  it('the maximum burden counts the church tax: without an answer on it, not computed', () => {
    const u = computeReturn({ ...input, church: undefined });
    expect(u.icc).toBeNull();
    expect(u.unsupported).toEqual([NOTE.churchForCap]);
  });
});

describe('H5: divorced parent, shared custody, child support received, Köniz, 2026', () => {
  // Salary 70,000 - 4,480 - 4,200 = 61,320. Public transport 800; meals 180 x 15 = 2,700; 3 % =
  // 1,839.60, at least 2,000. 3a 7,258. Child support received 7,200 (2.24). Account 25,000,
  // interest 50.
  // The child, shared custody, support received: counted in full, lives here. Childcare 9,000
  // (under 16,000). Insurance: fixed 2,450 + 700 = 3,150.
  // Einkünfte 61,320 + 7,200 + 50 = 68,570. Aufwendungen 800 + 2,700 + 2,000 + 7,258 + 3,150 +
  // 9,000 = 24,908. Reineinkommen 43,662. Allgemeiner Abzug 5,300; alone with a child 2,400 +
  // 1,300 = 3,700; child 8,300: 26,362 before the modest-income deduction.
  // Wealth 25,000 - 18,000 (child) = 7,000. Modest income: 26,362 + 700 = 27,062; 1,100 + 600 =
  // 1,700 up to 16,700, then 150 less per full 2,000: (27,062 - 16,700) / 2,000 = 5 full steps,
  // 1,700 - 750 = 950. Taxable 25,412.
  // Tariff Art. 42 Abs. 1 (single parent) 2026 at 25,400: 713.40. Canton 2.975: 2,122.365,
  // 2,122.37. Köniz 1.58: 1,127.172, 1,127.17. Roman Catholic 0.19: 135.546, 135.55. Total
  // 3,385.09.
  const input: BeEngineInput = {
    taxYear: 2026,
    commune: 355,
    civilStatus: 'divorced',
    ownHousehold: true,
    childSupport: 'receives',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(70_000), socialContributions: amt(4_480), pensionFund: amt(4_200) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 180,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(9_000) }],
    household: { healthPremiums: amt(5_500), childSupportReceived: amt(7_200) },
    movable: [{ owner: 'p1', value: amt(25_000), income: amt(50) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '2.24')).toBe(chf(7_200));
    expect(find(r, '4.2')).toBe(chf(-3_150));
    expect(find(r, '2.1-betreuung')).toBe(chf(-9_000));
    expect(r.icc?.netIncome.amount).toBe(chf(43_662));
    expect(find(r, 'alleinstehend')).toBe(chf(-3_700));
    expect(find(r, '2.1-kinder')).toBe(chf(-8_300));
    expect(find(r, 'bescheiden')).toBe(chf(-950));
    expect(r.icc?.taxableIncome.amount).toBe(chf(25_412));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(7_000));
    expect(r.icc?.tariff).toBe('married');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(713.4));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(2_122.37));
    expect(r.icc?.taxes.communal.amount).toBe(chf(1_127.17));
    expect(r.icc?.taxes.church?.amount).toBe(chf(135.55));
    expect(r.total).toBe(chf(3_385.09));
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.modestSteps]);
  });

  it('without child support: half the child, and two answers the documents leave open', () => {
    const none: BeEngineInput = {
      ...input,
      childSupport: 'none',
      household: { healthPremiums: amt(5_500) },
    };
    const u = computeReturn(none);
    expect(u.icc).toBeNull();
    expect(u.unsupported).toEqual([NOTE.marriedTariff, NOTE.sharedChildWealth]);
    // Answered as the last assessment shows: the tariff Art. 42 Abs. 1, the wealth deduction half.
    // Insurance 2,450 + 350 = 2,800; childcare at most 8,000 (half of 16,000); child 4,150; alone
    // 2,400 + 1,300 (not halved, Art. 40 Abs. 8); wealth 25,000 - 9,000 = 16,000.
    const a = computeReturn({ ...none, marriedTariff: true, sharedChildWealth: 'half' });
    expect(find(a, '4.2')).toBe(chf(-2_800));
    expect(find(a, '2.1-betreuung')).toBe(chf(-8_000));
    expect(find(a, '2.1-kinder')).toBe(chf(-4_150));
    expect(find(a, 'alleinstehend')).toBe(chf(-3_700));
    expect(a.icc?.wealth.taxableWealth.amount).toBe(chf(16_000));
    expect(a.icc?.tariff).toBe('married');
  });
});

describe('fail closed', () => {
  const base: BeEngineInput = {
    taxYear: 2026,
    commune: 351,
    civilStatus: 'single',
    ownHousehold: false,
    people: [{ id: 'p1', employments: [{ gross: amt(60_000) }] }],
  };

  it('a year without official values, an unknown commune', () => {
    expect(() => computeReturn({ ...base, taxYear: 2027 as 2026 })).toThrow(/not supported/);
    expect(() => computeReturn({ ...base, commune: 261 })).toThrow(/Unknown Bern commune/);
  });

  it('questions only Bern asks', () => {
    expect(computeReturn({ ...base, ownHousehold: undefined }).unsupported).toEqual([
      NOTE.ownHousehold,
    ]);
  });

  it('church tax: a part of the commune, a conflict between the documents, mixed spouses', () => {
    // Jegenstorf 2026: its parts' Reformed rates differ, and Scheunen's is in conflict.
    const jeg = { ...base, commune: 540, church: { p1: 'reformed' as const } };
    expect(computeReturn(jeg).unsupported).toEqual([NOTE.part]);
    expect(
      computeReturn({ ...jeg, church: { p1: 'reformed', part: 'Scheunen' } }).unsupported,
    ).toEqual([NOTE.churchConflict]);
    expect(
      computeReturn({ ...jeg, church: { p1: 'reformed', part: 'Jegenstorf' } }).icc?.taxes.church
        ?.amount,
    ).toBeGreaterThan(0);
    // Jegenstorf's Roman Catholic rate is the same in both parts: no part needed.
    expect(computeReturn({ ...jeg, church: { p1: 'catholic' } }).unsupported).toEqual([]);
    // Münsingen 2025, Roman Catholic: 0.17 or 0.18 depending on the document.
    expect(
      computeReturn({ ...base, taxYear: 2025, commune: 616, church: { p1: 'catholic' } })
        .unsupported,
    ).toEqual([NOTE.churchConflict]);
    const couple: BeEngineInput = {
      ...base,
      civilStatus: 'married',
      people: [...base.people, { id: 'p2' }],
      church: { p1: 'reformed', p2: 'catholic' },
    };
    expect(computeReturn(couple).unsupported).toEqual([NOTE.churchMixed]);
  });

  it('a 3a catch-up in 2025; self-employment', () => {
    const p1 = { ...base.people[0]!, pillar3a: amt(7_258), pillar3aCatchUp: amt(2_000) };
    expect(computeReturn({ ...base, taxYear: 2025, people: [p1] }).unsupported).toEqual([
      NOTE.catchUp2025,
    ]);
    // In 2026 it is deducted on top of the yearly 3a.
    expect(find(computeReturn({ ...base, people: [p1] }), 'saeule-3a')).toBe(chf(-9_258));
    expect(
      computeReturn({ ...base, people: [{ id: 'p1', selfEmploymentProfit: amt(1_000) }] })
        .unsupported,
    ).toEqual([NOTE.selfEmployed]);
  });

  it('two earners: when the law and the canton’s page give different amounts, not computed', () => {
    // Person 2 earns less, and box 10.2 holds a buy-in of 18,000: net salary 3,000. The law subtracts
    // the buy-in from the lower income (3,000 - 2,000 flat = 1,000); the canton's page does not
    // ("ohne Einkauf": 19,000). 2 % of 140,000 + 3,000 = 2,860: 1,000 or 2,860.
    const r = computeReturn({
      ...base,
      civilStatus: 'married',
      people: [
        { id: 'p1', employments: [{ gross: amt(140_000) }] },
        { id: 'p2', employments: [{ gross: amt(21_000), pensionBuyIn: amt(18_000) }] },
      ],
    });
    expect(r.unsupported).toEqual([NOTE.twoEarnerBuyIn]);
  });

  it('political parties over CHF 5,300 for a couple need the amounts per person', () => {
    const couple: BeEngineInput = {
      ...base,
      civilStatus: 'married',
      people: [...base.people, { id: 'p2' }],
    };
    expect(
      computeReturn({ ...couple, household: { politicalParty: amt(6_000) } }).unsupported,
    ).toEqual([NOTE.partySplit]);
    const split = computeReturn({
      ...couple,
      people: [
        { ...base.people[0]!, politicalParty: amt(5_000) },
        { id: 'p2', politicalParty: amt(1_000) },
      ],
    });
    expect(find(split, '4.4')).toBe(chf(-6_000));
  });

  it('a side job needs a main job (Wegleitung 2025, Seite 28)', () => {
    const side = { id: 'p1' as const, employments: [{ gross: amt(5_000), side: true }] };
    expect(() => computeReturn({ ...base, people: [side] })).toThrow(BeInputError);
  });
});

describe('professional costs at most the net salary (Wegleitung 2025, Seite 175)', () => {
  it('a small salary: the 2,000 minimum of the other costs is cut to the salary', () => {
    // Net salary 1,500; public transport 300; the other costs' minimum 2,000: 300 + 2,000 is more
    // than 1,500, so the other costs are cut to 1,200.
    const r = computeReturn({
      taxYear: 2026,
      commune: 351,
      civilStatus: 'single',
      ownHousehold: false,
      people: [{ id: 'p1', employments: [{ gross: amt(1_500) }], commuteCost: amt(300) }],
    });
    expect(find(r, '6.1')).toBe(chf(-300));
    expect(find(r, '6.4')).toBe(chf(-1_200));
    expect(r.assumptions).toContainEqual(NOTE.costCap);
  });
});
