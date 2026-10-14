// Synthetic households (no real data), each derived by hand from the cited constants, line by line,
// in the comment above it. Amounts in CHF; the engine works in centimes.
import { describe, expect, it } from 'vitest';
import { computeReturn, NOTE, ZhInputError, type ZhEngineInput } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const find = (r: ReturnType<typeof computeReturn>, code: string, person?: string) =>
  r.icc?.items.find((i) => i.code === code && (!person || i.person === person))?.amount;

describe('H1: single, Zürich, 2026, employed, public transport', () => {
  // Salary: 90,000 - 5,760 (box 9) - 5,400 (box 10.1) = 78,840 (line 100).
  // Berufsauslagen: pass 800; meals 200 days x 15 = 3,000 (under 3,200); 3 % of 78,840 =
  // 2,365.20, 2,365 (between 2,000 and 4,000). Total 6,165 (line 220).
  // 3a: 7,258 paid, with a pension fund: 7,258. Insurance: 4,800 paid, single with pension fund
  // 2,900. Account: 40,000, interest 200 (line 150).
  // 199 = 78,840 + 200 = 79,040; 299 = 6,165 + 7,258 + 2,900 = 16,323; 310 = 350 = 390 = 62,717.
  // Basic tariff 2026: to 58,800, 2,638; (62,717 - 58,800) x 8 % = 313.36; simple tax 2,951.36.
  // Wealth 40,000: under the free 81,000. Staatssteuer 95 %: 2,803.792, 2,803.79. Gemeindesteuer
  // Zürich 119 %: 3,512.1184, 3,512.12. Personalsteuer 24. Total 6,339.91.
  const input: ZhEngineInput = {
    taxYear: 2026,
    commune: 261,
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(5_400) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800) },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(200) }],
  };
  const r = computeReturn(input);

  it('lines of the return', () => {
    expect(find(r, '100')).toBe(chf(78_840));
    expect(find(r, '220')).toBe(chf(-6_165));
    expect(find(r, '260')).toBe(chf(-7_258));
    expect(find(r, '270')).toBe(chf(-2_900));
    expect(find(r, '150')).toBe(chf(200));
    expect(r.icc?.grossIncome.amount).toBe(chf(79_040));
    expect(r.icc?.totalDeductions.amount).toBe(chf(-16_323));
    expect(r.icc?.taxableIncome.amount).toBe(chf(62_717));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(40_000));
    expect(r.icc?.tariff).toBe('basic');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(2_951.36));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(0);
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(2_803.79));
    expect(r.icc?.taxes.communal.amount).toBe(chf(3_512.12));
    expect(r.icc?.taxes.church).toBeNull();
    expect(r.icc?.taxes.personalTax.amount).toBe(chf(24));
    expect(r.icc?.taxes.total.amount).toBe(chf(6_339.91));
    expect(r.commune).toEqual({ bfs: 261, name: 'Zürich', rate: 119 });
    expect(r.unsupported).toEqual([]);
    // 2026: the cantonal multiplier the documents disagree on, and the rounding they don't give.
    expect(r.unverifiedRules).toEqual([NOTE.cantonalRate2026, NOTE.rounding]);
  });

  it('federal tax, the Bundessteuer column', () => {
    // The same income lines: 199 = 79,040. Berufsauslagen at the federal caps: pass 800, meals
    // 200 x 15 = 3,000, 3 % = 2,365: 6,165. 3a 7,258. Insurance: single with a pension fund, the
    // federal 1,800. 299 = 15,223; 310 = 350 = 390 = 63,817.
    expect(r.ifd?.grossIncome.amount).toBe(chf(79_040));
    expect(r.ifd?.items.find((i) => i.code === '220')?.amount).toBe(chf(-6_165));
    expect(r.ifd?.items.find((i) => i.code === '270')?.amount).toBe(chf(-1_800));
    expect(r.ifd?.taxableIncome.amount).toBe(chf(63_817));
    expect(r.ifd?.scale).toBe('single');
    expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
  });

  it('every line cites its sources', () => {
    for (const i of r.icc!.items) expect(i.sources.length, i.code).toBeGreaterThan(0);
    for (const i of r.ifd!.items) expect(i.sources.length, i.code).toBeGreaterThan(0);
    expect(r.icc?.taxes.cantonal.sources).toContain(
      'zh-2026-tariff-staatssteuerfuss-2026-2027 p. 1',
    );
  });
});

