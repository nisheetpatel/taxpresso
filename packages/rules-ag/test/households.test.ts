// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The einfache Steuer of each
// taxable income is the one the canton's table prints (test/tariffs.test.ts gives the pages).
// Tarif A cumulative tax at the end of each step (ag-2025-tariff-einkommenssteuer p. 1): 8,100: 38;
// 12,000: 116; 16,200: 242; 20,500: 414; 25,700: 674; 33,100: 1,118; 41,700: 1,720; 51,300: 2,488;
// 63,100: 3,491; 74,800: 4,544.
import { describe, expect, it } from 'vitest';
import { allLines, AgInputError, computeReturn, NOTE, type AgEngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
/** The object without one key. */
function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as Omit<T, K>;
}
const find = (r: ReturnType<typeof computeReturn>, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);

describe('H1: single, Aarau, 2026, employed, public transport, Roman Catholic', () => {
  // Salary: 85,000 - 5,440 (box 9) - 5,100 (box 10.1) = 74,460 (1.1).
  // 10.1: public transport 1,200 (under 7,000). 10.2: 200 days x 15 = 3,000 (under 3,200).
  // 10.3: 3 % of 74,460 = 2,233.80, 2,234 (between 2,000 and 4,000). 13.2: 7,258 with a pension
  // fund (under 74,460 less the professional costs). 14: the flat 3,800 (2026, others).
  // Account 40,000, interest 80 (4).
  // Einkünfte 74,460 + 80 = 74,540; deductions 1,200 + 3,000 + 2,234 + 7,258 + 3,800 = 17,492;
  // Reineinkommen 57,048. No children, no low-income deduction (above 34,999): taxable 57,048.
  // Wealth 40,000 less the tax-free 130,000: 0.
  // Tarif A at 57,000: 2,488 + 5,700 x 8.5 % = 2,972.50, 2,972 (rounded down).
  // Canton 103 %: 3,061.16, 3,061.20. Aarau 96 %: 2,853.12, 2,853.10. Roman Catholic 19 %: 564.68,
  // 564.70. Total 6,479.00.
  const input: AgEngineInput = {
    taxYear: 2026,
    commune: 'Aarau',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(80) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '1.1')).toBe(chf(74_460));
    expect(find(r, '10.1')).toBe(chf(-1_200));
    expect(find(r, '10.2')).toBe(chf(-3_000));
    expect(find(r, '10.3')).toBe(chf(-2_234));
    expect(find(r, '13.2')).toBe(chf(-7_258));
    expect(find(r, '14')).toBe(chf(-3_800));
    expect(find(r, '4')).toBe(chf(80));
    expect(r.icc?.grossIncome.amount).toBe(chf(74_540));
    expect(r.icc?.totalDeductions.amount).toBe(chf(-17_492));
    expect(r.icc?.netIncome.amount).toBe(chf(57_048));
    expect(r.icc?.taxableIncome.amount).toBe(chf(57_048));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
    expect(r.icc?.tariff).toBe('A');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(2_972));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(0);
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(3_061.2));
    expect(r.icc?.taxes.communal.amount).toBe(chf(2_853.1));
    expect(r.icc?.taxes.church?.amount).toBe(chf(564.7));
    expect(r.icc?.taxes.maxBurden).toBeNull();
    expect(r.total).toBe(chf(6_479));
    expect(r.commune).toEqual({ bfs: null, name: 'Aarau', rate: 96 });
    expect(r.ifd).toBeNull();
    expect(r.unsupported).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.notCounted).toContainEqual(NOTE.fireLevy);
    expect(r.assumptions).toContainEqual(NOTE.insuranceFlat);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.cantonal.sources.join(' ')).toContain(
      'ag-2026-communal-kantonssteuerfuss-zinssaetze p. 1',
    );
    expect(r.icc?.taxes.cantonal.sources.join(' ')).toContain('ag-2025-guide-wegleitung p. 45');
  });
});

