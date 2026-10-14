// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. Each household's taxable
// income was chosen to land on a row the canton's tariff sheet prints (bl-<year>-tariff-staatssteuer
// p. 1), so its income tax is read in the table, not computed: test/tariffs.test.ts gives the rows.
// Communal and church taxes are rounded to the nearest 5 centimes (NOTE.rounding).
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  NOTE,
  type BlEngineInput,
  type BlTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: BlTaxResult, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: BlTaxResult, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, Liestal, 2025, employed, securities', () => {
  // 100: 100,000 - 6,400 (box 9) - 7,000 (box 10.1) = 86,600. 300: 300.
  // 500: the U-Abo, 1,032 (at most 6,000). 510: 200 days x 15 = 3,000 (at most 3,200).
  // 520: the canton's flat 500 + union dues 300 = 800. 610: 7,258 (with a pension fund).
  // 625: 2,000, the flat maximum. 720: 1,200 in full (no threshold). 738: 1,610 in full (no limit).
  // 499: 86,900. 789: 1,032 + 3,000 + 800 + 7,258 + 2,000 + 1,200 + 1,610 = 16,900. 790: 70,000.
  // Tariff, single, 2025 at 70,000: 6,405.85. State tax at 100 %: 6,405.85.
  // Liestal 65 %: 4,163.8025, to 5 centimes 4,163.80.
  // 800: 50,000; 905: 90,000; 910: 0, no wealth tax. Total 10,569.65.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Liestal',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(100_000), socialContributions: amt(6_400), pensionFund: amt(7_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        mealDays: 200,
        otherProfessionalCosts: amt(300),
        pillar3a: amt(7_258),
      },
    ],
    household: { medicalCosts: amt(1_200), donations: amt(1_610) },
    movable: [{ owner: 'p1', value: amt(50_000), income: amt(300) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(86_600));
    expect(find(r, '300')).toBe(chf(300));
    expect(find(r, '500', 'p1')).toBe(chf(-1_032));
    expect(find(r, '510', 'p1')).toBe(chf(-3_000));
    expect(find(r, '520', 'p1')).toBe(chf(-800));
    expect(find(r, '610', 'p1')).toBe(chf(-7_258));
    expect(find(r, '625')).toBe(chf(-2_000));
    expect(find(r, '720')).toBe(chf(-1_200));
    expect(find(r, '738')).toBe(chf(-1_610));
    expect(r.icc?.grossIncome.amount).toBe(chf(86_900));
    expect(r.icc?.totalDeductions.amount).toBe(chf(16_900));
    expect(r.icc?.taxableIncome.amount).toBe(chf(70_000));
    expect(r.icc?.splitting).toBe(false);
    expect(wealth(r, '800')).toBe(chf(50_000));
    expect(wealth(r, '905')).toBe(chf(-90_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(6_405.85));
    expect(x.childReduction.amount).toBe(0);
    expect(x.cantonalIncome.amount).toBe(chf(6_405.85));
    expect(x.communalIncome.amount).toBe(chf(4_163.8));
    expect(x.cantonalWealth.amount).toBe(0);
    expect(x.communalWealth.amount).toBe(0);
    expect(x.church).toBeNull();
    expect(r.total).toBe(chf(10_569.65));
    expect(r.commune).toEqual({ bfs: null, name: 'Liestal', rate: 6_500 });
    expect(r.ifd).toBeNull();
    expect(r.estimates).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.assumptions).toContainEqual(NOTE.insuranceFlat);
    expect(r.assumptions).toContainEqual(NOTE.fullYear);
    expect(r.notCounted).toContainEqual(NOTE.churchNotAsked);
    expect(r.notCounted).toContainEqual(NOTE.dependents);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.incomeTariffTax.sources.join(' ')).toContain(
      'bl-2025-tariff-tariftabelle (sheet Tarif',
    );
    expect(r.icc?.taxes.cantonalIncome.sources.join(' ')).toContain(
      'bl-na-law-steuerfussdekret-331-2 § 17 (p. 2)',
    );
    expect(r.icc?.items.find((i) => i.code === '520')?.sources.join(' ')).toContain(
      'bl-2025-wegleitung p. 28',
    );
  });
});