describe('H2: married, two earners, two children, Winterthur, 2025, church tax', () => {
  // Person 1: 110,000 - 7,040 - 7,700 = 95,260. Car, no usable public transport, 18 km, 220 days:
  // 18 x 2 x 220 x 0.70 = 5,544, at most 5,200. Canteen, 220 days x 7.50 = 1,650, at most 1,600.
  // 3 % of 95,260 = 2,857.80, 2,858. Berufsauslagen 5,200 + 1,600 + 2,858 = 9,658. 3a 7,258.
  // Person 2: 50,000 - 3,200 - 2,500 = 44,300. Pass 1,100; 3 % = 1,329, at least 2,000.
  // Berufsauslagen 3,100. 3a 3,000.
  // Both earn: left 95,260 - 9,658 - 7,258 = 78,344 and 44,300 - 3,100 - 3,000 = 38,200; the
  // lower is 38,200, so 6,100. Insurance: 9,600 paid; spouses 5,800 + 2 x 1,300 = 8,400.
  // Childcare: 18,000 for the younger child (under 25,000). Account 150,000, income 1,500.
  // 199 = 95,260 + 44,300 + 1,500 = 141,060.
  // 299 = 9,658 + 3,100 + 7,258 + 3,000 + 8,400 + 18,000 + 6,100 = 55,516. 310 = 85,544.
  // Donations 1,000, under 20 % of 85,544 (17,109): 350 = 84,544. Children 2 x 9,300 = 18,600:
  // 390 = 65,944. Married tariff 2025: 2,167 at 63,300; (65,944 - 63,300) x 7 % = 185.08;
  // simple tax 2,352.08. Wealth 150,000: under the free 159,000.
  // Staatssteuer 98 %: 2,305.0384, 2,305.04. Gemeindesteuer Winterthur 125 %: 2,940.10.
  // Church: reformed 13 % and catholic 17 %, half each: 6.5 % + 8.5 % = 15 %: 352.812, 352.81.
  // Personalsteuer 2 x 24 = 48. Total 2,305.04 + 2,940.10 + 352.81 + 48 = 5,645.95.
  const r = computeReturn({
    taxYear: 2025,
    commune: 230,
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
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_100),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(18_000) },
      { custody: 'full', under14: false },
    ],
    church: { p1: 'reformed', p2: 'catholic' },
    household: { healthPremiums: amt(9_600), donations: amt(1_000) },
    movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
  });

  it('lines of the return', () => {
    expect(find(r, '100')).toBe(chf(95_260));
    expect(find(r, '101')).toBe(chf(44_300));
    expect(find(r, '220')).toBe(chf(-9_658));
    expect(find(r, '240')).toBe(chf(-3_100));
    expect(find(r, '290')).toBe(chf(-6_100));
    expect(find(r, '270')).toBe(chf(-8_400));
    expect(find(r, '376')).toBe(chf(-18_000));
    expect(find(r, '324')).toBe(chf(-1_000));
    expect(find(r, '370')).toBe(chf(-18_600));
    expect(r.icc?.subtotal310.amount).toBe(chf(85_544));
    expect(r.icc?.taxableIncome.amount).toBe(chf(65_944));
    expect(r.icc?.tariff).toBe('married');
  });

  it('taxes', () => {
    expect(r.icc?.taxes.simple.amount).toBe(chf(2_352.08));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(2_305.04));
    expect(r.icc?.taxes.communal.amount).toBe(chf(2_940.1));
    expect(r.icc?.taxes.church?.amount).toBe(chf(352.81));
    expect(r.icc?.taxes.personalTax.amount).toBe(chf(48));
    expect(r.icc?.taxes.total.amount).toBe(chf(5_645.95));
  });
});

