// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes. Each household's taxable
// income was chosen to land on a row the canton's tariff table prints (sg-<year>-tariff-einkommen-
// vermoegen), so its einfache Steuer is read in the table, not computed: the row and its page are
// in the comment. The cantonal, communal and church taxes are rounded to the nearest 5 centimes
// (NOTE.rounding). Communal and church rates: sg-<year>-communal-steuerfuesse.
import { describe, expect, it } from 'vitest';
import {
  allLines,
  computeReturn,
  NOTE,
  type SgEngineInput,
  type SgTaxResult,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: SgTaxResult, code: string, person?: string) =>
  r.icc?.items
    .filter((i) => i.code === code && (!person || i.person === person))
    .reduce((s, i) => s + i.amount, 0);
const wealth = (r: SgTaxResult, code: string) =>
  r.icc?.wealth.items.filter((i) => i.code === code).reduce((s, i) => s + i.amount, 0);

describe('H1: single, St. Gallen, 2025, employed, securities, Evangelical Reformed', () => {
  // 1.1 (100): 92,000 - 5,888 (box 9) - 4,600 (box 10.1) = 81,512. 4.1 (146): 400. 168: 81,912.
  // Form 4: 406 the public transport pass, 1,200 (at most 8,000); 408: 200 days x 15 = 3,000 (at
  // most 3,200); 416: 700 + 10 % of 81,512 = 8,851, at most 2,400.
  // 208: 7,258 (with a pension fund). 600: premiums 4,200 + savings interest 50 = 4,250, at most
  // 3,400 (single, a pension fund: no extra; no child).
  // 230: 1,200 + 3,000 + 2,400 + 7,258 + 3,400 = 17,258. 234 (Nettoeinkommen): 64,654.
  // 240: costs 2,000 less 2 % of 64,654 = 1,293.08, to the franc 1,293: 707.
  // 244: 1,247, at most 20 % of 64,654 = 12,931: 1,247. 248: 64,654 - 707 - 1,247 = 62,700.
  // 268: 62,700. Tariff 2025, single, 62,700 (p. 12): 3,590.00.
  // Canton 105 %: 3,769.50. St. Gallen 138 %: 4,954.20.
  // 300: 150,000; 330: -75,000; 338: 75,000. Wealth 1.7 per mille: 127.50. Canton: 133.875, to
  // 5 centimes 133.90; St. Gallen: 175.95.
  // Church, Evangelisch, St. Gallen Tablat (O) 25 %: (3,590 + 127.50) x 25 % = 929.375, 929.40.
  // Total: 3,769.50 + 4,954.20 + 133.90 + 175.95 + 929.40 = 9,962.95.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'St. Gallen',
    civilStatus: 'single',
    church: { p1: 'reformed', area: 'St. Gallen Tablat (O)' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(92_000), socialContributions: amt(5_888), pensionFund: amt(4_600) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: {
      healthPremiums: amt(4_200),
      savingsInterest: amt(50),
      medicalCosts: amt(2_000),
      donations: amt(1_247),
    },
    movable: [{ owner: 'p1', value: amt(150_000), income: amt(400) }],
  });

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(81_512));
    expect(find(r, '146')).toBe(chf(400));
    expect(find(r, '406', 'p1')).toBe(chf(-1_200));
    expect(find(r, '408', 'p1')).toBe(chf(-3_000));
    expect(find(r, '416', 'p1')).toBe(chf(-2_400));
    expect(find(r, '208', 'p1')).toBe(chf(-7_258));
    expect(find(r, '600')).toBe(chf(-3_400));
    expect(find(r, '240')).toBe(chf(-707));
    expect(find(r, '244')).toBe(chf(-1_247));
    expect(r.icc?.grossIncome.amount).toBe(chf(81_912));
    expect(r.icc?.totalDeductions.amount).toBe(chf(17_258));
    expect(r.icc?.netIncomeBase.amount).toBe(chf(64_654));
    expect(r.icc?.netIncome.amount).toBe(chf(62_700));
    expect(r.icc?.taxableIncome.amount).toBe(chf(62_700));
    expect(r.icc?.splitting).toBe(false);
    expect(wealth(r, '300')).toBe(chf(150_000));
    expect(wealth(r, '330')).toBe(chf(-75_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(75_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(3_590));
    expect(x.cantonalIncome.amount).toBe(chf(3_769.5));
    expect(x.communalIncome.amount).toBe(chf(4_954.2));
    expect(x.simpleWealth.amount).toBe(chf(127.5));
    expect(x.cantonalWealth.amount).toBe(chf(133.9));
    expect(x.communalWealth.amount).toBe(chf(175.95));
    expect(x.church?.amount).toBe(chf(929.4));
    expect(x.churchShares).toEqual([
      {
        person: 'household',
        confession: 'reformed',
        area: 'St. Gallen Tablat (O)',
        rate: 2_500,
        share: 100,
      },
    ]);
    expect(r.total).toBe(chf(9_962.95));
    expect(r.commune).toEqual({ bfs: null, name: 'St. Gallen', rate: 13_800 });
    expect(r.ifd).toBeNull();
    expect(r.estimates).toEqual([]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
    expect(r.assumptions).toContainEqual(NOTE.wholeYear);
    expect(r.notCounted).toContainEqual(NOTE.fireLevy);
  });

  it('every line cites its sources', () => {
    for (const l of allLines(r)) expect(l.sources.length, l.label.en).toBeGreaterThan(0);
    expect(r.icc?.taxes.simpleIncome.sources.join(' ')).toContain(
      'sg-2025-law-steuergesetz Art. 50 Abs. 1',
    );
    expect(r.icc?.taxes.cantonalIncome.sources.join(' ')).toContain(
      'sg-2026-tariff-kantonssteuerfuss p. 1',
    );
    expect(r.icc?.items.find((i) => i.code === '416')?.sources.join(' ')).toContain(
      'sg-na-law-steuerverordnung Art. 21',
    );
  });

  it('St. Gallen’s areas levy different Evangelical rates: without the area, not computed', () => {
    const x = computeReturn({
      taxYear: 2025,
      commune: 'St. Gallen',
      civilStatus: 'single',
      church: { p1: 'reformed' },
      people: [{ id: 'p1', pensionAvs: amt(20_000) }],
    });
    expect(x.icc).toBeNull();
    expect(x.unsupported[0]?.en).toContain('St. Gallen Straubenzell (W)');
    // The Catholic rate is the same in the three areas: no area needed.
    const y = computeReturn({
      taxYear: 2025,
      commune: 'St. Gallen',
      civilStatus: 'single',
      church: { p1: 'catholic' },
      people: [{ id: 'p1', pensionAvs: amt(20_000) }],
    });
    expect(y.icc?.taxes.churchShares[0]?.rate).toBe(2_600);
  });
});