describe('H2: married, two earners, two children, Allschwil, 2026, Roman Catholic', () => {
  // Person 1: 120,000 - 7,680 - 9,000 = 103,320 (100). 500: car, no usable public transport,
  // 12 km x 2 x 220 days x 0.75 = 3,960. 510: canteen, 200 days x 7.50 = 1,500. 520: 500.
  // 610: 7,258.
  // Person 2: 60,000 - 3,840 - 3,000 = 53,160 (105). 505: 1,032. 525: 500. 615: 6,330.
  // 300: 2,000. 555: 1,500 (at most 2,000 + 50,000). 620: 4,000. 630: 2 x 450 = 900.
  // 640: 12,000 for the younger child, at most 10,000. 680: the lower earned income, at most 1,000.
  // 499: 103,320 + 53,160 + 2,000 = 158,480. 789: 3,960 + 1,500 + 500 + 7,258 + 1,032 + 500 +
  // 6,330 + 1,500 + 4,000 + 900 + 10,000 + 1,000 = 38,480. 790: 120,000.
  // Tariff with Vollsplitting, 2026 at 120,000: 9,820.75. Child reduction 2 x 750 = 1,500: the
  // normal state tax on income 8,320.75. Allschwil 58 %: 4,826.035, to 5 centimes 4,826.05.
  // 800: 300,000; 891: -40,000; 899: 260,000; 900: -180,000; 910: 80,000. Wealth tax 1.1 per
  // mille: 88.00; Allschwil 58 %: 51.04, to 5 centimes 51.05.
  // Church, Roman Catholic, Allschwil 8 % of the state tax (8,320.75 + 88 = 8,408.75): 672.70.
  // Total 8,320.75 + 4,826.05 + 88 + 51.05 + 672.70 = 13,958.55.
  const input: BlEngineInput = {
    taxYear: 2026,
    commune: 'Allschwil',
    civilStatus: 'married',
    church: { p1: 'catholic', p2: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(120_000),
            socialContributions: amt(7_680),
            pensionFund: amt(9_000),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 12, days: 220 },
        mealDays: 200,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(3_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        pillar3a: amt(6_330),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', under14: true },
    ],
    household: { debtInterest: amt(1_500), debts: amt(40_000) },
    movable: [{ owner: 'household', value: amt(300_000), income: amt(2_000) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(103_320));
    expect(find(r, '105', 'p2')).toBe(chf(53_160));
    expect(find(r, '500', 'p1')).toBe(chf(-3_960));
    expect(find(r, '510', 'p1')).toBe(chf(-1_500));
    expect(find(r, '520', 'p1')).toBe(chf(-500));
    expect(find(r, '505', 'p2')).toBe(chf(-1_032));
    expect(find(r, '525', 'p2')).toBe(chf(-500));
    expect(find(r, '610', 'p1')).toBe(chf(-7_258));
    expect(find(r, '615', 'p2')).toBe(chf(-6_330));
    expect(find(r, '555')).toBe(chf(-1_500));
    expect(find(r, '620')).toBe(chf(-4_000));
    expect(find(r, '630')).toBe(chf(-900));
    expect(find(r, '640')).toBe(chf(-10_000));
    expect(find(r, '680')).toBe(chf(-1_000));
    expect(r.icc?.grossIncome.amount).toBe(chf(158_480));
    expect(r.icc?.taxableIncome.amount).toBe(chf(120_000));
    expect(r.icc?.splitting).toBe(true);
    expect(r.icc?.rateIncome.amount).toBe(chf(60_000));
    expect(wealth(r, '891')).toBe(chf(-40_000));
    expect(wealth(r, '900')).toBe(chf(-180_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(80_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(9_820.75));
    expect(x.childReduction.amount).toBe(chf(-1_500));
    expect(x.normalIncome.amount).toBe(chf(8_320.75));
    expect(x.cantonalIncome.amount).toBe(chf(8_320.75));
    expect(x.communalIncome.amount).toBe(chf(4_826.05));
    expect(x.cantonalWealth.amount).toBe(chf(88));
    expect(x.communalWealth.amount).toBe(chf(51.05));
    expect(x.church?.amount).toBe(chf(672.7));
    expect(r.total).toBe(chf(13_958.55));
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.churchBase]);
    expect(r.assumptions).toContainEqual(NOTE.childrenAtCharge);
    expect(r.notCounted).not.toContainEqual(NOTE.churchNotAsked);
  });
});

