// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. The tariff tax of each
// income and wealth is the one the canton's tables print (test/tariffs.test.ts gives the pages).
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  ESTIMATE_TEXT,
  NOTE,
  type BsEngineInput,
  type BsTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: BsTaxResult, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: BsTaxResult, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, Basel, 2025, employed, savings and securities', () => {
  // 100: 92,000 - 5,888 (box 9) - 5,520 (box 10.1) = 80,592.
  // 519: actual costs: U-Abo 824 + 180 days x 15 = 2,700 + union dues 300 = 3,824; the flat amount
  // at a 100 % work rate is 4,200, higher: 4,200. 620: 7,258 with a pension fund. 631: 4,200 flat.
  // 369: gross income 60 + 1,400 = 1,460 less bank fees 120 = 1,340.
  // 499: 80,592 + 1,340 = 81,932. 699: 4,200 + 7,258 + 4,200 = 15,658. 709: 66,274.
  // 725: 5,000 less 5 % of 66,274 (3,313.70, 3,314) = 1,686. 732: 1,000 (cap 20 %, 13,255).
  // 739: 66,274 - 1,686 - 1,000 = 63,588. 767: 19,500. 799: 44,088.
  // Tariff A at 44,000: 21 % = 9,240.00. Basel: all cantonal, no communal tax.
  // 800: market value 130,000; yield value 1,460 x 345 = 503,700; mean 316,850, higher: 130,000.
  // 891: 75,000. 899: 55,000. Tariff A: 55 x 4.50 = 247.50 (5 per mille would be 275: no § 52).
  // Total 9,487.50.
  const input: BsEngineInput = {
    taxYear: 2025,
    commune: 'Basel',
    civilStatus: 'single',
    church: false,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(92_000), socialContributions: amt(5_888), pensionFund: amt(5_520) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(824),
        mealDays: 180,
        otherProfessionalCosts: amt(300),
        pillar3a: amt(7_258),
        workRate: 100,
        referenceAge: false,
      },
    ],
    household: { medicalCosts: amt(5_000), donations: amt(1_000), bankFees: amt(120) },
    movable: [
      { owner: 'p1', value: amt(60_000), income: amt(60) },
      { owner: 'p1', value: amt(70_000), income: amt(1_400) },
    ],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(80_592));
    expect(find(r, '519', 'p1')).toBe(chf(-4_200));
    expect(find(r, '620', 'p1')).toBe(chf(-7_258));
    expect(find(r, '631')).toBe(chf(-4_200));
    expect(find(r, '369')).toBe(chf(1_340));
    expect(r.icc?.grossIncome.amount).toBe(chf(81_932));
    expect(r.icc?.netIncome.amount).toBe(chf(66_274));
    expect(find(r, '725')).toBe(chf(-1_686));
    expect(find(r, '732')).toBe(chf(-1_000));
    expect(r.icc?.pureIncome.amount).toBe(chf(63_588));
    expect(find(r, '767')).toBe(chf(-19_500));
    expect(find(r, '770')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(44_088));
    expect(r.icc?.incomeTariff).toBe('A');
    expect(wealth(r, '800')).toBe(chf(130_000));
    expect(wealth(r, '891')).toBe(chf(-75_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(55_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(9_240));
    expect(x.cantonalIncome.amount).toBe(chf(9_240));
    expect(x.communalIncome.amount).toBe(0);
    expect(x.wealthTariffTax.amount).toBe(chf(247.5));
    expect(x.wealthReduction.amount).toBe(0);
    expect(x.cantonalWealth.amount).toBe(chf(247.5));
    expect(r.icc?.taxes.total.amount).toBe(chf(9_487.5));
    expect(r.commune).toEqual({ bfs: null, name: 'Basel', rate: 0 });
    // The federal tax of the Bund column is computed too (test/federal.test.ts).
    expect(r.ifd).not.toBeNull();
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    expect(r.estimates).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.assumptions).toContainEqual(NOTE.fullYear);
    expect(r.assumptions).toContainEqual(NOTE.insuranceFlat);
    expect(r.notCounted).toContainEqual(NOTE.dependents);
    expect(r.notCounted).not.toContainEqual(NOTE.church);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.incomeTariffTax.sources.join(' ')).toContain(
      'bs-2025-tariff-einkommens-vermoegenssteuer p. 3 to 5',
    );
    expect(r.icc?.items.find((i) => i.code === '519')?.sources.join(' ')).toContain(
      'bs-2025-guide-wegleitung p. 30',
    );
  });
});