describe('H2: married, two earners, two children, Rapperswil-Jona, 2026, Catholic', () => {
  // Person 1: 130,000 - 8,320 - 9,100 = 112,580 (100). 406: car, no usable public transport,
  // 15 km x 2 x 220 days x 0.75 = 4,950. 410: canteen, 200 days x 7.50 = 1,500 (at most 1,600).
  // 416: 700 + 11,258 = 11,958, at most 2,400. 208: 7,258.
  // Person 2: 60,000 - 3,840 - 2,700 = 53,460 (102). 456: 1,100. 466: 700 + 5,346, at most 2,400.
  // 210: 7,258. 224: training 2,574 (at most 13,000).
  // 146: 1,000. 168: 112,580 + 53,460 + 1,000 = 167,040.
  // 500: 2,000 (at most 1,000 + 50,000). 600: premiums 11,000, at most 6,800 + 2 x 1,100 = 9,000.
  // 258: 18,000 + 6,000 (each at most 26,800, both under 14, both of you work) = 24,000.
  // 555: 500 (at most 21,400). 226: 500.
  // 230: 4,950 + 1,500 + 2,400 + 7,258 + 1,100 + 2,400 + 7,258 + 2,574 + 2,000 + 9,000 + 24,000
  // + 500 + 500 = 65,440. 234 = 248: 101,600. 252: 7,600; 254: 10,800. 268: 83,200.
  // Tariff 2026 with Vollsplitting, 83,200 (p. 16): 3,744.00 (the rate of 41,600, 4.5 %).
  // Canton 105 %: 3,931.20. Rapperswil-Jona 74 %: 2,770.56, to 5 centimes 2,770.55.
  // 300: 250,000; 504: -30,000; 326: 220,000; 332: -150,000; 334: 2 x -20,000; 338: 30,000.
  // Wealth: 51.00; canton 53.55; Rapperswil-Jona 37.74, 37.75.
  // Church, Katholisch 19 %: (3,744 + 51) x 19 % = 721.05.
  // Total: 3,931.20 + 2,770.55 + 53.55 + 37.75 + 721.05 = 7,514.10.
  const input: SgEngineInput = {
    taxYear: 2026,
    commune: 'Rapperswil-Jona',
    civilStatus: 'married',
    church: { p1: 'catholic', p2: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(130_000),
            socialContributions: amt(8_320),
            pensionFund: amt(9_100),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 220 },
        mealDays: 200,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(2_700) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_100),
        pillar3a: amt(7_258),
        trainingCosts: amt(2_574),
      },
    ],
    children: [
      { custody: 'full', stage: 'preschool', under14: true, childcare: amt(18_000) },
      { custody: 'full', stage: 'school', minor: true, under14: true, childcare: amt(6_000) },
    ],
    household: {
      healthPremiums: amt(11_000),
      debtInterest: amt(2_000),
      debts: amt(30_000),
      politicalParty: amt(500),
    },
    movable: [{ owner: 'household', value: amt(250_000), income: amt(1_000) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '100', 'p1')).toBe(chf(112_580));
    expect(find(r, '102', 'p2')).toBe(chf(53_460));
    expect(find(r, '406', 'p1')).toBe(chf(-4_950));
    expect(find(r, '410', 'p1')).toBe(chf(-1_500));
    expect(find(r, '416', 'p1')).toBe(chf(-2_400));
    expect(find(r, '456', 'p2')).toBe(chf(-1_100));
    expect(find(r, '466', 'p2')).toBe(chf(-2_400));
    expect(find(r, '208', 'p1')).toBe(chf(-7_258));
    expect(find(r, '210', 'p2')).toBe(chf(-7_258));
    expect(find(r, '224', 'p2')).toBe(chf(-2_574));
    expect(find(r, '500')).toBe(chf(-2_000));
    expect(find(r, '600')).toBe(chf(-9_000));
    expect(find(r, '258')).toBe(chf(-24_000));
    expect(find(r, '555')).toBe(chf(-500));
    expect(find(r, '226')).toBe(chf(-500));
    expect(find(r, '252')).toBe(chf(-7_600));
    expect(find(r, '254')).toBe(chf(-10_800));
    expect(r.icc?.grossIncome.amount).toBe(chf(167_040));
    expect(r.icc?.totalDeductions.amount).toBe(chf(65_440));
    expect(r.icc?.netIncome.amount).toBe(chf(101_600));
    expect(r.icc?.taxableIncome.amount).toBe(chf(83_200));
    expect(r.icc?.splitting).toBe(true);
    expect(r.icc?.rateIncome.amount).toBe(chf(41_600));
    expect(wealth(r, '332')).toBe(chf(-150_000));
    expect(wealth(r, '334')).toBe(chf(-40_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(30_000));
  });

  it('taxes', () => {
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(3_744));
    expect(x.cantonalIncome.amount).toBe(chf(3_931.2));
    expect(x.communalIncome.amount).toBe(chf(2_770.55));
    expect(x.simpleWealth.amount).toBe(chf(51));
    expect(x.cantonalWealth.amount).toBe(chf(53.55));
    expect(x.communalWealth.amount).toBe(chf(37.75));
    expect(x.church?.amount).toBe(chf(721.05));
    expect(r.total).toBe(chf(7_514.1));
  });

  it('a mixed marriage: half to each spouse’s church (StV Art. 2 Abs. 1)', () => {
    // Katholisch 19 % and Evangelisch 20 %: 3,795 x 19 % x 50 % = 360.525, 360.55; 3,795 x 20 %
    // x 50 % = 379.50. Together 740.05.
    const m = computeReturn({ ...input, church: { p1: 'catholic', p2: 'reformed' } });
    expect(m.icc?.taxes.churchShares.map((s) => [s.person, s.rate, s.share])).toEqual([
      ['p1', 1_900, 50],
      ['p2', 2_000, 50],
    ]);
    expect(m.icc?.taxes.church?.amount).toBe(chf(740.05));
    expect(m.assumptions).toContainEqual(NOTE.churchMixed);
    // Only one member: half the Catholic rate, the ordinance silent on the other half.
    const one = computeReturn({ ...input, church: { p1: 'catholic', p2: 'none' } });
    expect(one.icc?.taxes.church?.amount).toBe(chf(360.55));
    expect(one.unverifiedRules).toContainEqual(NOTE.churchHalfNone);
    // Christ Catholic: one rate for the canton, 24 %: 3,795 x 24 % = 910.80.
    const cc = computeReturn({
      ...input,
      church: { p1: 'christ_catholic', p2: 'christ_catholic' },
    });
    expect(cc.icc?.taxes.church?.amount).toBe(chf(910.8));
  });
});

