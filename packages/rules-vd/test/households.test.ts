// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The base tax of each
// income is the one the canton's detailed table prints (test/tariffs.test.ts gives the pages); the
// rate and the 5-centime rounding follow the guide's worked examples (vd-2025-guide p. 61).
import { describe, expect, it } from 'vitest';
import { allLines, computeReturn, NOTE, VdInputError, type VdEngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: ReturnType<typeof computeReturn>, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: ReturnType<typeof computeReturn>, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, Lausanne, 2025, employed, public transport', () => {
  // 100: 85,000 - 5,440 (box 9) - 5,100 (box 10.1) = 74,460.
  // 140: public transport, 12 km one way: 2,531 (guide p. 19). 150: 220 days of 240 at 3,200 a
  // year = 2,933.33, 2,933. 160: 3 % of 74,460 = 2,233.80, 2,234. 310: 7,258 with a pension fund.
  // 300: premiums 4,800, under 5,000. 410: interest 60, all savings: 480: 60 (under 1,600).
  // Total income 74,460 + 60 = 74,520; deductions 2,531 + 2,933 + 2,234 + 7,258 + 4,800 + 60 =
  // 19,816; 650: 54,704.
  // 660: rent 18,000, counted up to 11,100, less 20 % of 54,704 (10,940.80, 10,941): 159.
  // 690: 54,545. 695: above 17,000 by 37,545, half 18,772.50, in hundreds 18,800: nothing.
  // 700 = 730 = 54,545; 800: 54,500. One part.
  // Base tax at 54,500: 2,550 + 140 x 9.00 = 3,810.00. LRIPP 4 %: 152.40, 3,657.60. Cantonal
  // 155 %: 5,669.28, 5,669.30. Communal 78.5 %: 2,990.85. Wealth 30,000: under 60,000, none.
  // Total 8,660.15.
  const input: VdEngineInput = {
    taxYear: 2025,
    commune: 'Lausanne',
    civilStatus: 'single',
    rent: amt(18_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport', kmOneWay: 12 },
        mealDays: 220,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800), savingsInterest: amt(60) },
    movable: [{ owner: 'p1', value: amt(30_000), income: amt(60) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100')).toBe(chf(74_460));
    expect(find(r, '140')).toBe(chf(-2_531));
    expect(find(r, '150')).toBe(chf(-2_933));
    expect(find(r, '160')).toBe(chf(-2_234));
    expect(find(r, '310')).toBe(chf(-7_258));
    expect(find(r, '300')).toBe(chf(-4_800));
    expect(find(r, '410')).toBe(chf(60));
    expect(find(r, '480')).toBe(chf(-60));
    expect(find(r, '660')).toBe(chf(-159));
    expect(find(r, '695')).toBe(0);
    expect(r.icc?.grossIncome.amount).toBe(chf(74_520));
    expect(r.icc?.netIncome.amount).toBe(chf(54_704));
    expect(r.icc?.incomeBeforeModest.amount).toBe(chf(54_545));
    expect(r.icc?.intermediateIncome.amount).toBe(chf(54_545));
    expect(r.icc?.taxableIncome.amount).toBe(chf(54_500));
    expect(r.icc?.parts).toBe(100);
    expect(r.icc?.rateIncome.amount).toBe(chf(54_500));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(30_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(3_810));
    expect(x.incomeReduction.amount).toBe(chf(-152.4));
    expect(x.cantonalIncome.amount).toBe(chf(5_669.3));
    expect(x.communalIncome.amount).toBe(chf(2_990.85));
    expect(x.wealthBase.amount).toBe(0);
    expect(x.total.amount).toBe(chf(8_660.15));
    expect(r.commune).toEqual({ bfs: null, name: 'Lausanne', rate: 7_850 });
    // The federal tax of the guide's worksheet comes with it (./federal.test.ts).
    expect(r.ifd?.tax.amount).toBeGreaterThan(0);
    expect(r.total).toBe(x.total.amount + r.ifd!.tax.amount);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.notCounted).toContainEqual(NOTE.dependents);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.cantonalIncome.sources.join(' ')).toContain(
      'vd-2025-law-impot-annuel art. 2 (p. 1)',
    );
    expect(r.icc?.taxes.incomeReduction.sources.join(' ')).toContain(
      'vd-2025-law-lripp art. 4 al. 1 (p. 2)',
    );
  });
});