describe('H2: married, two earners, two children, Riehen, 2026', () => {
  // Person 1: 120,000 - 7,680 - 9,000 = 103,320 (100). Actual costs: monthly tickets 1,032 + 200
  // days x 7.50 with a canteen = 1,500: 2,532; the flat amount at 100 %, 4,200, is higher (519).
  // Person 2: 48,000 - 3,072 - 2,400 = 42,528 (105). Works 50 %: the flat amount 4,200 x 50 % =
  // 2,100 (at least 840), higher than the bike's 824 (539).
  // 620: 7,258; 625: 4,000. 630: 8,400 flat. 660: the lower income after its costs and 3a,
  // 42,528 - 2,100 - 4,000 = 36,428: 1,100. 670: 14,000 for the 6-year-old (at most 26,000).
  // 369: 80 + 4,000 = 4,080. 550: 2,000 (at most 4,080 + 50,000).
  // 499: 103,320 + 42,528 + 4,080 = 149,928. 699: 4,200 + 2,100 + 2,000 + 7,258 + 4,000 + 8,400 +
  // 1,100 + 14,000 = 43,058. 709 = 739: 106,870. 750: 2 x 9,000 = 18,000; 760: 38,000.
  // 799: 50,870. Tariff B at 50,800: 10,668.00. Riehen: the canton 50 % = 5,334.00, the commune
  // 40 % = 4,267.20.
  // 800: market 430,000; yield value 4,080 x 345 = 1,407,600 (the 2026 factor is provisional, an
  // estimate); mean 918,800, higher: 430,000. 870: -50,000. 889: 380,000. 890: 150,000; 892:
  // 2 x 15,000 (both under 18). 899: 200,000. Tariff B: 200 x 4.50 = 900.00 (5 per mille: 1,000).
  // Riehen: the canton 450.00, the commune 46 % = 414.00. Total 5,334 + 4,267.20 + 450 + 414 =
  // 10,465.20.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Riehen',
    civilStatus: 'married',
    church: true,
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
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        mealDays: 200,
        pillar3a: amt(7_258),
        workRate: 100,
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(48_000), socialContributions: amt(3_072), pensionFund: amt(2_400) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(4_000),
        workRate: 50,
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(14_000) },
      { custody: 'full', under14: false, minor: true },
    ],
    household: { debtInterest: amt(2_000), debts: amt(50_000) },
    movable: [
      { owner: 'household', value: amt(80_000), income: amt(80) },
      { owner: 'p1', value: amt(350_000), income: amt(4_000) },
    ],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(103_320));
    expect(find(r, '105', 'p2')).toBe(chf(42_528));
    expect(find(r, '519', 'p1')).toBe(chf(-4_200));
    expect(find(r, '539', 'p2')).toBe(chf(-2_100));
    expect(find(r, '550')).toBe(chf(-2_000));
    expect(find(r, '620', 'p1')).toBe(chf(-7_258));
    expect(find(r, '625', 'p2')).toBe(chf(-4_000));
    expect(find(r, '630')).toBe(chf(-8_400));
    expect(find(r, '660')).toBe(chf(-1_100));
    expect(find(r, '670')).toBe(chf(-14_000));
    expect(r.icc?.grossIncome.amount).toBe(chf(149_928));
    expect(r.icc?.netIncome.amount).toBe(chf(106_870));
    expect(find(r, '750')).toBe(chf(-18_000));
    expect(find(r, '760')).toBe(chf(-38_000));
    expect(r.icc?.taxableIncome.amount).toBe(chf(50_870));
    expect(r.icc?.incomeTariff).toBe('B');
    expect(wealth(r, '800')).toBe(chf(430_000));
    expect(wealth(r, '870')).toBe(chf(-50_000));
    expect(wealth(r, '890')).toBe(chf(-150_000));
    expect(wealth(r, '892')).toBe(chf(-30_000));
    expect(r.icc?.wealth.netWealth.amount).toBe(chf(380_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(200_000));
    expect(r.icc?.wealth.tariff).toBe('B');
  });

  it('taxes, with Riehen’s share', () => {
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(10_668));
    expect(x.cantonalIncome.amount).toBe(chf(5_334));
    expect(x.communalIncome.amount).toBe(chf(4_267.2));
    expect(x.wealthTariffTax.amount).toBe(chf(900));
    expect(x.cantonalWealth.amount).toBe(chf(450));
    expect(x.communalWealth.amount).toBe(chf(414));
    expect(r.icc?.taxes.total.amount).toBe(chf(10_465.2));
    expect(r.commune).toEqual({ bfs: null, name: 'Riehen', rate: 4_000 });
    expect(x.communalIncome.sources.join(' ')).toContain('bs-2026-communal-ansaetze-abzuege p. 1');
  });

  it('flags the provisional 2026 factor and leaves the church tax out', () => {
    expect(r.estimates).toEqual([
      { id: 'bs-2026-provisional', what: ESTIMATE_TEXT['bs-2026-provisional'] },
    ]);
    expect(r.icc?.wealth.items.find((i) => i.code === '800')?.estimates).toEqual([
      'bs-2026-provisional',
    ]);
    expect(r.icc?.taxes.total.estimates).toEqual(['bs-2026-provisional']);
    expect(r.notCounted).toContainEqual(NOTE.church);
    expect(r.assumptions).toContainEqual(NOTE.canteen);
  });
});