describe('H3: single parent, Wil, 2025, child support received', () => {
  // 100: 75,000 - 4,800 - 3,750 = 66,450. 146: 20. 156: child support 9,600. 168: 76,070.
  // 406: 900. 416: 700 + 6,645, at most 2,400. 208: 5,070 (with a pension fund).
  // 600: premiums 5,600 less the subsidy 1,200 = 4,400, at most 3,400 + 1,100 (one child) = 4,500.
  // 258: childcare 4,000 (under 14, lives with you, you work).
  // 230: 900 + 2,400 + 5,070 + 4,400 + 4,000 = 16,770. 234 = 248: 59,300. 254: 10,800.
  // 268: 48,500. Vollsplitting (Art. 50 Abs. 4): the rate of 24,200 (half, rounded down to 100).
  // Tariff 2025 with Vollsplitting, 48,500 (p. 9): 1,346.80.
  // Canton 105 %: 1,414.14, to 5 centimes 1,414.15. Wil 115 %: 1,548.82, 1,548.80.
  // 300: 20,000; 330: -75,000; 334: -20,000; 338: 0. No wealth tax. No church tax asked for.
  // Total: 1,414.15 + 1,548.80 = 2,962.95.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Wil',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(75_000), socialContributions: amt(4_800), pensionFund: amt(3_750) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(900),
        pillar3a: amt(5_070),
      },
    ],
    children: [{ custody: 'full', stage: 'school', minor: true, childcare: amt(4_000) }],
    household: {
      childSupportReceived: amt(9_600),
      healthPremiums: amt(5_600),
      healthSubsidy: amt(1_200),
    },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '156')).toBe(chf(9_600));
    expect(find(r, '600')).toBe(chf(-4_400));
    expect(find(r, '258')).toBe(chf(-4_000));
    expect(find(r, '254')).toBe(chf(-10_800));
    expect(r.icc?.grossIncome.amount).toBe(chf(76_070));
    expect(r.icc?.taxableIncome.amount).toBe(chf(48_500));
    expect(r.icc?.splitting).toBe(true);
    expect(r.icc?.rateIncome.amount).toBe(chf(24_200));
    expect(wealth(r, '334')).toBe(chf(-20_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(0);
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(1_346.8));
    expect(x.cantonalIncome.amount).toBe(chf(1_414.15));
    expect(x.communalIncome.amount).toBe(chf(1_548.8));
    expect(x.simpleWealth.amount).toBe(0);
    expect(x.church).toBeNull();
    expect(r.total).toBe(chf(2_962.95));
    expect(r.notCounted).toContainEqual(NOTE.churchNotAsked);
    expect(r.icc?.rateIncome.sources.join(' ')).toContain(
      'sg-2025-law-steuergesetz Art. 50 Abs. 3 and 4',
    );
  });
});