describe('H3: single parent, Uster (part 2), 2026, childcare above the limit', () => {
  // Salary 70,000 - 4,480 - 3,500 = 62,020. Bike 700; 3 % = 1,860.60, at least 2,000.
  // Berufsauslagen 2,700. 3a 4,000. Insurance 3,900 paid; single 2,900 + 1 child 1,300 = 4,200.
  // Childcare 30,000, at most 25,300. Child support received 9,600 (line 161). Interest 50.
  // 199 = 62,020 + 50 + 9,600 = 71,670; 299 = 2,700 + 4,000 + 3,900 + 25,300 = 35,900;
  // 310 = 350 = 35,770; child 9,400: 390 = 26,370. Married tariff (she lives with her child):
  // 6,400 x 2 % = 128 at 20,500; (26,370 - 20,500) x 3 % = 176.10; simple tax 304.10.
  // Staatssteuer 95 %: 288.895, 288.90. Uster has two multipliers, 112 % and 110 %; part 2:
  // 110 %, 334.51. Personalsteuer 24. Total 647.41.
  const input: ZhEngineInput = {
    taxYear: 2026,
    commune: 198,
    communeVariant: 2,
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(70_000), socialContributions: amt(4_480), pensionFund: amt(3_500) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(4_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(30_000) }],
    household: { healthPremiums: amt(3_900), childSupportReceived: amt(9_600) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(50) }],
  };
  const r = computeReturn(input);

  it('lines, tariff and taxes', () => {
    expect(find(r, '220')).toBe(chf(-2_700));
    expect(find(r, '270')).toBe(chf(-3_900));
    expect(find(r, '376')).toBe(chf(-25_300));
    expect(find(r, '161')).toBe(chf(9_600));
    expect(r.icc?.taxableIncome.amount).toBe(chf(26_370));
    expect(r.icc?.tariff).toBe('married');
    expect(r.icc?.taxes.simple.amount).toBe(chf(304.1));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(288.9));
    expect(r.icc?.taxes.communal.amount).toBe(chf(334.51));
    expect(r.icc?.taxes.total.amount).toBe(chf(647.41));
    expect(r.commune.rate).toBe(110);
  });

  it('fails closed without the part of the commune', () => {
    const rest = { ...input };
    delete rest.communeVariant;
    const missing = computeReturn(rest);
    expect(missing.icc).toBeNull();
    expect(missing.total).toBeNull();
    expect(missing.unsupported).toContainEqual(NOTE.communeVariant);
    expect(missing.commune.rate).toBeNull();
  });
});

describe('H4: retired couple, Küsnacht, 2025, wealth in the third step', () => {
  // AHV 26,000 + 19,000 (lines 130, 131), pension fund 40,000 (line 134), securities income
  // 18,000 (150): 199 = 103,000. Nobody pays into a pension fund or 3a: insurance limit
  // 5,800 x 1.5 = 8,700 (12,000 paid). 299 = 8,700; 310 = 94,300. Medical 6,000 less 5 % of
  // 94,300 (4,715) = 1,285. Donations 5,000 (under 18,860). 350 = 390 = 88,015.
  // Married tariff 2025: 2,167 at 63,300; (88,015 - 63,300) x 7 % = 1,730.05; 3,897.05.
  // Wealth 1,200,000: 159,000 free; 239,000 x 0.5 per mille = 119.50; 397,000 x 1 per mille =
  // 397; (1,200,000 - 795,000) x 1.5 per mille = 607.50; 1,124.00. Simple tax 5,021.05.
  // Staatssteuer 98 %: 4,920.629, 4,920.63. Küsnacht 73 %: 3,665.3665, 3,665.37.
  // Personalsteuer 48. Total 8,634.00.
  const r = computeReturn({
    taxYear: 2025,
    commune: 154,
    civilStatus: 'married',
    people: [
      { id: 'p1', pensionAvs: amt(26_000), pensionOccupational: amt(40_000) },
      { id: 'p2', pensionAvs: amt(19_000) },
    ],
    household: { healthPremiums: amt(12_000), medicalCosts: amt(6_000), donations: amt(5_000) },
    movable: [{ owner: 'household', value: amt(1_200_000), income: amt(18_000) }],
  });

  it('lines and taxes', () => {
    expect(find(r, '130')).toBe(chf(26_000));
    expect(find(r, '131')).toBe(chf(19_000));
    expect(find(r, '134')).toBe(chf(40_000));
    expect(find(r, '270')).toBe(chf(-8_700));
    expect(find(r, '320')).toBe(chf(-1_285));
    expect(find(r, '324')).toBe(chf(-5_000));
    expect(r.icc?.taxableIncome.amount).toBe(chf(88_015));
    expect(r.icc?.taxes.simpleIncome.amount).toBe(chf(3_897.05));
    expect(r.icc?.taxes.simpleWealth.amount).toBe(chf(1_124));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(4_920.63));
    expect(r.icc?.taxes.communal.amount).toBe(chf(3_665.37));
    expect(r.icc?.taxes.total.amount).toBe(chf(8_634));
    expect(r.assumptions).toContainEqual(NOTE.pensions100);
  });
});

