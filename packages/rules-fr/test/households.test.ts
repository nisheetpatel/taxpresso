// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The base tax of each
// income is the one the SCC's detailed tariff prints (test/tariffs.test.ts gives pages); the
// cantonal, communal and church taxes are rounded to the nearest 5 centimes (NOTE.rounding).
// Communal coefficients 2025: fr-2025-communal-coefficients-opendata; parishes:
// fr-2025-parish-coefficients-catholic and -reformed.
import { describe, expect, it } from 'vitest';
import { allLines, computeReturn, FrInputError, NOTE, type FrEngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: ReturnType<typeof computeReturn>, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: ReturnType<typeof computeReturn>, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, Fribourg, 2025, employed, public transport, Catholic church tax', () => {
  // 1.110: 80,000 - 5,120 (box 9) - 4,880 (box 10.1) = 70,000.
  // 2.110: the public transport paid, 1,000 (under the 12,000 cap). 2.120: 200 days x 15 = 3,000
  // (under 3,200). 2.130: 3 % of 70,000 = 2,100 (between 2,000 and 4,000). 3.210: 200.
  // 4.110: flat 4,810. 4.120: life insurance 1,000, at most 750. 4.130: 7,258 with a pension fund.
  // 4.150: savings interest 200, at most 150 (and at most the 200 of income).
  // Total income 70,200; deductions 1,000 + 3,000 + 2,100 + 4,810 + 750 + 7,258 + 150 = 19,068;
  // 4.910: 51,132. 5.120: donations 500 (at most 20 %, 10,226). 6.910: 50,632.
  // 7.110: 50,632 is above 40,300: nothing. 7.910: 50,600.
  // Rate at 50,600: 8.0352 % + 23 x 0.0069 = 8.1939 %; 50,600 x 8.1939 % = 4,146.1134, 4,146.10.
  // Cantonal 96 %: 3,980.256, 3,980.25. Fribourg 80 %: 3,316.88, 3,316.90. Wealth 40,000, less the
  // single person's deduction (55,000, at most the net wealth): 0. Church, the Fribourg Catholic
  // parishes (all 6 % on income, 18 % on wealth): 248.766, 248.75. Total 7,545.90.
  const input: FrEngineInput = {
    taxYear: 2025,
    commune: 'Fribourg',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_880) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_000),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: {
      lifeInsurancePremiums: amt(1_000),
      savingsInterest: amt(200),
      donations: amt(500),
    },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(200) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '1.110')).toBe(chf(70_000));
    expect(find(r, '2.110')).toBe(chf(-1_000));
    expect(find(r, '2.120')).toBe(chf(-3_000));
    expect(find(r, '2.130')).toBe(chf(-2_100));
    expect(find(r, '3.210')).toBe(chf(200));
    expect(find(r, '4.110')).toBe(chf(-4_810));
    expect(find(r, '4.120')).toBe(chf(-750));
    expect(find(r, '4.130')).toBe(chf(-7_258));
    expect(find(r, '4.150')).toBe(chf(-150));
    expect(find(r, '5.120')).toBe(chf(-500));
    expect(find(r, '7.110')).toBe(0);
    expect(r.icc?.grossIncome.amount).toBe(chf(70_200));
    expect(r.icc?.netIncome.amount).toBe(chf(51_132));
    expect(r.icc?.socialIncome.amount).toBe(chf(50_632));
    expect(r.icc?.taxableIncome.amount).toBe(chf(50_600));
    expect(r.icc?.family).toBe(false);
    expect(r.icc?.rate).toBe(81_939);
    expect(wealth(r, '7.110')).toBe(chf(-40_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(4_146.1));
    expect(x.cantonalIncome.amount).toBe(chf(3_980.25));
    expect(x.communalIncome.amount).toBe(chf(3_316.9));
    expect(x.wealthBase.amount).toBe(0);
    expect(x.churchIncome?.amount).toBe(chf(248.75));
    expect(x.churchWealth?.amount).toBe(0);
    expect(r.total).toBe(chf(7_545.9));
    expect(r.commune).toEqual({ bfs: 2196, name: 'Fribourg', rate: 8_000 });
    expect(r.ifd).toBeNull();
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.notCounted).toContainEqual(NOTE.dependents);
    expect(r.assumptions).toContainEqual(NOTE.healthFlat);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.cantonalIncome.sources.join(' ')).toContain(
      'fr-2025-law-coefficient-annuel art. 1 al. 1 and 2 (p. 1)',
    );
    expect(r.icc?.taxes.incomeBase.sources.join(' ')).toContain(
      'fr-2025-bareme-revenu p. 1 to 106',
    );
    expect(r.icc?.taxes.churchIncome?.sources.join(' ')).toContain(
      'fr-2025-parish-coefficients-catholic',
    );
  });

  it('the same household by its commune number, and without the church tax', () => {
    expect(computeReturn({ ...input, commune: 2196 }).total).toBe(chf(7_545.9));
    const noChurch = { ...input };
    delete noChurch.church;
    const n = computeReturn(noChurch);
    expect(n.total).toBe(chf(7_545.9 - 248.75));
    expect(n.icc?.taxes.churchIncome).toBeNull();
    expect(n.notCounted).toContainEqual(NOTE.churchNotAsked);
  });
});