describe('H2: married, two earners, two children, Nyon, 2025', () => {
  // Person 1: 110,000 - 7,040 - 7,700 = 95,260. Car, no usable public transport, 18 km, 220 days:
  // 7,920 km x 0.70 = 5,544. Canteen: 1,600 a year x 220 / 240 = 1,466.67, 1,467. 3 % of 95,260 =
  // 2,857.80, 2,858. 3a 7,258.
  // Person 2: 50,000 - 3,200 - 2,500 = 44,300. Public transport 8 km: 2,094. 3 % = 1,329, at least
  // 2,000. 3a 3,000.
  // 235: the lower income after costs and contributions, 44,300 - 4,094 - 3,000 = 37,206: 1,700.
  // 300: 13,000, at most 9,900 + 2 x 1,300 = 12,500. 410: 1,500, all savings: 480: 1,500 (under
  // 3,300 + 2 x 300). 610: 3,000 (under 1,500 + 50,000). 670: 12,000 for the younger child.
  // Total income 95,260 + 44,300 + 1,500 = 141,060. Deductions 7,638 + 1,467 + 4,858 + 1,700 +
  // 12,500 + 10,258 + 1,500 + 3,000 + 12,000 = 54,921. 650: 86,139.
  // 660: rent 30,000, counted up to 13,700 + 2 x 3,700 = 21,100, less 20 % of 86,139 (17,228):
  // 3,872. 690: 82,267. 695: at most 17,000 + 5,700 + 2 x 3,500 = 29,700; the excess 52,567,
  // halved and in hundreds, 26,300: 3,400. 700: 78,867.
  // 710: 9,000 - 5 % of 78,867 (3,943) = 5,057. 720: 1,500 (under 20 %). 725: 1,300 + 2 x 1,000 =
  // 3,300 (650 under 126,300). 730: 78,867 - 5,057 - 1,500 - 3,300 = 69,010; 800: 69,000.
  // 810: 2.8; 820: 69,000 / 2.8 = 24,642, 24,600. Base at 24,600: 1,198 + 10 x 8 = 1,278.00, a rate
  // of 5.195122 %. 69,000 x 5.195122 % = 3,584.634, 3,584.65. LRIPP: 143.386, 143.40; 3,441.25.
  // Cantonal 155 %: 5,333.9375, 5,333.95. Nyon 61 %: 2,186.6365, 2,186.65.
  // Wealth 150,000 - 90,000 = 60,000: under 120,000 for spouses, none. Total 7,520.60.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Nyon',
    civilStatus: 'married',
    rent: amt(30_000),
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
        commuteMode: { by: 'public_transport', kmOneWay: 8 },
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', under14: false },
    ],
    household: {
      healthPremiums: amt(13_000),
      savingsInterest: amt(1_500),
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
    movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(95_260));
    expect(find(r, '100', 'p2')).toBe(chf(44_300));
    expect(find(r, '140', 'p1')).toBe(chf(-5_544));
    expect(find(r, '140', 'p2')).toBe(chf(-2_094));
    expect(find(r, '150')).toBe(chf(-1_467));
    expect(find(r, '160', 'p1')).toBe(chf(-2_858));
    expect(find(r, '160', 'p2')).toBe(chf(-2_000));
    expect(find(r, '235')).toBe(chf(-1_700));
    expect(find(r, '300')).toBe(chf(-12_500));
    expect(find(r, '310')).toBe(chf(-10_258));
    expect(find(r, '480')).toBe(chf(-1_500));
    expect(find(r, '610')).toBe(chf(-3_000));
    expect(find(r, '670')).toBe(chf(-12_000));
    expect(r.icc?.netIncome.amount).toBe(chf(86_139));
    expect(find(r, '660')).toBe(chf(-3_872));
    expect(find(r, '695')).toBe(chf(-3_400));
    expect(r.icc?.intermediateIncome.amount).toBe(chf(78_867));
    expect(find(r, '710')).toBe(chf(-5_057));
    expect(find(r, '720')).toBe(chf(-1_500));
    expect(find(r, '725')).toBe(chf(-3_300));
    expect(r.icc?.taxableIncome.amount).toBe(chf(69_000));
    expect(r.icc?.parts).toBe(280);
    expect(r.icc?.rateIncome.amount).toBe(chf(24_600));
    expect(wealth(r, '410')).toBe(chf(150_000));
    expect(wealth(r, '610')).toBe(chf(-90_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(60_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.how.en).toContain('5.195122 %');
    expect(x.incomeBase.amount).toBe(chf(3_584.65));
    expect(x.incomeReduction.amount).toBe(chf(-143.4));
    expect(x.cantonalIncome.amount).toBe(chf(5_333.95));
    expect(x.communalIncome.amount).toBe(chf(2_186.65));
    expect(x.wealthBase.amount).toBe(0);
    expect(x.total.amount).toBe(chf(7_520.6));
    expect(r.total).toBe(x.total.amount + r.ifd!.tax.amount);
    expect(r.assumptions).toContainEqual(NOTE.partYear);
  });
});