describe('H2: married, two earners, two children, Baden, 2025, Reformed church tax', () => {
  // Person 1: 110,000 - 7,040 - 7,700 = 95,260. Car, no usable public transport, 18 km, 220 days:
  // 7,920 km (under 15,000) x 0.70 = 5,544 (under 7,000). Canteen: 220 x 7.50 = 1,650, at most
  // 1,600. 3 % of 95,260 = 2,857.80, 2,858. 3a 7,258.
  // Person 2: 50,000 - 3,200 - 2,500 = 44,300. Public transport 1,100. 3 % = 1,329, at least 2,000.
  // 3a 3,000.
  // Accounts 150,000 (income 1,500) and the younger child's 4,000 (income 10): 4 is 1,510, 20.1 is
  // 154,000. Debt interest 3,000 (under 1,510 + 50,000), debts 90,000. 14: married 7,200 (2025).
  // Childcare 12,000 for the child under 14 (both work; under 25,000). 16: 600 (the second earner has
  // 44,300 - 3,100 - 3,000 = 38,200 left).
  // Einkünfte 95,260 + 44,300 + 1,510 = 141,070. Deductions before the medical costs: 17,260 +
  // 6,100 + 3,000 + 7,200 + 12,000 + 600 = 46,160; income less them 94,910.
  // Medical 9,000: Selbstbehalt (94,910 - 9,000) x 5 : 95 = 4,521.58, 4,522; 4,478 deducted.
  // Donations 1,500: at most 20 % of 94,910 - 4,478 = 90,432 (18,086). Reineinkommen 88,932.
  // Children: 9,300 (under 14) + 10,300 (14 to 17) = 19,600; 69,332 left, no low-income deduction.
  // Wealth: 154,000 - 90,000 - 260,000 - 2 x 16,000: 0.
  // Tarif B at 69,300: 2 x A(34,650) = 2 x (1,118 + 1,550 x 7 % = 1,226.50) = 2,453.
  // Canton 111 %: 2,722.83, 2,722.80. Baden 92 % (2025): 2,256.76, 2,256.80. Reformed, the commune's
  // own parish, 18 %: 441.54, 441.50. Total 5,421.10.
  const input: AgEngineInput = {
    taxYear: 2025,
    commune: 'Baden',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed', parish: 'Baden' },
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
      { custody: 'full', band: 'under14', childcare: amt(12_000) },
      { custody: 'full', band: 'under18' },
    ],
    household: {
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_500) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '1.1', 'p1')).toBe(chf(95_260));
    expect(find(r, '1.1', 'p2')).toBe(chf(44_300));
    expect(find(r, '10.1', 'p1')).toBe(chf(-5_544));
    expect(find(r, '10.1', 'p2')).toBe(chf(-1_100));
    expect(find(r, '10.2', 'p1')).toBe(chf(-1_600));
    expect(find(r, '10.3', 'p1')).toBe(chf(-2_858));
    expect(find(r, '10.3', 'p2')).toBe(chf(-2_000));
    expect(find(r, '13.2', 'p1')).toBe(chf(-7_258));
    expect(find(r, '13.2', 'p2')).toBe(chf(-3_000));
    expect(find(r, '4')).toBe(chf(1_510));
    expect(find(r, '11')).toBe(chf(-3_000));
    expect(find(r, '14')).toBe(chf(-7_200));
    expect(find(r, '15.0')).toBe(chf(-12_000));
    expect(find(r, '16')).toBe(chf(-600));
    expect(find(r, '17.1')).toBe(chf(-9_000));
    expect(find(r, '18')).toBe(chf(4_522));
    expect(find(r, '15.3')).toBe(chf(-1_500));
    expect(find(r, '19.1')).toBe(chf(-19_600));
    expect(find(r, '24')).toBe(0);
    expect(r.icc?.grossIncome.amount).toBe(chf(141_070));
    expect(r.icc?.netIncome.amount).toBe(chf(88_932));
    expect(r.icc?.afterSocial.amount).toBe(chf(69_332));
    expect(r.icc?.taxableIncome.amount).toBe(chf(69_332));
    expect(r.icc?.wealth.grossWealth.amount).toBe(chf(154_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
    expect(r.icc?.tariff).toBe('B');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(2_453));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(2_722.8));
    expect(r.icc?.taxes.communal.amount).toBe(chf(2_256.8));
    expect(r.icc?.taxes.church?.amount).toBe(chf(441.5));
    expect(r.total).toBe(chf(5_421.1));
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.medicalRounding, NOTE.medicalOrder]);
    expect(r.assumptions).toContainEqual(NOTE.childrenChurch);
  });

  it('the further Reformed parish of Baden has its own rate (21 %), and is asked for', () => {
    const turgi = computeReturn({
      ...input,
      church: {
        p1: 'reformed',
        p2: 'reformed',
        parish: 'ref. Kirche Turgi Birmenstorf Gebenstorf',
      },
    });
    expect(turgi.icc?.taxes.church?.amount).toBe(chf(515.1)); // 2,453 x 21 % = 515.13
    const unknown = computeReturn({ ...input, church: { p1: 'reformed', p2: 'reformed' } });
    expect(unknown.icc).toBeNull();
    expect(unknown.unsupported).toEqual([NOTE.parish]);
  });
});