describe('H3: single parent, Reinach, 2025, one child, child support received', () => {
  // 100: 80,000 - 5,120 - 4,000 = 70,880. 320: 9,600. 499: 80,480.
  // 500: bike, the flat 700. 520: 500. 610: 4,000. 625: 2,000; 630: 450 (one child with the child
  // reduction). 640: 6,000 (at most 10,000). 650: 1,830 (at most 12,000).
  // 789: 700 + 500 + 4,000 + 2,000 + 450 + 6,000 + 1,830 = 15,480. 790: 65,000.
  // A parent with a child in the household who gets the child reduction: Vollsplitting. Tariff with
  // Vollsplitting, 2025 at 65,000: 2,629.50. Child reduction 750: 1,879.50.
  // Reinach 54.5 %: 1,024.3275, to 5 centimes 1,024.35.
  // 800: 20,000; 900: 180,000 (single parent); 910: 0. Total 2,903.85.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Reinach',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_000) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(4_000),
        trainingCosts: amt(1_830),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(6_000) }],
    household: { childSupportReceived: amt(9_600) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(0) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(70_880));
    expect(find(r, '320')).toBe(chf(9_600));
    expect(find(r, '500', 'p1')).toBe(chf(-700));
    expect(find(r, '630')).toBe(chf(-450));
    expect(find(r, '640')).toBe(chf(-6_000));
    expect(find(r, '650')).toBe(chf(-1_830));
    expect(r.icc?.taxableIncome.amount).toBe(chf(65_000));
    expect(r.icc?.splitting).toBe(true);
    expect(wealth(r, '900')).toBe(chf(-180_000));
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(2_629.5));
    expect(x.childReduction.amount).toBe(chf(-750));
    expect(x.communalIncome.amount).toBe(chf(1_024.35));
    expect(x.cantonalWealth.amount).toBe(0);
    expect(r.total).toBe(chf(2_903.85));
    expect(r.assumptions).toContainEqual(NOTE.bikeFlat);
  });

  it('a child with taxable income of its own gives no reduction, no Vollsplitting', () => {
    const own = computeReturn({
      taxYear: 2025,
      commune: 'Reinach',
      civilStatus: 'divorced',
      people: [{ id: 'p1', employments: [{ gross: amt(80_000) }] }],
      children: [{ custody: 'full', ownIncome: true }],
    });
    expect(own.icc?.splitting).toBe(false);
    expect(own.icc?.taxes.childReduction.amount).toBe(0);
    expect(find(own, '630')).toBe(0);
    expect(own.assumptions).toContainEqual(NOTE.childOwnIncome);
  });
});