describe('H2: married, two earners, two children, Bulle, 2025', () => {
  // Person 1: 110,000 - 7,040 - 7,700 = 95,260. Car, no usable public transport, 18 km, 220 days:
  // 7,920 km x 0.70 = 5,544. Canteen: 220 days x 7.50 = 1,650, at most 1,600. 3 % of 95,260 =
  // 2,857.80, 2,858. 3a 7,258.
  // Person 2: 50,000 - 3,200 - 2,500 = 44,300; public transport 1,200; 3 % = 1,329, at least
  // 2,000; 3a 3,000. Side job 6,000 (1.120), 20 % = 1,200 (2.140).
  // 2.510: the lower income after its costs, 50,300 - 4,400 = 45,900: 500.
  // 4.110: 2 x 4,810 + 2 x 1,140 = 11,900. 3.210: 1,500 + a child's 10 = 1,510. 4.150: 1,200 of
  // savings interest, at most 300. 4.210: 3,000 (under 1,510 + 50,000). 4.380: 9,000 for the
  // younger child (at most 12,000; the elder is 15).
  // Total income 95,260 + 44,300 + 6,000 + 1,510 = 147,070. Deductions 6,744 + 1,600 + 4,858 +
  // 1,200 + 500 + 11,900 + 10,258 + 300 + 3,000 + 9,000 = 49,360. 4.910: 97,710.
  // 5.110: 9,000 - 5 % of 97,710 (4,886) = 4,114. 5.120: 1,500.
  // 6.110: two children, 97,710 is above 72,800 by 24,910: 25 started steps, so each 8,600 - 2,500,
  // at least 7,100: 14,200. 6.910: 77,896. 7.110: above 49,300, nothing. 7.910: 77,800.
  // The rate of 38,900: 6.2139 % + 75 x 0.0108 = 7.0239 %; 77,800 x 7.0239 % = 5,464.5942,
  // 5,464.60. Cantonal 96 %: 5,246.016, 5,246.00. Bulle 74.3 %: 4,060.1978, 4,060.20.
  // Wealth 154,000 - 90,000 = 64,000, less the family deduction (105,000, at most 64,000): 0.
  // Total 9,306.20.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Bulle',
    civilStatus: 'married',
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
          { gross: amt(6_000), side: true },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(9_000) },
      { custody: 'full', under14: false },
    ],
    household: {
      savingsInterest: amt(1_200),
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_500) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '1.110', 'p1')).toBe(chf(95_260));
    expect(find(r, '1.110', 'p2')).toBe(chf(44_300));
    expect(find(r, '1.120', 'p2')).toBe(chf(6_000));
    expect(find(r, '2.110', 'p1')).toBe(chf(-5_544));
    expect(find(r, '2.110', 'p2')).toBe(chf(-1_200));
    expect(find(r, '2.120', 'p1')).toBe(chf(-1_600));
    expect(find(r, '2.130', 'p1')).toBe(chf(-2_858));
    expect(find(r, '2.130', 'p2')).toBe(chf(-2_000));
    expect(find(r, '2.140', 'p2')).toBe(chf(-1_200));
    expect(find(r, '2.510')).toBe(chf(-500));
    expect(find(r, '3.210')).toBe(chf(1_510));
    expect(find(r, '4.110')).toBe(chf(-11_900));
    expect(find(r, '4.130')).toBe(chf(-10_258));
    expect(find(r, '4.150')).toBe(chf(-300));
    expect(find(r, '4.210')).toBe(chf(-3_000));
    expect(find(r, '4.380')).toBe(chf(-9_000));
    expect(r.icc?.grossIncome.amount).toBe(chf(147_070));
    expect(r.icc?.netIncome.amount).toBe(chf(97_710));
    expect(find(r, '5.110')).toBe(chf(-4_114));
    expect(find(r, '5.120')).toBe(chf(-1_500));
    expect(find(r, '6.110')).toBe(chf(-14_200));
    expect(r.icc?.socialIncome.amount).toBe(chf(77_896));
    expect(find(r, '7.110')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(77_800));
    expect(r.icc?.family).toBe(true);
    expect(r.icc?.rateIncome.amount).toBe(chf(38_900));
    expect(r.icc?.rate).toBe(70_239);
    expect(r.icc?.wealth.netWealth.amount).toBe(chf(64_000));
    expect(wealth(r, '7.110')).toBe(chf(-64_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(5_464.6));
    expect(x.cantonalIncome.amount).toBe(chf(5_246));
    expect(x.communalIncome.amount).toBe(chf(4_060.2));
    expect(x.wealthBase.amount).toBe(0);
    expect(x.churchIncome).toBeNull();
    expect(r.total).toBe(chf(9_306.2));
    expect(r.commune).toEqual({ bfs: 2125, name: 'Bulle', rate: 7_430 });
  });
});