describe('H3: single parent, Wettingen, 2026, one child under 14, child support received', () => {
  // Salary 70,000 - 4,480 - 3,500 = 62,020. Bike: the flat 700 (StGV § 12, federal 2026). 3 % of
  // 62,020 = 1,860.60, at least 2,000. 3a 5,000. 14: 3,800. Childcare 8,000 (she works; under
  // 25,000). 5.2: child support 9,600. Account 20,000, interest 20.
  // Einkünfte 62,020 + 9,600 + 20 = 71,640; deductions 700 + 2,000 + 5,000 + 3,800 + 8,000 =
  // 19,500; Reineinkommen 52,140. Child under 14: 9,300; 42,840 left, no low-income deduction.
  // Wealth 20,000 - 130,000 - 16,000: 0.
  // Tarif B (she lives with the child she has the deduction for) at 42,800: 2 x A(21,400) =
  // 2 x (414 + 900 x 5 % = 459) = 918.
  // Canton 103 %: 945.54, 945.50. Wettingen 95 %: 872.10. No church tax asked. Total 1,817.60.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Wettingen',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(70_000), socialContributions: amt(4_480), pensionFund: amt(3_500) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', band: 'under14', childcare: amt(8_000) }],
    household: { childSupportReceived: amt(9_600) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  });

  it('lines and taxes', () => {
    expect(find(r, '10.1')).toBe(chf(-700));
    expect(find(r, '10.3')).toBe(chf(-2_000));
    expect(find(r, '15.0')).toBe(chf(-8_000));
    expect(find(r, '5.2')).toBe(chf(9_600));
    expect(find(r, '19.1')).toBe(chf(-9_300));
    expect(r.icc?.grossIncome.amount).toBe(chf(71_640));
    expect(r.icc?.netIncome.amount).toBe(chf(52_140));
    expect(r.icc?.taxableIncome.amount).toBe(chf(42_840));
    expect(r.icc?.tariff).toBe('B');
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(918));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(945.5));
    expect(r.icc?.taxes.communal.amount).toBe(chf(872.1));
    expect(r.icc?.taxes.church).toBeNull();
    expect(r.total).toBe(chf(1_817.6));
    expect(r.icc?.taxes.simpleIncome.sources.join(' ')).toContain(
      'ag-na-law-steuergesetz § 43 Abs. 2 and 4',
    );
  });
});

describe('H4: widowed retiree with wealth, Rheinfelden, 2026, Reformed church tax', () => {
  // AHV 28,000 and pension fund 30,000 (3). Securities 1,800,000, income 25,000 (4), costs of
  // managing them 2,000 (15.4). 14: 3,800. Einkünfte 83,000; income less the deductions 77,200.
  // Medical 3,000: Selbstbehalt (77,200 - 3,000) x 5 : 95 = 3,905.26, 3,905, more than the costs:
  // 3,000 added back, nothing deducted. Reineinkommen 77,200, taxable 77,200.
  // Tarif A at 77,200: 4,544 + 2,400 x 9.5 % = 4,772 (table p. 17).
  // Wealth 1,800,000 - 130,000 = 1,670,000: 460.10 + 1,242,000 x 1.6 per mille = 2,447.30 (p. 16).
  // Simple tax 7,219.30. Canton 103 %: 7,435.879, 7,435.90. Rheinfelden 90 %: 6,497.37, 6,497.40.
  // Reformed 16 %: 1,155.088, 1,155.10. Total 15,088.40; 70 % of 77,200 is 54,040: no cut.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Rheinfelden',
    civilStatus: 'widowed',
    church: { p1: 'reformed' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(30_000) }],
    household: { bankFees: amt(2_000), medicalCosts: amt(3_000) },
    movable: [{ owner: 'p1', value: amt(1_800_000), income: amt(25_000) }],
  });

  it('lines and taxes', () => {
    expect(find(r, '3-ahv')).toBe(chf(28_000));
    expect(find(r, '3-bv')).toBe(chf(30_000));
    expect(find(r, '15.4')).toBe(chf(-2_000));
    expect(find(r, '17.1')).toBe(chf(-3_000));
    expect(find(r, '18')).toBe(chf(3_000));
    expect(r.notCounted).toContainEqual(NOTE.medicalBelow);
    expect(r.icc?.netIncome.amount).toBe(chf(77_200));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(1_670_000));
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(4_772));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(chf(2_447.3));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(7_435.9));
    expect(r.icc?.taxes.communal.amount).toBe(chf(6_497.4));
    expect(r.icc?.taxes.church?.amount).toBe(chf(1_155.1));
    expect(r.icc?.taxes.maxBurden).toBeNull();
    expect(r.total).toBe(chf(15_088.4));
    expect(r.assumptions).toContainEqual(NOTE.pensions);
  });
});