describe('H4: retiree with wealth, Binningen, 2026', () => {
  // 200: AHV 30,000. 220: pension fund 24,000. 300: 12,000. 499: 66,000.
  // 625: 2,000. 655: 1,000. 720: 3,000 in full. 789: 6,000. 790: 60,000.
  // 770: none, taxable wealth is CHF 10,000 or more (guide p. 39).
  // Tariff, single, 2026 at 60,000: 4,910.35. Binningen 49 %: 2,406.0715, to 5 centimes 2,406.05.
  // 800: 900,000; 805: 5,000; 885 = 899: 905,000; 905: -90,000; 910: 815,000.
  // Wealth tax: 150,000 x 1.1 = 165 + 200,000 x 2.9 = 580 + 465,000 x 3.3 per mille = 1,534.50:
  // 2,279.50. Binningen 49 %: 1,116.955, to 5 centimes 1,116.95.
  // No church member. Total 4,910.35 + 2,406.05 + 2,279.50 + 1,116.95 = 10,712.85.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Binningen',
    civilStatus: 'widowed',
    church: { p1: 'none' },
    people: [
      {
        id: 'p1',
        pensionAvs: amt(30_000),
        pensionKind: 'ahv',
        pensionOccupational: amt(24_000),
      },
    ],
    household: { bankFees: amt(1_000), medicalCosts: amt(3_000), cash: amt(5_000) },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(12_000) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '200', 'p1')).toBe(chf(30_000));
    expect(find(r, '220', 'p1')).toBe(chf(24_000));
    expect(find(r, '655')).toBe(chf(-1_000));
    expect(find(r, '770')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(60_000));
    expect(r.icc?.wealth.grossWealth.amount).toBe(chf(905_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(815_000));
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(4_910.35));
    expect(x.communalIncome.amount).toBe(chf(2_406.05));
    expect(x.cantonalWealth.amount).toBe(chf(2_279.5));
    expect(x.communalWealth.amount).toBe(chf(1_116.95));
    expect(x.church).toBeNull();
    expect(r.total).toBe(chf(10_712.85));
    expect(r.notCounted).toContainEqual(NOTE.pensionerWealth);
    expect(r.notCounted).not.toContainEqual(NOTE.churchNotAsked);
    expect(r.assumptions).toContainEqual(NOTE.pensions);
  });

  it('a pensioner without taxable wealth gets the pensioners’ deduction', () => {
    // 200: 28,000; 220: 4,000; 499: 32,000, at most the maximum simple AHV pension 32,760: 40 %,
    // 12,800 (770). 625: 2,000; 720: 200. 790: 17,000. Tariff, single, 2026 at 17,000: 94.30.
    // Binningen 49 %: 46.207, to 5 centimes 46.20. Savings 50,000 under the allowance: no wealth tax.
    // Total 140.50.
    const low = computeReturn({
      taxYear: 2026,
      commune: 'Binningen',
      civilStatus: 'widowed',
      people: [
        {
          id: 'p1',
          pensionAvs: amt(28_000),
          pensionKind: 'ahv',
          pensionOccupational: amt(4_000),
        },
      ],
      household: { medicalCosts: amt(200) },
      movable: [{ owner: 'p1', value: amt(50_000) }],
    });
    expect(find(low, '770')).toBe(chf(-12_800));
    expect(low.icc?.taxableIncome.amount).toBe(chf(17_000));
    expect(low.icc?.taxes.incomeTariffTax.amount).toBe(chf(94.3));
    expect(low.icc?.taxes.communalIncome.amount).toBe(chf(46.2));
    expect(low.total).toBe(chf(140.5));
    // The same with an IV pension: line 771, the IV maximum 30,240, so 40 % less 18 % (1,760
    // above it, 18 started CHF 100) = 22 %: 7,040.
    const iv = computeReturn({
      taxYear: 2026,
      commune: 'Binningen',
      civilStatus: 'widowed',
      people: [
        { id: 'p1', pensionAvs: amt(28_000), pensionKind: 'iv', pensionOccupational: amt(4_000) },
      ],
    });
    expect(find(iv, '771')).toBe(chf(-7_040));
    // 2026 needs the kind of pension; 2025 has one table for both.
    const unknown = computeReturn({
      taxYear: 2026,
      commune: 'Binningen',
      civilStatus: 'widowed',
      people: [{ id: 'p1', pensionAvs: amt(28_000) }],
    });
    expect(unknown.icc).toBeNull();
    expect(unknown.unsupported).toEqual([NOTE.pensionKind]);
    const y2025 = computeReturn({
      taxYear: 2025,
      commune: 'Binningen',
      civilStatus: 'widowed',
      people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(4_000) }],
    });
    // 2025: the maximum simple pension 30,240; 32,000 is 1,760 above: 22 %, 7,040 on line 770.
    expect(find(y2025, '770')).toBe(chf(-7_040));
  });
});

describe('H5: shared custody, Sissach, 2025, the parent who pays child support', () => {
  // 100: 95,000 - 6,080 - 5,700 = 83,220. 500: 1,032. 510: 162 days x 15 = 2,430. 520: 500.
  // 610: 7,258. 575: child support paid 12,000. 625: 2,000 (the child counts for the other parent:
  // no 630). 640: childcare paid 3,000 for the child, alternating custody (Steuerbuch 29 Nr. 5).
  // 499: 83,220. 789: 1,032 + 2,430 + 500 + 7,258 + 12,000 + 2,000 + 3,000 = 28,220. 790: 55,000.
  // No Vollsplitting, no child reduction. Tariff, single, 2025 at 55,000: 4,193.90.
  // Sissach 57 %: 2,390.523, to 5 centimes 2,390.50. Total 6,584.40.
  const base: BlEngineInput = {
    taxYear: 2025,
    commune: 'Sissach',
    civilStatus: 'divorced',
    childSupport: 'pays',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_700) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        mealDays: 162,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(3_000) }],
    household: { childSupportPaid: amt(12_000) },
  };
  const r = computeReturn(base);

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '575')).toBe(chf(-12_000));
    expect(find(r, '630')).toBe(0);
    expect(find(r, '640')).toBe(chf(-3_000));
    expect(r.icc?.taxableIncome.amount).toBe(chf(55_000));
    expect(r.icc?.splitting).toBe(false);
    expect(wealth(r, '905')).toBe(chf(-90_000));
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(4_193.9));
    expect(x.childReduction.amount).toBe(0);
    expect(x.communalIncome.amount).toBe(chf(2_390.5));
    expect(r.total).toBe(chf(6_584.4));
    expect(r.assumptions).toContainEqual(NOTE.childSupportPaid);
    expect(r.assumptions).toContainEqual(NOTE.childcareShared);
  });

  it('without child support, the parent who mainly bears the upkeep counts the child', () => {
    const none: BlEngineInput = { ...base, childSupport: 'none', household: {} };
    const ask = computeReturn(none);
    expect(ask.icc).toBeNull();
    expect(ask.unsupported).toEqual([NOTE.mainUpkeep]);
    const mine = computeReturn({ ...none, mainUpkeep: true });
    expect(mine.icc?.splitting).toBe(true);
    expect(mine.icc?.taxes.childReduction.amount).toBe(chf(-750));
    expect(find(mine, '630')).toBe(chf(-450));
    expect(wealth(mine, '900')).toBe(chf(-180_000));
    const theirs = computeReturn({ ...none, mainUpkeep: false });
    expect(theirs.icc?.splitting).toBe(false);
    expect(theirs.assumptions).toContainEqual(NOTE.mainUpkeepNo);
    const unanswered = computeReturn({ ...base, childSupport: undefined });
    expect(unanswered.unsupported).toEqual([NOTE.childSupport]);
  });
});