describe('H3: single parent, one child, Basel, 2025, driving to work', () => {
  // 100: 78,000 - 4,992 - 4,680 = 68,328. 519: driving, public transport unreasonable: 12 km x 2 x
  // 200 days x 0.70 = 3,360, at most 3,200; lunch 200 x 15 = 3,000; actual 6,200, higher than the
  // flat 4,200 (work rate 80 %, above 60 %: whole): 6,200. 620: 5,000. 631: 4,200. 670: 12,000.
  // 271: child support received 7,200. 369: 10.
  // 499: 68,328 + 7,200 + 10 = 75,538. 699: 6,200 + 5,000 + 4,200 + 12,000 = 27,400. 709 = 739:
  // 48,138. 750: 9,000. 765: 32,600 (alone with the child, not cohabiting). 799: 6,538.
  // Tariff B at 6,500: 1,365.00.
  // 800: market 20,000; yield value 10 x 345 = 3,450; mean 11,725, lower: 11,725. 890: 150,000
  // (single parent). 892: 15,000 (under 14). 899: 0. No wealth tax. Total 1,365.00.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'basel',
    civilStatus: 'divorced',
    cohabiting: false,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(78_000), socialContributions: amt(4_992), pensionFund: amt(4_680) },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 12, days: 200 },
        mealDays: 200,
        pillar3a: amt(5_000),
        workRate: 80,
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(12_000) }],
    household: { childSupportReceived: amt(7_200) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(10) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100')).toBe(chf(68_328));
    expect(find(r, '519')).toBe(chf(-6_200));
    expect(find(r, '271')).toBe(chf(7_200));
    expect(find(r, '670')).toBe(chf(-12_000));
    expect(r.icc?.grossIncome.amount).toBe(chf(75_538));
    expect(r.icc?.netIncome.amount).toBe(chf(48_138));
    expect(find(r, '750')).toBe(chf(-9_000));
    expect(find(r, '765')).toBe(chf(-32_600));
    expect(find(r, '767')).toBe(0);
    expect(r.icc?.taxableIncome.amount).toBe(chf(6_538));
    expect(r.icc?.incomeTariff).toBe('B');
    expect(wealth(r, '800')).toBe(chf(11_725));
    expect(wealth(r, '890')).toBe(chf(-150_000));
    expect(wealth(r, '892')).toBe(chf(-15_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
    expect(r.icc?.wealth.tariff).toBe('A');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.incomeTariffTax.amount).toBe(chf(1_365));
    expect(r.icc?.taxes.wealthTariffTax.amount).toBe(0);
    expect(r.icc?.taxes.total.amount).toBe(chf(1_365));
    expect(r.assumptions).toContainEqual(NOTE.actualCosts);
    expect(r.assumptions).toContainEqual(NOTE.securitiesMean);
    expect(r.notCounted).toContainEqual(NOTE.church);
  });
});