describe('H5: shared custody, no child support, Lenzburg, 2025', () => {
  // Divorced father, one child of 10 who lives with each parent in turn, parental authority shared,
  // no child support, and he mainly bears the child's upkeep: the child deduction and Tarif B are
  // his (Wegleitung 2025, 19.1). Salary 95,000 - 6,080 - 6,000 = 82,920. Public transport 2,400.
  // Canteen, 180 days x 7.50 = 1,350. 3 % of 82,920 = 2,487.60, 2,488. 3a 7,258. 14: 3,600 (2025).
  // Childcare 15,000, at most 12,500 for each parent (Merkblatt 4.7).
  // Einkünfte 82,920; deductions 2,400 + 1,350 + 2,488 + 7,258 + 3,600 + 12,500 = 29,596;
  // Reineinkommen 53,324. Child under 14: 9,300; 44,024 left.
  // Tarif B at 44,000: 2 x A(22,000) = 2 x (414 + 1,500 x 5 % = 489) = 978.
  // Canton 111 %: 1,085.58, 1,085.60. Lenzburg 105 % (2025): 1,026.90. Total 2,112.50.
  const input: AgEngineInput = {
    taxYear: 2025,
    commune: 'Lenzburg',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainUpkeep: true,
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(95_000),
            socialContributions: amt(6_080),
            pensionFund: amt(6_000),
            canteen: true,
          },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(2_400),
        mealDays: 180,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', band: 'under14', childcare: amt(15_000) }],
  };
  const r = computeReturn(input);

  it('lines and taxes', () => {
    expect(find(r, '10.2')).toBe(chf(-1_350));
    expect(find(r, '10.3')).toBe(chf(-2_488));
    expect(find(r, '15.0')).toBe(chf(-12_500));
    expect(find(r, '19.1')).toBe(chf(-9_300));
    expect(r.icc?.netIncome.amount).toBe(chf(53_324));
    expect(r.icc?.taxableIncome.amount).toBe(chf(44_024));
    expect(r.icc?.tariff).toBe('B');
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(978));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(1_085.6));
    expect(r.icc?.taxes.communal.amount).toBe(chf(1_026.9));
    expect(r.total).toBe(chf(2_112.5));
    expect(r.assumptions).toContainEqual(NOTE.sharedChildcare);
  });

  it('the other parent: no child deduction and Tarif A, childcare still at most 12,500', () => {
    // Deductions 29,596; no child deduction: taxable 53,324. Tarif A at 53,300: 2,488 + 2,000 x
    // 8.5 % = 2,658.
    const other = computeReturn({ ...input, mainUpkeep: false });
    expect(find(other, '19.1')).toBe(0);
    expect(find(other, '15.0')).toBe(chf(-12_500));
    expect(other.icc?.tariff).toBe('A');
    expect(other.icc?.taxes.simpleIncome.amount).toBe(chf(2_658));
    expect(other.assumptions).toContainEqual(NOTE.notMainUpkeep);
  });

  it('unanswered: who mainly bears the upkeep, or whether child support is paid', () => {
    expect(computeReturn(without(input, 'mainUpkeep')).unsupported).toEqual([NOTE.mainUpkeep]);
    expect(computeReturn(without(input, 'childSupport')).unsupported).toEqual([NOTE.childSupport]);
  });

  it('paying child support: the support is deducted, the child counts for the other parent', () => {
    const pays = computeReturn({
      ...input,
      childSupport: 'pays',
      household: { childSupportPaid: amt(7_200) },
    });
    expect(find(pays, '12.2')).toBe(chf(-7_200));
    expect(find(pays, '19.1')).toBe(0);
    expect(pays.icc?.tariff).toBe('A');
    expect(pays.assumptions).toContainEqual(NOTE.childSupportPaid);
  });
});