describe('H3: single parent, Murten, 2025, child support received, Catholic church tax', () => {
  // 1.110: 72,000 - 4,608 - 3,600 = 63,792. 2.110: a bike, 700 a year. 2.130: 3 % = 1,914, at
  // least 2,000. 4.130: 5,000. 3.150: child support received, 9,600 (taxed). 3.210: 30.
  // 4.110: 4,810 + 1,140 = 5,950, less the premium subsidy 1,200: 4,750. 4.150: 30 (at most the
  // income). 4.380: 7,000 (at most 12,000; under 14, lives with the parent, who works).
  // Total income 63,792 + 9,600 + 30 = 73,422. Deductions 700 + 2,000 + 4,750 + 5,000 + 30 + 7,000
  // = 19,480. 4.910: 53,942. 6.110: one child, 53,942 is at most 62,700: 8,600. 6.910: 45,342.
  // 7.110, with charges: 45,342 is above 24,300 by 21,042, 22 started steps of 200: 5,100 - 4,400 =
  // 700. 7.910: 44,642, 44,600.
  // Single parent living with the child: the rate of 22,300, 4.1745 % + 48 x 0.0147 = 4.8801 %;
  // 44,600 x 4.8801 % = 2,176.5246, 2,176.50. Cantonal 96 %: 2,089.44, 2,089.45. Murten 62 %:
  // 1,349.43, 1,349.45. Wealth 20,000, less the family deduction (at most 20,000): 0.
  // Church, Murten's one Catholic parish (8 %): 174.12, 174.10. Total 3,613.00.
  const input: FrEngineInput = {
    taxYear: 2025,
    commune: 'murten',
    civilStatus: 'divorced',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(72_000), socialContributions: amt(4_608), pensionFund: amt(3_600) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(7_000) }],
    household: {
      healthSubsidy: amt(1_200),
      childSupportReceived: amt(9_600),
      savingsInterest: amt(30),
    },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(30) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '1.110')).toBe(chf(63_792));
    expect(find(r, '2.110')).toBe(chf(-700));
    expect(find(r, '2.130')).toBe(chf(-2_000));
    expect(find(r, '3.150')).toBe(chf(9_600));
    expect(find(r, '4.110')).toBe(chf(-4_750));
    expect(find(r, '4.150')).toBe(chf(-30));
    expect(find(r, '4.380')).toBe(chf(-7_000));
    expect(r.icc?.netIncome.amount).toBe(chf(53_942));
    expect(find(r, '6.110')).toBe(chf(-8_600));
    expect(find(r, '7.110')).toBe(chf(-700));
    expect(r.icc?.taxableIncome.amount).toBe(chf(44_600));
    expect(r.icc?.family).toBe(true);
    expect(r.icc?.rate).toBe(48_801);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(2_176.5));
    expect(x.cantonalIncome.amount).toBe(chf(2_089.45));
    expect(x.communalIncome.amount).toBe(chf(1_349.45));
    expect(x.churchIncome?.amount).toBe(chf(174.1));
    expect(r.total).toBe(chf(3_613));
    expect(r.commune).toEqual({ bfs: 2275, name: 'Murten', rate: 6_200 });
    expect(r.assumptions).toContainEqual(NOTE.childrenAtCharge);
  });

  it('the Reformed church tax needs the parish: Murten has three, with different coefficients', () => {
    const reformed = computeReturn({ ...input, church: { p1: 'reformed' } });
    expect(reformed.icc).toBeNull();
    expect(reformed.unsupported).toEqual([NOTE.parish]);
    // Meyriez 10 %: 2,176.50 x 10 % = 217.65.
    const meyriez = computeReturn({ ...input, church: { p1: 'reformed', parish: 'Meyriez' } });
    expect(meyriez.icc?.taxes.churchIncome?.amount).toBe(chf(217.65));
  });
});