describe('H3: single parent, one child, Yverdon-les-Bains, 2026, by car', () => {
  // 100: 72,000 - 4,608 - 3,600 = 63,792. 140: car, no usable public transport, 10 km, 200 days:
  // 4,000 km x 0.75 (2026) = 3,000. 150: 3,200 x 200 / 240 = 2,666.67, 2,667 (the 2025 guide's
  // 240 days). 160: 3 % = 1,913.76, at least 2,000. 310: 5,000. 300: 6,200 - 1,000 subsidy =
  // 5,200 (under 5,000 + 1,300). 410: 5, 480: 5. 670: 9,000 (under 15,200). 280: child support
  // received 9,600.
  // Total income 63,792 + 9,600 + 5 = 73,397; deductions 3,000 + 2,667 + 2,000 + 5,000 + 5,200 + 5
  // + 9,000 = 26,872. 650: 46,525.
  // 660: rent 21,000; 20 % of 46,525 is 9,305. The 2026 cap is not published but at least 2025's,
  // 13,700 + 3,700 = 17,400: 17,400 - 9,305 = 8,095 and 21,000 - 9,305 = 11,695 are both above
  // the maximum, so 6,800 either way. 690: 39,725.
  // 695: at most 17,000 + 3,200 + 3,500 = 23,700; the excess 16,025, halved and in hundreds, 8,000:
  // 15,700. 700: 24,025. 725: 2,800 + 1,000 = 3,800 (650 under 126,400). 730: 20,225; 800: 20,200.
  // 810: 1.3 + 0.5 = 1.8; 820: 11,222, 11,200. Base at 11,200 (2026): 231 + 29 x 5 = 376.00, a rate
  // of 3.357143 %. 20,200 x 3.357143 % = 678.1429, 678.15. LRIPP 5 %: 33.9075, 33.90; 644.25.
  // Cantonal 155 %: 998.5875, 998.60. Yverdon-les-Bains 75 %: 508.6125, 508.60. Total 1,507.20.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Yverdon-les-Bains',
    civilStatus: 'divorced',
    ownHousehold: true,
    rent: amt(21_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(72_000), socialContributions: amt(4_608), pensionFund: amt(3_600) },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 10, days: 200 },
        mealDays: 200,
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(9_000) }],
    household: {
      healthPremiums: amt(6_200),
      healthSubsidy: amt(1_000),
      childSupportReceived: amt(9_600),
      savingsInterest: amt(5),
    },
    movable: [{ owner: 'p1', value: amt(12_000), income: amt(5) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100')).toBe(chf(63_792));
    expect(find(r, '140')).toBe(chf(-3_000));
    expect(find(r, '150')).toBe(chf(-2_667));
    expect(find(r, '160')).toBe(chf(-2_000));
    expect(find(r, '310')).toBe(chf(-5_000));
    expect(find(r, '300')).toBe(chf(-5_200));
    expect(find(r, '280')).toBe(chf(9_600));
    expect(find(r, '670')).toBe(chf(-9_000));
    expect(r.icc?.netIncome.amount).toBe(chf(46_525));
    expect(find(r, '660')).toBe(chf(-6_800));
    expect(find(r, '695')).toBe(chf(-15_700));
    expect(find(r, '725')).toBe(chf(-3_800));
    expect(r.icc?.taxableIncome.amount).toBe(chf(20_200));
    expect(r.icc?.parts).toBe(180);
    expect(r.icc?.rateIncome.amount).toBe(chf(11_200));
  });

  it('taxes, and the 2025 guide’s methods named for 2026', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(678.15));
    expect(x.incomeReduction.amount).toBe(chf(-33.9));
    expect(x.cantonalIncome.amount).toBe(chf(998.6));
    expect(x.communalIncome.amount).toBe(chf(508.6));
    expect(x.total.amount).toBe(chf(1_507.2));
    expect(r.total).toBe(x.total.amount + r.ifd!.tax.amount);
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.guide2026]);
    expect(r.icc?.items.find((i) => i.code === '660')?.sources.join(' ')).toContain(
      'vd-2026-law-li art. 60 al. 1 and 2 (p. 31)',
    );
  });

  it('2026 fails closed where the 2026 documents give no amount', () => {
    const base = {
      taxYear: 2026,
      commune: 'Yverdon-les-Bains',
      civilStatus: 'single',
      rent: amt(0),
    } as const;
    // Public transport: the 2026 flat amounts are in the unpublished 2026 guide.
    const transit = computeReturn({
      ...base,
      people: [
        {
          id: 'p1',
          employments: [{ gross: amt(60_000) }],
          commuteMode: { by: 'public_transport', kmOneWay: 10 },
        },
      ],
    });
    expect(transit.unsupported).toEqual([NOTE.transport2026]);
    // A rent above the 2025 cap whose 2026 cap would change the deduction.
    const rent = computeReturn({
      ...base,
      rent: amt(14_000),
      people: [{ id: 'p1', employments: [{ gross: amt(30_000) }] }],
    });
    expect(rent.unsupported).toEqual([NOTE.housing2026]);
  });
});