describe('H4: widowed retiree with wealth, Bettingen, 2025', () => {
  // 200: 28,000; 220: 24,000 (as given). 369: 300 + 4,000 = 4,300 less bank fees 600 = 3,700.
  // 499: 55,700. 631: 4,200. 709: 51,500. 725: 6,000 less 5 % of 51,500 (2,575) = 3,425. 732:
  // 2,000 (cap 10,300). 739: 46,075. 767: 19,500; 770: 3,500 (reached the reference age).
  // 799: 23,075. Tariff A at 23,000: 4,830.00. Bettingen: the canton 50 % = 2,415.00; the commune
  // 37.5 % = 1,811.25.
  // 800: market 350,000; yield value 4,300 x 345 = 1,483,500; mean 916,750, higher: 350,000. 815:
  // 40,000. 835: 10,000. 869 = 889: 400,000. 891: 75,000. 899: 325,000. Tariff A: 250 x 4.50 +
  // 75 x 6.50 = 1,612.50, under 5 per mille (1,625): no § 52. No § 51 (income above 14,000).
  // Bettingen: the canton 806.25; the commune 36.5 % = 588.5625, to 5 centimes 588.55.
  // Total 2,415 + 1,811.25 + 806.25 + 588.55 = 5,621.05.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Bettingen',
    civilStatus: 'widowed',
    church: false,
    people: [
      {
        id: 'p1',
        pensionAvs: amt(28_000),
        pensionOccupational: amt(24_000),
        referenceAge: true,
      },
    ],
    household: {
      medicalCosts: amt(6_000),
      donations: amt(2_000),
      bankFees: amt(600),
      lifeInsuranceValue: amt(40_000),
      cash: amt(10_000),
    },
    movable: [
      { owner: 'p1', value: amt(150_000), income: amt(300) },
      { owner: 'p1', value: amt(200_000), income: amt(4_000) },
    ],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '200')).toBe(chf(28_000));
    expect(find(r, '220')).toBe(chf(24_000));
    expect(find(r, '369')).toBe(chf(3_700));
    expect(r.icc?.grossIncome.amount).toBe(chf(55_700));
    expect(r.icc?.netIncome.amount).toBe(chf(51_500));
    expect(find(r, '725')).toBe(chf(-3_425));
    expect(find(r, '732')).toBe(chf(-2_000));
    expect(find(r, '767')).toBe(chf(-19_500));
    expect(find(r, '770')).toBe(chf(-3_500));
    expect(r.icc?.taxableIncome.amount).toBe(chf(23_075));
    expect(wealth(r, '800')).toBe(chf(350_000));
    expect(wealth(r, '815')).toBe(chf(40_000));
    expect(wealth(r, '835')).toBe(chf(10_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(325_000));
  });

  it('taxes, with Bettingen’s share', () => {
    const x = r.icc!.taxes;
    expect(x.incomeTariffTax.amount).toBe(chf(4_830));
    expect(x.cantonalIncome.amount).toBe(chf(2_415));
    expect(x.communalIncome.amount).toBe(chf(1_811.25));
    expect(x.wealthTariffTax.amount).toBe(chf(1_612.5));
    expect(x.wealthReduction.amount).toBe(0);
    expect(x.cantonalWealth.amount).toBe(chf(806.25));
    expect(x.communalWealth.amount).toBe(chf(588.55));
    expect(r.icc?.taxes.total.amount).toBe(chf(5_621.05));
    expect(r.commune).toEqual({ bfs: null, name: 'Bettingen', rate: 3_750 });
    expect(r.assumptions).toContainEqual(NOTE.pensions);
  });
});

