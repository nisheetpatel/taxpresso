// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The einfache Steuer is read
// on the tariff sheets' brackets (test/tariffs.test.ts) and rounded to the centime; each Steuerfuss
// of it to the nearest 5 centimes (NOTE.rounding).
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  NOTE,
  type ZgEngineInput,
  type ZgTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: ZgTaxResult, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: ZgTaxResult, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, Zug, 2025, employed, renting, Roman Catholic', () => {
  // 100: 120,000 - 7,680 (box 9) - 8,000 (box 10.1) = 104,320. 160: 400.
  // 201: the Zuger Pass 729 (at most 6,000) + 200 days x 15 = 3,000 (at most 3,200) + the flat
  // 3 % of 104,320 = 3,129.60, to the franc 3,130 (between 2,000 and 4,000) = 6,859.
  // 220: 7,258 (with a pension fund). 230: paid 4,800, single with contributions, at most 3,500.
  // 190: 104,720. 280: 6,859 + 7,258 + 3,500 = 17,617. 287: 87,103.
  // 296: 500 (at least 100, at most 20 % of 87,103). 299: 86,603.
  // 402: 12,000. 407: 30 % of the net rent 30,000 = 9,000 (at most 10,800). 490: 65,603.
  // Grundtarif 2025 at 65,603: 2,531.50 at 59,700 + 5,903 x 6.5 % = 383.695: 2,915.195, 2,915.20.
  // 600: 80,000; 672: -204,000; 690: 0, no wealth tax.
  // Canton 82 %: 2,390.464, to 5 centimes 2,390.45. Zug 52.11 %: 1,519.11072, 1,519.10.
  // Roman Catholic parish of Zug 7 %: 204.064, 204.05. Total 4,113.60.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Zug',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    citizenOf: { p1: null },
    rent: amt(30_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(120_000), socialContributions: amt(7_680), pensionFund: amt(8_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(729),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800), donations: amt(500) },
    movable: [{ owner: 'p1', value: amt(80_000), income: amt(400) }],
  });

  it('lines of form K', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(104_320));
    expect(find(r, '160')).toBe(chf(400));
    expect(find(r, '201', 'p1')).toBe(chf(-6_859));
    expect(find(r, '220', 'p1')).toBe(chf(-7_258));
    expect(find(r, '230')).toBe(chf(-3_500));
    expect(find(r, '296')).toBe(chf(-500));
    expect(find(r, '402')).toBe(chf(-12_000));
    expect(find(r, '407')).toBe(chf(-9_000));
    expect(r.icc?.grossIncome.amount).toBe(chf(104_720));
    expect(r.icc?.totalDeductions.amount).toBe(chf(17_617));
    expect(r.icc?.subtotal.amount).toBe(chf(87_103));
    expect(r.icc?.netIncome.amount).toBe(chf(86_603));
    expect(r.icc?.taxableIncome.amount).toBe(chf(65_603));
    expect(r.icc?.tariff).toBe('single');
    expect(wealth(r, '600')).toBe(chf(80_000));
    expect(wealth(r, '672')).toBe(chf(-204_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(2_915.2));
    expect(x.simpleWealth.amount).toBe(0);
    expect(x.cantonal.amount).toBe(chf(2_390.45));
    expect(x.communal.amount).toBe(chf(1_519.1));
    expect(x.church?.amount).toBe(chf(204.05));
    expect(x.citizens).toBeNull();
    expect(r.total).toBe(chf(4_113.6));
    expect(r.commune).toEqual({ bfs: null, name: 'Zug', rate: 5_211 });
    expect(r.ifd).toBeNull();
    expect(r.estimates).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.assumptions).toContainEqual(NOTE.fullYear);
    expect(r.notCounted).toContainEqual(NOTE.dependents);
    expect(r.notCounted).not.toContainEqual(NOTE.churchNotAsked);
    expect(r.notCounted).not.toContainEqual(NOTE.rentNotGiven);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.simpleIncome.sources.join(' ')).toContain('zg-2026-tariff-grundtarif p. 2');
    expect(r.icc?.taxes.cantonal.sources.join(' ')).toContain(
      'zg-2025-law-steuergesetz § 2 Abs. 2 (p. 1)',
    );
    expect(r.icc?.items.find((i) => i.code === '407')?.sources.join(' ')).toContain(
      'zg-2026-deductions-sozialabzuege p. 2',
    );
  });
});