describe('H4: retiree with wealth, Gossau, 2026, Catholic', () => {
  // 126: AHV 28,000. 130: pension fund 36,000. 146: 18,000. 168: 82,000.
  // 600: premiums 6,200, at most 3,400 + 500 (no pension fund or pillar 3a deducted) = 3,900.
  // 220: costs of managed securities 1,800. 230: 5,700. 234: 76,300.
  // 240: costs 4,500 less 2 % of 76,300 = 1,526: 2,974. 244: 3,026 (at most 15,260).
  // 248 = 268: 76,300 - 2,974 - 3,026 = 70,300. Tariff 2026, single, 70,300 (p. 14): 4,288.00.
  // Canton 105 %: 4,502.40. Gossau 116 %: 4,974.08, to 5 centimes 4,974.10.
  // 300: 1,200,000; 302: 5,000; 304: 80,000; 322 = 326: 1,285,000; 330: -75,000;
  // 338: 1,210,000. Wealth 1.7 per mille: 2,057.00; canton 2,159.85; Gossau 2,386.12, 2,386.10.
  // Church, Katholisch, the area Gossau 20 % (Arnegg (Andwil) has 19 %): (4,288 + 2,057) x 20 %
  // = 1,269.00.
  // Total: 4,502.40 + 4,974.10 + 2,159.85 + 2,386.10 + 1,269.00 = 15,291.45.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Gossau',
    civilStatus: 'widowed',
    church: { p1: 'catholic', area: 'Gossau' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(36_000) }],
    household: {
      healthPremiums: amt(6_200),
      bankFees: amt(1_800),
      medicalCosts: amt(4_500),
      donations: amt(3_026),
      cash: amt(5_000),
      lifeInsuranceValue: amt(80_000),
    },
    movable: [{ owner: 'p1', value: amt(1_200_000), income: amt(18_000) }],
  });

  it('lines and taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(find(r, '126', 'p1')).toBe(chf(28_000));
    expect(find(r, '130', 'p1')).toBe(chf(36_000));
    expect(find(r, '600')).toBe(chf(-3_900));
    expect(find(r, '220')).toBe(chf(-1_800));
    expect(find(r, '240')).toBe(chf(-2_974));
    expect(find(r, '244')).toBe(chf(-3_026));
    expect(r.icc?.netIncomeBase.amount).toBe(chf(76_300));
    expect(r.icc?.taxableIncome.amount).toBe(chf(70_300));
    expect(r.icc?.wealth.grossWealth.amount).toBe(chf(1_285_000));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(1_210_000));
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(4_288));
    expect(x.cantonalIncome.amount).toBe(chf(4_502.4));
    expect(x.communalIncome.amount).toBe(chf(4_974.1));
    expect(x.simpleWealth.amount).toBe(chf(2_057));
    expect(x.cantonalWealth.amount).toBe(chf(2_159.85));
    expect(x.communalWealth.amount).toBe(chf(2_386.1));
    expect(x.church?.amount).toBe(chf(1_269));
    expect(r.total).toBe(chf(15_291.45));
    expect(r.assumptions).toContainEqual(NOTE.pensions);
    expect(r.unverifiedRules).toEqual([NOTE.rounding, NOTE.insuranceExtra]);
  });

  it('Gossau’s Catholic areas differ: the area is needed; Arnegg’s rate carries footnote 4', () => {
    const base = {
      taxYear: 2026 as const,
      commune: 'Gossau',
      civilStatus: 'widowed' as const,
      people: [{ id: 'p1' as const, pensionAvs: amt(28_000) }],
    };
    expect(computeReturn({ ...base, church: { p1: 'catholic' } }).unsupported).toHaveLength(1);
    const arnegg = computeReturn({ ...base, church: { p1: 'catholic', area: 'Arnegg (Andwil)' } });
    expect(arnegg.icc?.taxes.churchShares[0]?.rate).toBe(1_900);
    expect(arnegg.unverifiedRules).toContainEqual(NOTE.churchFootnote4);
    // The Evangelical rate is 23 % in both areas: no area needed.
    const ev = computeReturn({ ...base, church: { p1: 'reformed' } });
    expect(ev.icc?.taxes.churchShares[0]?.rate).toBe(2_300);
  });
});