describe('H5: shared custody without child support, Basel, 2026', () => {
  // 100: 85,000 - 5,440 - 5,100 = 74,460. 519: the flat 4,200 (the ticket, 824, is less). 620:
  // 7,258. 631: 4,200. 670: 9,000 (half the limit is 13,000: every reading allows it). 369: 25.
  // 499: 74,485. 699: 4,200 + 7,258 + 4,200 + 9,000 = 24,658. 709 = 739: 49,827.
  // 750: half the child deduction, 4,500 (StG § 35 al. 1 lit. a). 765: 32,600 (lives with the child,
  // mainly bears its upkeep, not cohabiting). 799: 12,727. Tariff B at 12,700: 2,667.00.
  // 800: market 25,000; yield value 25 x 345 = 8,625; mean 16,812.50, cut to 16,812, lower.
  // 890: 150,000. 892 is not settled (whole or half for a shared child), but 899 is 0 either way:
  // the line is left out. No wealth tax. Total 2,667.00.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Basel',
    civilStatus: 'divorced',
    childSupport: 'none',
    ifdParentalScale: true,
    mainUpkeep: true,
    cohabiting: false,
    church: false,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(824),
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(9_000) }],
    movable: [{ owner: 'p1', value: amt(25_000), income: amt(25) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '519')).toBe(chf(-4_200));
    expect(find(r, '670')).toBe(chf(-9_000));
    expect(r.icc?.netIncome.amount).toBe(chf(49_827));
    expect(find(r, '750')).toBe(chf(-4_500));
    expect(find(r, '765')).toBe(chf(-32_600));
    expect(r.icc?.taxableIncome.amount).toBe(chf(12_727));
    expect(r.icc?.incomeTariff).toBe('B');
    expect(wealth(r, '800')).toBe(chf(16_812));
    expect(wealth(r, '892')).toBe(0);
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
  });

  it('taxes', () => {
    expect(r.icc?.taxes.incomeTariffTax.amount).toBe(chf(2_667));
    expect(r.icc?.taxes.total.amount).toBe(chf(2_667));
    expect(r.assumptions).toContainEqual(NOTE.sharedHalf);
    expect(r.estimates.map((e) => e.id)).toEqual(['bs-2026-provisional']);
  });

  it('without the answer on the upkeep, the tax is not computed', () => {
    const q = computeReturn({
      taxYear: 2026,
      commune: 'Basel',
      civilStatus: 'divorced',
      childSupport: 'none',
      cohabiting: false,
      people: [{ id: 'p1', employments: [{ gross: amt(85_000) }], workRate: 100 }],
      children: [{ custody: 'shared' }],
    });
    expect(q.total).toBeNull();
    expect(q.unsupported).toEqual([NOTE.mainUpkeep]);
  });

  it('without mainly bearing the upkeep: tariff A, the deduction for everyone else', () => {
    // 767 instead of 765: 49,827 - 4,500 - 19,500 = 25,827; tariff A at 25,800: 5,418.00. The
    // allowance is 75,000 (891).
    const q = computeReturn({
      taxYear: 2026,
      commune: 'Basel',
      civilStatus: 'divorced',
      childSupport: 'none',
      ifdParentalScale: false,
      mainUpkeep: false,
      cohabiting: false,
      church: false,
      people: [
        {
          id: 'p1',
          employments: [
            { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
          ],
          commuteMode: { by: 'public_transport' },
          commuteCost: amt(824),
          pillar3a: amt(7_258),
          workRate: 100,
          referenceAge: false,
        },
      ],
      children: [{ custody: 'shared', under14: true, childcare: amt(9_000) }],
      movable: [{ owner: 'p1', value: amt(25_000), income: amt(25) }],
    });
    expect(q.unsupported).toEqual([]);
    expect(find(q, '767')).toBe(chf(-19_500));
    expect(find(q, '765')).toBe(0);
    expect(q.icc?.taxableIncome.amount).toBe(chf(25_827));
    expect(q.icc?.incomeTariff).toBe('A');
    expect(q.icc?.taxes.incomeTariffTax.amount).toBe(chf(5_418));
    expect(wealth(q, '891')).toBe(chf(-75_000));
  });
});