describe('cases the documents leave open fail closed', () => {
  const single = (over: Partial<BlEngineInput>): BlEngineInput => ({
    taxYear: 2026,
    commune: 'Liestal',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [{ gross: amt(70_000) }] }],
    ...over,
  });

  it('church tax: 2025 rates, the Reformed and Christ Catholic rules, mixed couples', () => {
    expect(
      computeReturn(single({ taxYear: 2025, church: { p1: 'catholic' } })).unsupported,
    ).toEqual([NOTE.church2025]);
    expect(computeReturn(single({ church: { p1: 'reformed' } })).unsupported).toEqual([
      NOTE.churchRules,
    ]);
    expect(computeReturn(single({ church: { p1: 'christCatholic' } })).unsupported).toEqual([
      NOTE.churchRules,
    ]);
    const couple = computeReturn(
      single({
        civilStatus: 'married',
        people: [
          { id: 'p1', employments: [{ gross: amt(70_000) }] },
          { id: 'p2', employments: [{ gross: amt(30_000) }] },
        ],
        church: { p1: 'catholic', p2: 'none' },
      }),
    );
    expect(couple.unsupported).toEqual([NOTE.churchMixed]);
    // Not a member: no church tax and nothing to ask.
    const none = computeReturn(single({ taxYear: 2025, church: { p1: 'none' } }));
    expect(none.unsupported).toEqual([]);
    expect(none.icc?.taxes.church).toBeNull();
  });

  it('self-employment, a married couple sharing custody with another parent', () => {
    const self = computeReturn(
      single({ people: [{ id: 'p1', selfEmploymentProfit: amt(50_000) }] }),
    );
    expect(self.unsupported).toEqual([NOTE.selfEmployed]);
    const shared = computeReturn(
      single({
        civilStatus: 'married',
        people: [{ id: 'p1' }, { id: 'p2' }],
        children: [{ custody: 'shared' }],
      }),
    );
    expect(shared.unsupported).toEqual([NOTE.marriedShared]);
  });

  it('Vollsplitting at the minimum rate is flagged: the Steuerbuch says otherwise', () => {
    // Married, taxable 30,000: half is 15,000, under the tax-free limit; the 2025 table prints
    // 147.00 (0.49 % of 30,000) in its Vollsplitting column.
    const r = computeReturn({
      taxYear: 2025,
      commune: 'Liestal',
      civilStatus: 'married',
      people: [{ id: 'p1', pensionOccupational: amt(34_000) }, { id: 'p2' }],
    });
    expect(r.icc?.taxableIncome.amount).toBe(chf(30_000));
    expect(r.icc?.taxes.incomeTariffTax.amount).toBe(chf(147));
    expect(r.unverifiedRules).toContainEqual(NOTE.splittingMinimum);
  });

  it('a commune or a year not in the tables throws', () => {
    expect(() => computeReturn(single({ commune: 'Basel' }))).toThrow(
      /Unknown Basel-Landschaft commune/,
    );
    expect(() => computeReturn(single({ taxYear: 2027 as 2026 }))).toThrow(/not supported/);
  });
});