describe('H4: widowed retiree with wealth, Montreux, 2025', () => {
  // 240: AVS 28,000. 250: pension fund 36,000. 410: securities 1,800,000, income 27,000, of which
  // savings interest 2,000: 480: at most 1,600. 490: 1,800. 300: 7,200, at most 5,000.
  // Total income 91,000; deductions 5,000 + 1,600 + 1,800 = 8,400; 650: 82,600.
  // 660: rent 24,000, counted up to 11,100, less 20 % of 82,600 (16,520): nothing. 695: nothing.
  // 700: 82,600. 710: 4,000 under 5 % (4,130): nothing. 720: 3,000. 730 = 800: 79,600.
  // Base at 79,600: 5,763 + 53 x 11 = 6,346.00. LRIPP: 253.84, 253.85; 6,092.15. Cantonal 155 %:
  // 9,442.8325, 9,442.85. Montreux 65 %: 4,124.90.
  // Wealth: 1,800,000 + 20,000 (gold) + 50,000 (life insurance) = 1,870,000; contents 30 % of
  // 150,000 = 45,000, under 60,000. Base: 1,754.20 + 1,160 x 3.39 = 5,686.60. Cantonal 155 %:
  // 8,814.23, 8,814.25. Communal 65 %: 3,696.29, 3,696.30.
  // Maxima (LICom art. 8): income 6,346 x 2.2 = 13,961 under 30 % of 79,600; wealth 5,686.60 x 2.2
  // = 12,511 under 10 per mille of 1,870,000; together 26,472 under 60 % of 82,600 (the yield
  // 25,200 is above 1 % of the wealth). Total 26,078.30.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Montreux',
    civilStatus: 'widowed',
    rent: amt(24_000),
    furnitureInsurance: amt(150_000),
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(36_000) }],
    household: {
      healthPremiums: amt(7_200),
      savingsInterest: amt(2_000),
      bankFees: amt(1_800),
      medicalCosts: amt(4_000),
      donations: amt(3_000),
      cash: amt(20_000),
      lifeInsuranceValue: amt(50_000),
    },
    movable: [{ owner: 'p1', value: amt(1_800_000), income: amt(27_000) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '240')).toBe(chf(28_000));
    expect(find(r, '250')).toBe(chf(36_000));
    expect(find(r, '410')).toBe(chf(27_000));
    expect(find(r, '480')).toBe(chf(-1_600));
    expect(find(r, '490')).toBe(chf(-1_800));
    expect(find(r, '300')).toBe(chf(-5_000));
    expect(r.icc?.netIncome.amount).toBe(chf(82_600));
    expect(find(r, '660')).toBe(0);
    expect(find(r, '710')).toBe(0);
    expect(find(r, '720')).toBe(chf(-3_000));
    expect(r.icc?.taxableIncome.amount).toBe(chf(79_600));
    expect(wealth(r, '440')).toBe(0);
    expect(r.icc?.wealth.grossWealth.amount).toBe(chf(1_870_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(1_870_000));
    expect(r.notCounted).toContainEqual(NOTE.medicalBelow);
    expect(r.assumptions).toContainEqual(NOTE.pensions);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(6_346));
    expect(x.incomeReduction.amount).toBe(chf(-253.85));
    expect(x.cantonalIncome.amount).toBe(chf(9_442.85));
    expect(x.communalIncome.amount).toBe(chf(4_124.9));
    expect(x.wealthBase.amount).toBe(chf(5_686.6));
    expect(x.cantonalWealth.amount).toBe(chf(8_814.25));
    expect(x.communalWealth.amount).toBe(chf(3_696.3));
    expect(x.total.amount).toBe(chf(26_078.3));
    expect(r.total).toBe(x.total.amount + r.ifd!.tax.amount);
  });

  it('fails closed where the maximum of LICom art. 8 could apply (much wealth, little income)', () => {
    const rich = computeReturn({
      taxYear: 2025,
      commune: 'Montreux',
      civilStatus: 'widowed',
      rent: amt(24_000),
      people: [{ id: 'p1', pensionAvs: amt(20_000) }],
      movable: [{ owner: 'p1', value: amt(20_000_000), income: amt(5_000) }],
    });
    expect(rich.icc).toBeNull();
    expect(rich.unsupported).toEqual([NOTE.maxima]);
  });
});