describe('H2: married, two earners, two children, Baar, 2026, Evangelical Reformed', () => {
  // Person 1: 130,000 - 8,320 - 9,500 = 112,180 (100). 201: car, no usable public transport,
  // 15 km x 2 x 200 days x 0.75 = 4,500; canteen, 200 days x 7.50 = 1,500 (at most 1,600); the flat
  // 3 % of 112,180 = 3,365.40, 3,365: 9,365. 220: 7,258.
  // Person 2: 60,000 - 3,840 - 2,500 = 53,660 (101). 202: public transport 800; the flat 3 % of
  // 53,660 = 1,609.80, at least 2,000: 2,800. 221: 3,000.
  // 160: 1,200. 190: 112,180 + 53,660 + 1,200 = 167,040.
  // 205: 600 (at most 1,200 + 50,000). 230: paid 14,000; married with contributions 9,200 +
  // 2 x 1,600 = 12,400. 253: the younger child (under 14), 18,000 (at most 25,400; more than the
  // own care 12,200, so no 404 for it). 260: earned income 112,180 - 9,365 - 7,258 = 95,557 and
  // 53,660 - 2,800 - 3,000 = 47,860; the lower, at most 4,600: 4,600.
  // 280: 9,365 + 2,800 + 600 + 7,258 + 3,000 + 12,400 + 18,000 + 4,600 = 58,023. 287: 109,017.
  // 295: 6,000 less 5 % of 109,017 (5,450.85, 5,451) = 549. 299: 108,468.
  // 400: 24,000. 403: 2 x 12,600 = 25,200. 403a: the older child (16) 12,200. 490: 47,068.
  // Mehrpersonentarif 2026 at 47,068: 1,151 at 42,200 + 4,868 x 4 % = 194.72: 1,345.72.
  // 600: 150,000; 640: -20,000; 660: 130,000; 671: -408,000; 673: 2 minors x -102,000; 690: 0.
  // Canton 78 %: 1,049.6616, 1,049.65. Baar 47.53 %: 639.620716, 639.60.
  // Evangelical Reformed parish 6 %: 80.7432, 80.75. Total 1,770.00.
  const input: ZgEngineInput = {
    taxYear: 2026,
    commune: 'Baar',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(130_000),
            socialContributions: amt(8_320),
            pensionFund: amt(9_500),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 200 },
        mealDays: 200,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(2_500) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(18_000) },
      { custody: 'full', under14: false, under15: false, minor: true },
    ],
    household: {
      healthPremiums: amt(14_000),
      medicalCosts: amt(6_000),
      debtInterest: amt(600),
      debts: amt(20_000),
    },
    movable: [{ owner: 'household', value: amt(150_000), income: amt(1_200) }],
  };
  const r = computeReturn(input);

  it('lines of form K', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(112_180));
    expect(find(r, '101', 'p2')).toBe(chf(53_660));
    expect(find(r, '201', 'p1')).toBe(chf(-9_365));
    expect(find(r, '202', 'p2')).toBe(chf(-2_800));
    expect(find(r, '205')).toBe(chf(-600));
    expect(find(r, '220', 'p1')).toBe(chf(-7_258));
    expect(find(r, '221', 'p2')).toBe(chf(-3_000));
    expect(find(r, '230')).toBe(chf(-12_400));
    expect(find(r, '253')).toBe(chf(-18_000));
    expect(find(r, '260')).toBe(chf(-4_600));
    expect(r.icc?.totalDeductions.amount).toBe(chf(58_023));
    expect(r.icc?.subtotal.amount).toBe(chf(109_017));
    expect(find(r, '295')).toBe(chf(-549));
    expect(r.icc?.netIncome.amount).toBe(chf(108_468));
    expect(find(r, '400')).toBe(chf(-24_000));
    expect(find(r, '403')).toBe(chf(-25_200));
    expect(find(r, '403a')).toBe(chf(-12_200));
    expect(find(r, '404')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(47_068));
    expect(r.icc?.tariff).toBe('married');
    expect(r.icc?.wealth.netWealth.amount).toBe(chf(130_000));
    expect(wealth(r, '671')).toBe(chf(-408_000));
    expect(wealth(r, '673')).toBe(chf(-204_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(1_345.72));
    expect(x.cantonal.amount).toBe(chf(1_049.65));
    expect(x.communal.amount).toBe(chf(639.6));
    expect(x.church?.amount).toBe(chf(80.75));
    expect(r.total).toBe(chf(1_770));
    expect(r.notCounted).toContainEqual(NOTE.rentNotGiven);
    expect(r.notCounted).toContainEqual(NOTE.citizensNotAsked);
    expect(r.assumptions).toContainEqual(NOTE.childrenAtCharge);
  });

  it('driving more than 220 days in 2026: no 2026 document gives the limit, not computed', () => {
    const p1 = input.people[0]!;
    const more = computeReturn({
      ...input,
      people: [
        { ...p1, commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 230 } },
        input.people[1]!,
      ],
    });
    expect(more.icc).toBeNull();
    expect(more.unsupported).toEqual([NOTE.days2026]);
    // In 2025 the guide counts at most 220 days (p. 32): 15 x 2 x 220 x 0.70 = 4,620.
    const in2025 = computeReturn({
      ...input,
      taxYear: 2025,
      people: [
        { ...p1, commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 230 } },
        input.people[1]!,
      ],
    });
    expect(in2025.unsupported).toEqual([]);
    // 4,620 + 1,500 + 3,365 = 9,485.
    expect(find(in2025, '201', 'p1')).toBe(chf(-9_485));
  });
});