describe('H5: single, high income, side job, debts, Zürich, 2026, catholic', () => {
  // Main: 320,000 - 15,000 - 25,000 = 280,000 (100). Side: 10,000 - 640 = 9,360 (102).
  // Berufsauslagen: pass 800; 240 days x 15 = 3,600, at most 3,200; 3 % of 280,000 = 8,400, at
  // most 4,000; side job 20 % of 9,360 = 1,872 (between 800 and 2,400). Total 9,872.
  // Debt interest 9,000 (under 30,000 + 50,000). 3a 7,258. Insurance 6,000 paid, 2,900.
  // Political party 12,000, at most 10,500 (single, 2026). Training 15,000, at most 12,600.
  // 199 = 280,000 + 9,360 + 30,000 = 319,360; 299 = 9,872 + 9,000 + 7,258 + 2,900 + 10,500
  // + 12,600 = 52,130; 310 = 350 = 390 = 267,230. Basic tariff 2026: 24,655 at 266,700;
  // 530 x 13 % = 68.90; 24,723.90. Wealth 2,000,000 - 300,000 = 1,700,000: 81,000 free;
  // 241,000 x 0.5 per mille = 120.50; 404,000 x 1 = 404; 645,000 x 1.5 = 967.50 (to 1,371,000);
  // 329,000 x 2 per mille = 658; 2,150.00. Simple tax 26,873.90.
  // Staatssteuer 95 %: 25,530.205, 25,530.21. Zürich 119 %: 31,979.941, 31,979.94. Catholic
  // church Zürich 10 %, single: 2,687.39. Personalsteuer 24. Total 60,221.54.
  const r = computeReturn({
    taxYear: 2026,
    commune: 261,
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(320_000), socialContributions: amt(15_000), pensionFund: amt(25_000) },
          { gross: amt(10_000), socialContributions: amt(640), side: true },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 240,
        pillar3a: amt(7_258),
        trainingCosts: amt(15_000),
      },
    ],
    church: { p1: 'catholic' },
    household: {
      healthPremiums: amt(6_000),
      debtInterest: amt(9_000),
      debts: amt(300_000),
      politicalParty: amt(12_000),
    },
    movable: [{ owner: 'p1', value: amt(2_000_000), income: amt(30_000) }],
  });

  it('lines and taxes', () => {
    expect(find(r, '102')).toBe(chf(9_360));
    expect(find(r, '220')).toBe(chf(-9_872));
    expect(find(r, '250')).toBe(chf(-9_000));
    expect(find(r, '284')).toBe(chf(-10_500));
    expect(find(r, '292')).toBe(chf(-12_600));
    expect(r.icc?.taxableIncome.amount).toBe(chf(267_230));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(1_700_000));
    expect(r.icc?.taxes.simple.amount).toBe(chf(26_873.9));
    expect(r.icc?.taxes.cantonal.amount).toBe(chf(25_530.21));
    expect(r.icc?.taxes.communal.amount).toBe(chf(31_979.94));
    expect(r.icc?.taxes.church?.amount).toBe(chf(2_687.39));
    expect(r.icc?.taxes.total.amount).toBe(chf(60_221.54));
  });
});