describe('H5: shared custody without child support, Morges, 2025', () => {
  // Divorced, one child of 6 with custody shared alike, no child support; this parent mainly bears
  // the child's upkeep and keeps a household alone with it: 1.3 + half of 0.5 = 1.55 (RIFam art. 5
  // al. 2), and half the child's insurance, savings, modest and family amounts (art. 6).
  // 100: 95,000 - 6,080 - 6,650 = 82,270. 140: public transport 25 km: 3,136. 150: canteen, 240
  // days: 1,600. 160: 3 % = 2,468.10, 2,468. 310: 7,258. 300: 6,000, at most 5,000 + 650 = 5,650.
  // 410: 20, 480: 20. 670: 10,000 paid, at most 7,500 for each parent (RIFam art. 4 al. 2).
  // Total income 82,290; deductions 3,136 + 1,600 + 2,468 + 7,258 + 5,650 + 20 + 7,500 = 27,632;
  // 650: 54,658.
  // 660: rent 13,000, under the cap with or without the child (13,700 or 17,400), less 20 % of
  // 54,658 (10,932): 2,068. 690: 52,590. 695: at most 17,000 + 3,200 + 1,750 = 21,950; the excess
  // 30,640, halved and in hundreds, 15,300: 6,650. 700: 45,940. 725: 2,800 + 500 = 3,300.
  // 730: 42,640; 800: 42,600. 820: 42,600 / 1.55 = 27,483, 27,400 (under the first cap threshold).
  // Base at 27,400: 1,198 + 38 x 8 = 1,502.00, a rate of 5.481752 %. 42,600 x 5.481752 % = 2,335.2264,
  // 2,335.25. LRIPP: 93.41, 93.40; 2,241.85. Cantonal 155 %: 3,474.8675, 3,474.85. Morges 67 %:
  // 1,564.6175, 1,564.60. Total 5,039.45.
  const input: VdEngineInput = {
    taxYear: 2025,
    commune: 'Morges',
    civilStatus: 'divorced',
    childSupport: 'none',
    // Without child support, the federal parental scale goes to the parent who earns more.
    ifdParentalScale: true,
    ownHousehold: true,
    mainUpkeep: true,
    rent: amt(13_000),
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(95_000),
            socialContributions: amt(6_080),
            pensionFund: amt(6_650),
            canteen: true,
          },
        ],
        commuteMode: { by: 'public_transport', kmOneWay: 25 },
        mealDays: 240,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(10_000) }],
    household: { healthPremiums: amt(6_000), savingsInterest: amt(20) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100')).toBe(chf(82_270));
    expect(find(r, '140')).toBe(chf(-3_136));
    expect(find(r, '150')).toBe(chf(-1_600));
    expect(find(r, '160')).toBe(chf(-2_468));
    expect(find(r, '300')).toBe(chf(-5_650));
    expect(find(r, '670')).toBe(chf(-7_500));
    expect(r.icc?.netIncome.amount).toBe(chf(54_658));
    expect(find(r, '660')).toBe(chf(-2_068));
    expect(find(r, '695')).toBe(chf(-6_650));
    expect(find(r, '725')).toBe(chf(-3_300));
    expect(r.icc?.taxableIncome.amount).toBe(chf(42_600));
    expect(r.icc?.parts).toBe(155);
    expect(r.icc?.rateIncome.amount).toBe(chf(27_400));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeBase.amount).toBe(chf(2_335.25));
    expect(x.incomeReduction.amount).toBe(chf(-93.4));
    expect(x.cantonalIncome.amount).toBe(chf(3_474.85));
    expect(x.communalIncome.amount).toBe(chf(1_564.6));
    expect(x.total.amount).toBe(chf(5_039.45));
    expect(r.total).toBe(x.total.amount + r.ifd!.tax.amount);
    expect(r.assumptions).toContainEqual(NOTE.sharedHalf);
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.sharedChildcare]);
    expect(r.icc?.rateIncome.sources.join(' ')).toContain('vd-na-law-rifam art. 4 al. 2 (p. 2)');
  });

  it('the other parent’s situations: child support received or paid, and what must be asked', () => {
    // Receiving child support: the whole part of 0.5 and the 1.3 (RIFam art. 5 al. 1).
    expect(computeReturn({ ...input, childSupport: 'receives' }).icc?.parts).toBe(180);
    // Paying it: no part for the child; the support is deducted (630).
    const pays = computeReturn({
      ...input,
      childSupport: 'pays',
      household: { ...input.household, childSupportPaid: amt(7_200) },
    });
    expect(pays.icc?.parts).toBe(100);
    expect(find(pays, '630')).toBe(chf(-7_200));
    expect(pays.assumptions).toContainEqual(NOTE.childSupportPaid);
    // Not the parent who mainly bears the upkeep: 1 + 0.25; whether the rent counted is raised for
    // the child changes the housing deduction here, and the family deduction is where the
    // documents differ.
    const other = computeReturn({ ...input, mainUpkeep: false });
    expect(other.unsupported).toEqual([NOTE.housingShared, NOTE.familyConflict]);
    // Unanswered questions stop the computation.
    expect(computeReturn({ ...input, mainUpkeep: undefined }).unsupported).toEqual([
      NOTE.mainUpkeep,
    ]);
    expect(computeReturn({ ...input, childSupport: undefined }).unsupported).toEqual([
      NOTE.childSupport,
    ]);
    expect(computeReturn({ ...input, ownHousehold: undefined }).unsupported).toEqual([
      NOTE.ownHousehold,
    ]);
    expect(computeReturn({ ...input, rent: undefined }).unsupported).toEqual([NOTE.rent]);
  });
});