describe('The maximum burden (Höchstbelastung, StG § 56)', () => {
  // Widow in Rheinfelden, 2026, no church: AHV 30,000; securities 8,000,000 with 10,000 income.
  // Einkünfte 40,000, 14: 3,800, Reineinkommen 36,200 (above 34,999: no low-income deduction).
  // Tarif A at 36,200: 1,118 + 3,100 x 7 % = 1,335. Wealth 8,000,000 - 130,000 = 7,870,000:
  // 460.10 + 7,442,000 x 1.6 per mille = 12,367.30. Simple tax 13,702.30.
  // Canton 103 %: 14,113.369, 14,113.40; Rheinfelden 90 %: 12,332.07, 12,332.10; together
  // 26,445.50, above 70 % of 36,200 = 25,340. The wealth taxes are 12,367.30 x 193 % = 23,868.89,
  // half of it 11,934.45: the cut is the whole 1,105.50, and the taxes are 25,340.00.
  const input: AgEngineInput = {
    taxYear: 2026,
    commune: 'Rheinfelden',
    civilStatus: 'widowed',
    church: { p1: 'none' },
    people: [{ id: 'p1', pensionAvs: amt(30_000) }],
    movable: [{ owner: 'p1', value: amt(8_000_000), income: amt(10_000) }],
  };
  const r = computeReturn(input);

  it('cuts the taxes to 70 % of the net income', () => {
    expect(r.icc?.netIncome.amount).toBe(chf(36_200));
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(1_335));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(chf(12_367.3));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(14_113.4));
    expect(r.icc?.taxes.communal.amount).toBe(chf(12_332.1));
    expect(r.icc?.taxes.maxBurden?.amount).toBe(chf(-1_105.5));
    expect(r.total).toBe(chf(25_340));
    expect(r.unverifiedRules).toContainEqual(NOTE.maxBurdenRounding);
  });

  it('asks about the church tax when the cut may apply and it was not asked', () => {
    expect(computeReturn(without(input, 'church')).unsupported).toEqual([NOTE.churchForCap]);
  });
});

describe('Fail closed', () => {
  const base: AgEngineInput = {
    taxYear: 2026,
    commune: 'Aarau',
    civilStatus: 'single',
    people: [{ id: 'p1', pensionAvs: amt(40_000) }],
  };

  it('the low-income deduction right above a step: the 100 % rule is not computed', () => {
    // AHV 18,800 - 3,800 = 15,000: the deduction falls from 12,000 to 7,500 for one franc more;
    // Tarif A at 7,500 is 32, at 2,999 it is 0, so the tax rises by more than the franc.
    const r = computeReturn({ ...base, people: [{ id: 'p1', pensionAvs: amt(18_800) }] });
    expect(r.icc).toBeNull();
    expect(r.unsupported).toEqual([NOTE.lowIncomeStep]);
    // Well inside a step: AHV 14,000 - 3,800 = 10,200, the deduction 12,000: no tax.
    const low = computeReturn({ ...base, people: [{ id: 'p1', pensionAvs: amt(14_000) }] });
    expect(find(low, '24')).toBe(chf(-12_000));
    expect(low.icc?.taxableIncome.amount).toBe(0);
    expect(low.total).toBe(0);
  });

  it('spouses of different churches, self-employment, a 3a catch-up in 2025', () => {
    const couple: AgEngineInput = {
      ...base,
      civilStatus: 'married',
      people: [
        { id: 'p1', pensionAvs: amt(40_000) },
        { id: 'p2', pensionAvs: amt(20_000) },
      ],
    };
    expect(
      computeReturn({ ...couple, church: { p1: 'catholic', p2: 'none' } }).unsupported,
    ).toEqual([NOTE.churchMixed]);
    expect(
      computeReturn({ ...base, people: [{ id: 'p1', selfEmploymentProfit: amt(50_000) }] })
        .unsupported,
    ).toEqual([NOTE.selfEmployed]);
    expect(
      computeReturn({
        ...base,
        taxYear: 2025,
        people: [{ id: 'p1', pensionAvs: amt(40_000), pillar3aCatchUp: amt(5_000) }],
      }).unsupported,
    ).toEqual([NOTE.catchUp2025]);
  });

  it('a child without its age band; a married couple sharing custody with another parent', () => {
    expect(computeReturn({ ...base, children: [{ custody: 'full' }] }).unsupported).toEqual([
      NOTE.childBand,
    ]);
    expect(
      computeReturn({
        ...base,
        civilStatus: 'married',
        children: [{ custody: 'shared', band: 'under18' }],
      }).unsupported,
    ).toEqual([NOTE.coupleShared]);
  });

  it('an unknown commune, another year, a spouse without a marriage', () => {
    expect(() => computeReturn({ ...base, commune: 'Zürich' })).toThrow(AgInputError);
    expect(() => computeReturn({ ...base, commune: 'Villnachern' })).toThrow(AgInputError);
    expect(computeReturn({ ...base, taxYear: 2025, commune: 'Villnachern' }).commune.rate).toBe(
      120,
    );
    expect(() => computeReturn({ ...base, taxYear: 2027 as 2026 })).toThrow(/not supported/);
    expect(() => computeReturn({ ...base, people: [{ id: 'p1' }, { id: 'p2' }] })).toThrow(
      AgInputError,
    );
  });
});