describe('H6: shared custody without child support, 2026', () => {
  // Half the child deduction (4,700) and half the insurance amount per child (650); the married
  // tariff only for the parent who mainly supports the child, which must be said.
  const base: ZhEngineInput = {
    taxYear: 2026,
    commune: 261,
    civilStatus: 'single',
    childSupport: 'none',
    people: [{ id: 'p1', employments: [{ gross: amt(60_000), socialContributions: amt(3_840) }] }],
    children: [{ custody: 'shared' }],
    household: { healthPremiums: amt(5_000) },
  };

  it('half deductions, and the tariff the parent states', () => {
    const r = computeReturn({ ...base, marriedTariff: false });
    expect(find(r, '370')).toBe(chf(-4_700));
    expect(find(r, '270')).toBe(chf(-(4_350 + 650))); // no pension fund or 3a: 2,900 x 1.5
    expect(r.icc?.tariff).toBe('basic');
    expect(computeReturn({ ...base, marriedTariff: true }).icc?.tariff).toBe('married');
  });

  it('fails closed when it is not said', () => {
    const r = computeReturn(base);
    expect(r.icc).toBeNull();
    expect(r.unsupported).toContainEqual(NOTE.marriedTariff);
    const noSupport = { ...base };
    delete noSupport.childSupport;
    expect(computeReturn(noSupport).unsupported).toContainEqual(NOTE.childSupport);
  });
});

describe('fails closed', () => {
  const single: ZhEngineInput = {
    taxYear: 2026,
    commune: 261,
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [{ gross: amt(50_000) }] }],
  };

  it('for a year without official values', () => {
    expect(() => computeReturn({ ...single, taxYear: 2027 as 2026 })).toThrow(RangeError);
  });

  it('for a commune that is not in the table', () => {
    expect(() => computeReturn({ ...single, commune: 6621 })).toThrow(ZhInputError);
  });

  it('for self-employment', () => {
    const r = computeReturn({
      ...single,
      people: [{ id: 'p1', selfEmploymentProfit: amt(80_000) }],
    });
    expect(r.icc).toBeNull();
    expect(r.unsupported).toContainEqual(NOTE.selfEmployed);
  });

  it('for a church with two parishes when the parish is not said', () => {
    // Wädenswil 2026: reformed 11 % or 14 %.
    const r = computeReturn({ ...single, commune: 293, church: { p1: 'reformed' } });
    expect(r.icc).toBeNull();
    expect(r.unsupported).toContainEqual(NOTE.parish);
    const ok = computeReturn({ ...single, commune: 293, church: { p1: 'reformed', parish: 2 } });
    expect(ok.icc?.taxes.church?.how.en).toContain('14');
  });

  it('for a spouse in a single household', () => {
    expect(() => computeReturn({ ...single, people: [{ id: 'p1' }, { id: 'p2' }] })).toThrow(
      ZhInputError,
    );
  });
});

describe('estimates and values awaiting your OK', () => {
  it('flags the taxes that rest on an estimate', () => {
    const r = computeReturn({
      taxYear: 2026,
      commune: 261,
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: { value: chf(50_000), status: 'estimate' } }] }],
      household: { healthPremiums: { value: chf(3_000), status: 'extracted' } },
    });
    expect(r.estimates.map((e) => e.id)).toEqual(['input-estimate']);
    expect(r.icc?.taxes.total.estimates).toContain('input-estimate');
    expect(r.needsOk).toBeGreaterThan(0);
    expect(r.icc?.taxes.total.needsOk).toBe(true);
  });
});