describe('H4: retiree with wealth, Villars-sur-Glâne, 2025, Reformed church tax', () => {
  // 3.110: AVS 28,000. 3.120: pension fund 36,000. 3.210: 18,000. Total income 82,000.
  // 4.110: 4,810. 4.150: 2,000 of savings interest, at most 150. 4.320: securities costs 1,200.
  // 4.910: 82,000 - 6,160 = 75,840. 5.110: 6,000 - 5 % of 75,840 (3,792) = 2,208.
  // 5.120: 2,500 (at most 15,168). 6.910: 71,132. 7.110, AVS/AI beneficiary alone: above 54,300,
  // nothing. 7.910: 71,100.
  // Rate at 71,100: 9.1042 % + 73 x 0.0064 = 9.5714 %; 71,100 x 9.5714 % = 6,805.2654, 6,805.25.
  // Cantonal 96 %: 6,533.04, 6,533.05. Villars-sur-Glâne 63.9 %: 4,348.55475, 4,348.55.
  // Wealth: 1,350,000 + 5,000 + 15,000 + 60,000 = 1,430,000; the single person's deduction ends at
  // 200,000: 0. Base: 3,480 at 1,200,000 + 230 x 2.90 = 4,147.00. Cantonal 100 %: 4,147.00.
  // Communal 63.9 %: 2,649.933, 2,649.95.
  // Church, the Reformed parish of Fribourg (9 % on income, 10 % on wealth): 612.4725, 612.45;
  // 414.70. Total 6,533.05 + 4,348.55 + 4,147.00 + 2,649.95 + 612.45 + 414.70 = 18,705.70.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Villars-sur-Glâne',
    civilStatus: 'widowed',
    church: { p1: 'reformed' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(36_000) }],
    household: {
      savingsInterest: amt(2_000),
      bankFees: amt(1_200),
      medicalCosts: amt(6_000),
      donations: amt(2_500),
      cash: amt(5_000),
      vehicles: amt(15_000),
      lifeInsuranceValue: amt(60_000),
    },
    movable: [{ owner: 'p1', value: amt(1_350_000), income: amt(18_000) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '3.110')).toBe(chf(28_000));
    expect(find(r, '3.120')).toBe(chf(36_000));
    expect(find(r, '3.210')).toBe(chf(18_000));
    expect(find(r, '4.110')).toBe(chf(-4_810));
    expect(find(r, '4.150')).toBe(chf(-150));
    expect(find(r, '4.320')).toBe(chf(-1_200));
    expect(r.icc?.netIncome.amount).toBe(chf(75_840));
    expect(find(r, '5.110')).toBe(chf(-2_208));
    expect(find(r, '5.120')).toBe(chf(-2_500));
    expect(find(r, '7.110')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(71_100));
    expect(r.icc?.rate).toBe(95_714);
    expect(wealth(r, '3.210')).toBe(chf(1_350_000));
    expect(wealth(r, '3.230')).toBe(chf(5_000));
    expect(wealth(r, '3.510')).toBe(chf(15_000));
    expect(wealth(r, '3.520')).toBe(chf(60_000));
    expect(wealth(r, '7.110')).toBe(0);
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(1_430_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(6_805.25));
    expect(x.cantonalIncome.amount).toBe(chf(6_533.05));
    expect(x.communalIncome.amount).toBe(chf(4_348.55));
    expect(x.wealthBase.amount).toBe(chf(4_147));
    expect(x.cantonalWealth.amount).toBe(chf(4_147));
    expect(x.communalWealth.amount).toBe(chf(2_649.95));
    expect(x.churchIncome?.amount).toBe(chf(612.45));
    expect(x.churchWealth?.amount).toBe(chf(414.7));
    expect(r.total).toBe(chf(18_705.7));
    expect(r.assumptions).toContainEqual(NOTE.pensions);
  });
});