describe('H3: single parent, one child, Cham, 2025, receives child support', () => {
  // 100: 85,000 - 5,440 - 4,250 = 75,310. 171: 12,000. 160: 50. 190: 87,360.
  // 201: the Zuger Pass 729 + the flat 3 % of 75,310 = 2,259.30, 2,259: 2,988. 220: 5,000.
  // 230: paid 6,500 - 1,000 subsidy = 5,500; single with contributions 3,500 + 1 x 1,100 = 4,600.
  // 253: childcare 8,000 is less than the own care 12,200, so 404 instead: 12,200.
  // 280: 2,988 + 5,000 + 4,600 = 12,588. 287 and 299: 74,772.
  // 400: 24,000 (she lives with a child who counts for her). 403: 12,600. 404: 12,200.
  // 407: 30 % of 24,000 = 7,200. 490: 74,772 - 56,000 = 18,772.
  // Mehrpersonentarif 2025 at 18,772: 167 at 12,200 + 6,572 x 3 % = 197.16: 364.16.
  // 600: 20,000; 672: -204,000; 673: -102,000; 690: 0.
  // Canton 82 %: 298.6112, 298.60. Cham 54 %: 196.6464, 196.65. Total 495.25.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Cham',
    civilStatus: 'divorced',
    rent: amt(24_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(4_250) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(729),
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(8_000) }],
    household: {
      healthPremiums: amt(6_500),
      healthSubsidy: amt(1_000),
      childSupportReceived: amt(12_000),
    },
    movable: [{ owner: 'child0', value: amt(20_000), income: amt(50) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(75_310));
    expect(find(r, '171')).toBe(chf(12_000));
    expect(find(r, '201', 'p1')).toBe(chf(-2_988));
    expect(find(r, '230')).toBe(chf(-4_600));
    expect(find(r, '253')).toBe(0);
    expect(r.icc?.subtotal.amount).toBe(chf(74_772));
    expect(find(r, '400')).toBe(chf(-24_000));
    expect(find(r, '403')).toBe(chf(-12_600));
    expect(find(r, '404')).toBe(chf(-12_200));
    expect(find(r, '407')).toBe(chf(-7_200));
    expect(r.icc?.taxableIncome.amount).toBe(chf(18_772));
    expect(r.icc?.tariff).toBe('married');
    expect(wealth(r, '673')).toBe(chf(-102_000));
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(364.16));
    expect(x.cantonal.amount).toBe(chf(298.6));
    expect(x.communal.amount).toBe(chf(196.65));
    expect(x.church).toBeNull();
    expect(r.total).toBe(chf(495.25));
    expect(r.assumptions).toContainEqual(NOTE.ownCareInstead);
    expect(r.notCounted).toContainEqual(NOTE.churchNotAsked);
  });
});