describe('H5: shared custody, Rorschach, 2025, no child support, Catholic', () => {
  // You and the other parent share custody, neither pays child support, and you mainly bear the
  // child's upkeep (StG Art. 48 Abs. 1 lit. a): the child counts for you.
  // 100: 58,000 - 3,712 - 2,320 = 51,968. 168: 51,968.
  // 406: 800. 408: 100 days x 15 = 1,500. 416: 700 + 5,197, at most 2,400. 208: 3,068.
  // 600: premiums 3,000 (at most 3,400 + 1,100). 258: childcare 9,000 (the child counts for you).
  // 230: 800 + 1,500 + 2,400 + 3,068 + 3,000 + 9,000 = 19,768. 234 = 248: 32,200.
  // 252: 7,600 (not yet of school age). 268: 24,600. Vollsplitting: the rate of 12,300.
  // Tariff 2025 with Vollsplitting, 24,600 (p. 4): 56.00.
  // Canton 105 %: 58.80. Rorschach 129 %: 72.24, to 5 centimes 72.25.
  // Wealth: 30,000 - 75,000 - 20,000: 0.
  // Church, Katholisch 22 %: 56 x 22 % = 12.32, 12.30. Total: 58.80 + 72.25 + 12.30 = 143.35.
  const input: SgEngineInput = {
    taxYear: 2025,
    commune: 'Rorschach',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainUpkeep: true,
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(58_000), socialContributions: amt(3_712), pensionFund: amt(2_320) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 100,
        pillar3a: amt(3_068),
      },
    ],
    children: [{ custody: 'shared', stage: 'preschool', under14: true, childcare: amt(9_000) }],
    household: { healthPremiums: amt(3_000) },
    movable: [{ owner: 'p1', value: amt(30_000) }],
  };

  it('the child counts for you: lines and taxes', () => {
    const r = computeReturn(input);
    expect(r.unsupported).toEqual([]);
    expect(find(r, '258')).toBe(chf(-9_000));
    expect(find(r, '252')).toBe(chf(-7_600));
    expect(r.icc?.netIncome.amount).toBe(chf(32_200));
    expect(r.icc?.taxableIncome.amount).toBe(chf(24_600));
    expect(r.icc?.splitting).toBe(true);
    const x = r.icc!.taxes;
    expect(x.simpleIncome.amount).toBe(chf(56));
    expect(x.cantonalIncome.amount).toBe(chf(58.8));
    expect(x.communalIncome.amount).toBe(chf(72.25));
    expect(x.church?.amount).toBe(chf(12.3));
    expect(r.total).toBe(chf(143.35));
    expect(r.assumptions).toContainEqual(NOTE.mainUpkeepYes);
  });

  it('you pay child support: you deduct it, the child counts for the other parent', () => {
    const r = computeReturn({
      ...input,
      childSupport: 'pays',
      household: { ...input.household, childSupportPaid: amt(7_200) },
    });
    expect(find(r, '202')).toBe(chf(-7_200));
    expect(find(r, '252')).toBe(0);
    expect(find(r, '258')).toBe(0);
    expect(r.icc?.splitting).toBe(false);
    expect(r.notCounted).toContainEqual(NOTE.childcareOtherParent);
    expect(r.assumptions).toContainEqual(NOTE.childSupportPaid);
  });

  it('without the answer on child support or on the upkeep, not computed', () => {
    expect(computeReturn({ ...input, childSupport: undefined }).unsupported).toEqual([
      NOTE.childSupport,
    ]);
    expect(computeReturn({ ...input, mainUpkeep: undefined }).unsupported).toEqual([
      NOTE.mainUpkeep,
    ]);
  });
});