describe('H5: alternating custody, Düdingen, 2025', () => {
  // A divorced parent paying child support for a child in alternating custody: the child counts for
  // the parent who receives it (fr-2024-pis-guide p. 7, question 18), the support is deducted.
  // 1.110: 95,000 - 6,080 - 5,700 = 83,220. 2.110: public transport 1,500. 2.120: 180 x 15 =
  // 2,700. 2.130: 3 % of 83,220 = 2,496.60, 2,497. 4.130: 7,258. 3.210: 50. 4.110: 4,810.
  // 4.340: child support paid, 12,000.
  // Total income 83,270; deductions 1,500 + 2,700 + 2,497 + 4,810 + 7,258 + 12,000 = 30,765.
  // 4.910 = 6.910: 52,505. 7.110: above 40,300, nothing. 7.910: 52,500.
  // Rate 8.0352 % + 42 x 0.0069 = 8.3250 %: 52,500 x 8.3250 % = 4,370.625, an exact half the
  // detailed tariff prints as 4,370.60 (p. 13). Cantonal 96 %: 4,195.776, 4,195.80. Düdingen 82 %:
  // 3,583.892, 3,583.90. Wealth 25,000, less the deduction: 0. Total 7,779.70.
  const pays: FrEngineInput = {
    taxYear: 2025,
    commune: 'Düdingen',
    civilStatus: 'divorced',
    childSupport: 'pays',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_700) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_500),
        mealDays: 180,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared' }],
    household: { childSupportPaid: amt(12_000) },
    movable: [{ owner: 'p1', value: amt(25_000), income: amt(50) }],
  };

  it('the parent who pays child support: no child, the support deducted', () => {
    const r = computeReturn(pays);
    expect(r.unsupported).toEqual([]);
    expect(find(r, '2.130')).toBe(chf(-2_497));
    expect(find(r, '4.110')).toBe(chf(-4_810));
    expect(find(r, '4.340')).toBe(chf(-12_000));
    expect(find(r, '6.110')).toBe(0);
    expect(r.icc?.netIncome.amount).toBe(chf(52_505));
    expect(r.icc?.taxableIncome.amount).toBe(chf(52_500));
    expect(r.icc?.family).toBe(false);
    expect(r.icc?.taxes.incomeBase.amount).toBe(chf(4_370.6));
    expect(r.icc?.taxes.cantonalIncome.amount).toBe(chf(4_195.8));
    expect(r.icc?.taxes.communalIncome.amount).toBe(chf(3_583.9));
    expect(r.total).toBe(chf(7_779.7));
    expect(r.assumptions).toContainEqual(NOTE.childSupportPaid);
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.sharedCustody]);
    expect(r.icc?.items.find((i) => i.code === '4.110')?.sources.join(' ')).toContain(
      'fr-2024-pis-guide p. 7',
    );
  });

  it('the parent who receives it: the child counts in full, the reduced rate', () => {
    // 3.150: 12,000 received instead of paid. Total income 95,270. 4.110: 4,810 + 1,140 = 5,950.
    // Deductions 1,500 + 2,700 + 2,497 + 5,950 + 7,258 = 19,905. 4.910: 75,365.
    // 6.110: 75,365 is above 62,700 by 12,665, 13 started steps: 8,600 - 1,300 = 7,300.
    // 6.910: 68,065. 7.110: above 49,300, nothing. 7.910: 68,000.
    // The rate of 34,000: 6.2139 % + 26 x 0.0108 = 6.4947 %; 68,000 x 6.4947 % = 4,416.396,
    // 4,416.40. Cantonal 96 %: 4,239.744, 4,239.75. Düdingen 82 %: 3,621.448, 3,621.45.
    // Total 7,861.20.
    const r = computeReturn({
      ...pays,
      childSupport: 'receives',
      household: { childSupportReceived: amt(12_000) },
    });
    expect(r.unsupported).toEqual([]);
    expect(find(r, '3.150')).toBe(chf(12_000));
    expect(find(r, '4.110')).toBe(chf(-5_950));
    expect(r.icc?.netIncome.amount).toBe(chf(75_365));
    expect(find(r, '6.110')).toBe(chf(-7_300));
    expect(r.icc?.taxableIncome.amount).toBe(chf(68_000));
    expect(r.icc?.family).toBe(true);
    expect(r.icc?.taxes.incomeBase.amount).toBe(chf(4_416.4));
    expect(r.total).toBe(chf(7_861.2));
  });

  it('without child support, or without the answer, the tax is not computed', () => {
    const none = computeReturn({ ...pays, childSupport: 'none', household: {} });
    expect(none.icc).toBeNull();
    expect(none.total).toBeNull();
    expect(none.unsupported).toEqual([NOTE.sharedNoSupport]);
    const unanswered = { ...pays };
    delete unanswered.childSupport;
    expect(computeReturn(unanswered).unsupported).toEqual([NOTE.childSupport]);
  });
});