describe('fail closed', () => {
  const base: VdEngineInput = {
    taxYear: 2025,
    commune: 'Lausanne',
    civilStatus: 'single',
    rent: amt(0),
    people: [{ id: 'p1', employments: [{ gross: amt(60_000) }] }],
  };

  it('self-employment, a 2025 pillar 3a catch-up, a married couple sharing custody', () => {
    expect(
      computeReturn({ ...base, people: [{ id: 'p1', selfEmploymentProfit: amt(10_000) }] })
        .unsupported,
    ).toEqual([NOTE.selfEmployed]);
    expect(
      computeReturn({
        ...base,
        people: [{ id: 'p1', employments: [{ gross: amt(60_000) }], pillar3aCatchUp: amt(1_000) }],
      }).unsupported,
    ).toEqual([NOTE.catchUp2025]);
    expect(
      computeReturn({
        ...base,
        civilStatus: 'married',
        people: [{ id: 'p1' }, { id: 'p2' }],
        children: [{ custody: 'shared' }],
      }).unsupported,
    ).toEqual([NOTE.marriedShared]);
  });

  it('a commune with fractions needs the part; the fraction’s rate is added', () => {
    expect(computeReturn({ ...base, commune: 'Le Chenit' }).unsupported).toEqual([
      NOTE.communePart,
    ]);
    const brassus = computeReturn({ ...base, commune: 'Le Chenit', communePart: 'Le Brassus' });
    expect(brassus.commune).toEqual({ bfs: null, name: 'Le Chenit', rate: 6_650 });
    const rest = computeReturn({ ...base, commune: 'Le Chenit', communePart: 'Le Chenit' });
    expect(rest.commune.rate).toBe(5_850);
    expect(brassus.icc!.taxes.communalIncome.amount).toBeGreaterThan(
      rest.icc!.taxes.communalIncome.amount,
    );
  });

  it('the cap of the quotient familial above the first threshold, where no table applies', () => {
    const shared = computeReturn({
      ...base,
      civilStatus: 'divorced',
      childSupport: 'none',
      ownHousehold: true,
      mainUpkeep: true,
      people: [{ id: 'p1', employments: [{ gross: amt(400_000) }] }],
      children: [{ custody: 'shared' }],
    });
    expect(shared.unsupported).toEqual([NOTE.quotientCap]);
  });

  it('refuses an unknown commune, a spouse for a single taxpayer, a year without values', () => {
    expect(() => computeReturn({ ...base, commune: 'Genève' })).toThrow(VdInputError);
    expect(() => computeReturn({ ...base, people: [{ id: 'p1' }, { id: 'p2' }] })).toThrow(
      VdInputError,
    );
    expect(() => computeReturn({ ...base, taxYear: 2024 as 2025 })).toThrow(/not supported/);
  });
});