describe('H4: retiree with wealth, Walchwil, 2026, Roman Catholic, Ortsbürger of Walchwil', () => {
  // 130: 30,000. 135: 24,000. 160: 9,000. 190: 63,000.
  // 230: paid 7,200; single without contributions to the 2nd pillar or 3a: 6,900. 255: 600.
  // 280: 7,500. 287: 55,500. 295: 4,000 less 5 % of 55,500 (2,775) = 1,225. 299: 54,275.
  // 600: 900,000; 601: 10,000; 603: 50,000; 630 and 660: 960,000; 672: -204,000; 690: 756,000.
  // 406: none, the net wealth 960,000 is above 400,000. 402: 12,000. 407: 30 % of 21,600 = 6,480.
  // 490: 54,275 - 18,480 = 35,795.
  // Grundtarif 2026 at 35,795: 1,167.50 at 34,900 + 895 x 5.5 % = 49.225: 1,216.725, 1,216.73.
  // Wealth at 756,000: 323.85 at 508,000 + 248,000 x 0.1275 % = 316.20: 640.05.
  // Einfache Steuer 1,856.78. Canton 78 %: 1,448.2884, 1,448.30. Walchwil 51 %: 946.9578, 946.95.
  // Roman Catholic parish of Walchwil 11 %: 204.2458, 204.25. The Bürgergemeinde Walchwil taxes
  // only special taxes (the table's footnote 3): none. Total 2,599.50.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Walchwil',
    civilStatus: 'widowed',
    church: { p1: 'catholic' },
    citizenOf: { p1: 'Walchwil' },
    rent: amt(21_600),
    people: [{ id: 'p1', pensionAvs: amt(30_000), pensionOccupational: amt(24_000) }],
    household: {
      healthPremiums: amt(7_200),
      medicalCosts: amt(4_000),
      bankFees: amt(600),
      cash: amt(10_000),
      lifeInsuranceValue: amt(50_000),
    },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(9_000) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '130', 'p1')).toBe(chf(30_000));
    expect(find(r, '135', 'p1')).toBe(chf(24_000));
    expect(find(r, '230')).toBe(chf(-6_900));
    expect(find(r, '255')).toBe(chf(-600));
    expect(find(r, '295')).toBe(chf(-1_225));
    expect(r.icc?.netIncome.amount).toBe(chf(54_275));
    expect(find(r, '406')).toBe(0);
    expect(r.notCounted).toContainEqual(NOTE.pensionerWealth);
    expect(r.icc?.wealth.netWealth.amount).toBe(chf(960_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(756_000));
    expect(r.icc?.taxableIncome.amount).toBe(chf(35_795));
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(1_216.73));
    expect(x.simpleWealth.amount).toBe(chf(640.05));
    expect(x.simple.amount).toBe(chf(1_856.78));
    expect(x.cantonal.amount).toBe(chf(1_448.3));
    expect(x.communal.amount).toBe(chf(946.95));
    expect(x.church?.amount).toBe(chf(204.25));
    expect(x.citizens).toBeNull();
    expect(r.assumptions).toContainEqual(NOTE.citizensSpecial);
    expect(r.total).toBe(chf(2_599.5));
  });

  it('with less wealth, the pensioners’ deduction of 2026: 6,000 a pensioner', () => {
    // Net wealth 360,000 (at most 400,000), net income 54,275 (at most 60,000, small personal
    // deduction): 406 = 6,000. 490: 54,275 - 12,000 - 6,000 - 6,480 = 29,795.
    const less = computeReturn({
      taxYear: 2026,
      commune: 'Walchwil',
      civilStatus: 'widowed',
      rent: amt(21_600),
      people: [{ id: 'p1', pensionAvs: amt(30_000), pensionOccupational: amt(24_000) }],
      household: {
        healthPremiums: amt(7_200),
        medicalCosts: amt(4_000),
        bankFees: amt(600),
        cash: amt(10_000),
        lifeInsuranceValue: amt(50_000),
      },
      movable: [{ owner: 'p1', value: amt(300_000), income: amt(9_000) }],
    });
    expect(find(less, '406')).toBe(chf(-6_000));
    expect(less.icc?.taxableIncome.amount).toBe(chf(29_795));
  });
});