describe('tax year 2026', () => {
  it('is not computed: no communal coefficients for 2026 in the documents', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 'Bulle',
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: amt(60_000) }] }],
    });
    expect(r.icc).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toEqual([NOTE.communes2026]);
    expect(r.commune).toEqual({ bfs: 2125, name: 'Bulle', rate: null });
  });

  it('knows the communes of 2026: Fétigny-Ménières, not Fétigny', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 'Fétigny-Ménières',
      civilStatus: 'single',
      people: [{ id: 'p1' }],
    });
    expect(r.commune.bfs).toBe(2056);
    expect(() =>
      computeReturn({
        taxYear: 2026,
        commune: 'Fétigny',
        civilStatus: 'single',
        people: [{ id: 'p1' }],
      }),
    ).toThrow(FrInputError);
  });
});

describe('fails closed', () => {
  const base: FrEngineInput = {
    taxYear: 2025,
    commune: 'Bulle',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [{ gross: amt(60_000) }] }],
  };
  it('self-employment, a 3a catch-up in 2025, an adult child, a married couple with a shared child', () => {
    expect(
      computeReturn({ ...base, people: [{ id: 'p1', selfEmploymentProfit: amt(1) }] }).unsupported,
    ).toEqual([NOTE.selfEmployed]);
    expect(
      computeReturn({
        ...base,
        people: [{ id: 'p1', employments: [{ gross: amt(60_000) }], pillar3aCatchUp: amt(1_000) }],
      }).unsupported,
    ).toEqual([NOTE.catchUp2025]);
    expect(
      computeReturn({ ...base, children: [{ custody: 'full', age: 'adult' }] }).unsupported,
    ).toEqual([NOTE.adultChild]);
    expect(
      computeReturn({
        ...base,
        civilStatus: 'married',
        people: [{ id: 'p1' }, { id: 'p2' }],
        children: [{ custody: 'shared' }],
      }).unsupported,
    ).toEqual([NOTE.marriedShared]);
  });

  it('spouses of different churches; a salary under the flat minimum; one spouse on AVS', () => {
    const couple: FrEngineInput = {
      ...base,
      civilStatus: 'married',
      people: [{ id: 'p1', pensionAvs: amt(20_000) }, { id: 'p2' }],
    };
    expect(
      computeReturn({ ...couple, church: { p1: 'catholic', p2: 'reformed' } }).unsupported,
    ).toEqual([NOTE.churchMixed]);
    expect(
      computeReturn({ ...base, people: [{ id: 'p1', employments: [{ gross: amt(1_500) }] }] })
        .unsupported,
    ).toEqual([NOTE.lowSalary]);
    // 6.910 of 20,000 - 9,620 = 10,380: 11,100 for AVS/AI beneficiaries, 5,100 for others.
    expect(computeReturn(couple).unsupported).toEqual([NOTE.avsCouple]);
    // With an income where both give nothing, the question does not matter.
    const rich = computeReturn({
      ...couple,
      people: [
        { id: 'p1', pensionAvs: amt(30_000), pensionOccupational: amt(80_000) },
        { id: 'p2' },
      ],
    });
    expect(rich.unsupported).toEqual([]);
  });

  it('input errors and other years', () => {
    expect(() => computeReturn({ ...base, commune: 'Lausanne' })).toThrow(FrInputError);
    expect(() => computeReturn({ ...base, people: [{ id: 'p2' }] })).toThrow(FrInputError);
    expect(() => computeReturn({ ...base, people: [{ id: 'p1' }, { id: 'p2' }] })).toThrow(
      FrInputError,
    );
    expect(() => computeReturn({ ...base, taxYear: 2024 as 2025 })).toThrow(/not supported/);
  });
});