describe('H5: shared custody without child support, Steinhausen, 2026', () => {
  // 100: 95,000 - 6,080 - 5,000 = 83,920. 201: 729 + the flat 3 % of 83,920 = 2,517.60, 2,518:
  // 3,247. 220: 7,258.
  // 230: paid 5,000; single with contributions 4,600 + half of 1,600 for the shared child = 5,400;
  // what was paid: 5,000. 280: 3,247 + 7,258 + 5,000 = 15,505. 287 and 299: 68,415.
  // You have the larger share of care (Verordnung § 18 Abs. 2): 400: 24,000; 403: 12,600;
  // 404: 12,200 (childcare 6,000 is less). 407: 30 % of 26,000 = 7,800. 490: 11,815.
  // Mehrpersonentarif 2026 at 11,815: 55 at 6,600 + 5,215 x 2 % = 104.30: 159.30.
  // Canton 78 %: 124.254, 124.25. Steinhausen 53 %: 84.429, 84.45. Total 208.70.
  const input: ZgEngineInput = {
    taxYear: 2026,
    commune: 'Steinhausen',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainCare: true,
    rent: amt(26_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(729),
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(6_000) }],
    household: { healthPremiums: amt(5_000) },
  };

  it('the parent with the larger share of care', () => {
    const r = computeReturn(input);
    expect(r.unsupported).toEqual([]);
    expect(find(r, '201', 'p1')).toBe(chf(-3_247));
    expect(find(r, '230')).toBe(chf(-5_000));
    expect(find(r, '400')).toBe(chf(-24_000));
    expect(find(r, '403')).toBe(chf(-12_600));
    expect(find(r, '404')).toBe(chf(-12_200));
    expect(find(r, '407')).toBe(chf(-7_800));
    expect(r.icc?.taxableIncome.amount).toBe(chf(11_815));
    expect(r.icc?.tariff).toBe('married');
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(159.3));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(124.25));
    expect(r.icc?.taxes.communal.amount).toBe(chf(84.45));
    expect(r.total).toBe(chf(208.7));
    expect(r.assumptions).toContainEqual(NOTE.mainCareYes);
  });

  it('the other parent: Grundtarif, small personal deduction, half the insurance for the child', () => {
    // 230: single with contributions 4,600 + 800 = 5,400; paid 5,000: 5,000. The childcare paid
    // counts for the parent the child counts for. 402: 12,000. 490: 68,415 - 12,000 - 7,800 =
    // 48,615. Grundtarif 2026 at 48,615: 1,800 at 46,400 + 2,215 x 5.5 % = 121.825: 1,921.825,
    // 1,921.83. Canton 78 %: 1,499.0274, 1,499.05. Steinhausen 53 %: 1,018.5699, 1,018.55.
    const r = computeReturn({ ...input, mainCare: false });
    expect(r.unsupported).toEqual([]);
    expect(find(r, '230')).toBe(chf(-5_000));
    expect(find(r, '402')).toBe(chf(-12_000));
    expect(find(r, '403')).toBe(0);
    expect(find(r, '404')).toBe(0);
    expect(r.icc?.tariff).toBe('single');
    expect(r.icc?.taxableIncome.amount).toBe(chf(48_615));
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(1_921.83));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(1_499.05));
    expect(r.icc?.taxes.communal.amount).toBe(chf(1_018.55));
    expect(r.assumptions).toContainEqual(NOTE.mainCareNo);
    expect(r.notCounted).toContainEqual(NOTE.childcareOther);
  });

  it('without the answer on care, or on child support, the tax is not computed', () => {
    const noCare = computeReturn({ ...input, mainCare: undefined });
    expect(noCare.icc).toBeNull();
    expect(noCare.unsupported).toEqual([NOTE.mainCare]);
    const noSupport = computeReturn({ ...input, childSupport: undefined });
    expect(noSupport.unsupported).toEqual([NOTE.childSupport]);
  });
});
