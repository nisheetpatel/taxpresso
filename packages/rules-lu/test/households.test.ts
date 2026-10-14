// Five synthetic households, each derived by hand in the comments from the cited rules, then the
// cases where the engine does not compute (fail closed). Amounts in CHF in the comments; the
// engine works in centimes. Units: lu-2025-communal-steuereinheiten and
// lu-2026-communal-steuereinheiten. Tariffs: StG § 57 (tax per unit). Synthetic only.
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  LuInputError,
  NOTE,
  type LuEngineInput,
  type LuTaxResult,
} from '../src/index.js';

const c = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: c(francs) });

/** The amount of the item with this code and person (summed), in CHF. */
function line(r: LuTaxResult, code: string, person?: string): number | undefined {
  const items = [...(r.icc?.items ?? []), ...(r.icc?.wealth.items ?? [])].filter(
    (i) => i.code === code && (person === undefined || i.person === person),
  );
  return items.length ? items.reduce((s, i) => s + i.amount, 0) / 100 : undefined;
}
const chf = (centimes: number | undefined) => (centimes === undefined ? undefined : centimes / 100);

describe('1. A single person in Luzern, 2025, Roman Catholic', () => {
  // Salary 85,000 gross, 5,440 AHV, 5,100 pension fund: net salary 74,460 (100).
  // Travel: public transport 900 (208t). Meals: 200 days x 15 = 3,000 (212; at most 3,200).
  // Other costs: 3 % x 74,460 = 2,233.80 -> 2,234 (220; between 2,000 and 4,000).
  // Pillar 3a 7,258 (260). Insurance: paid 4,200, at most 2,600 (single, with contributions): 2,600.
  // Account 30,000, income 60 (WV 4); flat costs 0.3 % x 30,000 = 90, at most the income: 60 (WV 6).
  // 301 = 74,460 + 60 - 60 = 74,460; 302 = 900 + 3,000 + 2,234 + 7,258 + 2,600 = 15,992.
  // 310 = 330 = 58,468; degressive: the single limit 50,000 is below it, none. 380 = 58,468.
  // Tax per unit (single, 2025) on 58,400: 2,161.50 at 60,000 less 5 % x 1,600 = 2,081.50.
  // Wealth 30,000 - 62,500 (473): none.
  // Luzern 2025: state 1.55, commune 1.55, Roman Catholic 0.25.
  // State 2,081.50 x 1.55 = 3,226.325 -> 3,226.33; commune the same; church 2,081.50 x 0.25 =
  // 520.375 -> 520.38; Personalsteuer 50. Total 7,023.04.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Luzern',
    civilStatus: 'single',
    church: { p1: 'catholic' },
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
  });

  it('the lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '100', 'p1')).toBe(74_460);
    expect(line(r, '208t', 'p1')).toBe(-900);
    expect(line(r, '212', 'p1')).toBe(-3_000);
    expect(line(r, '220', 'p1')).toBe(-2_234);
    expect(line(r, '260', 'p1')).toBe(-7_258);
    expect(line(r, '270')).toBe(-2_600);
    expect(line(r, 'WV4')).toBe(60);
    expect(line(r, 'WV6')).toBe(-60);
    expect(line(r, '340')).toBeUndefined();
    expect(line(r, '473')).toBe(-62_500);
    expect(chf(r.icc!.grossIncome.amount)).toBe(74_460);
    expect(chf(r.icc!.totalDeductions.amount)).toBe(-15_992);
    expect(chf(r.icc!.incomeAfterDeductions.amount)).toBe(58_468);
    expect(chf(r.icc!.taxableIncome.amount)).toBe(58_468);
    expect(chf(r.icc!.wealth.taxableWealth.amount)).toBe(0);
    expect(r.icc!.tariff).toBe('single');
  });

  it('the taxes', () => {
    const x = r.icc!.taxes;
    expect(chf(x.incomePerUnit.amount)).toBe(2_081.5);
    expect(chf(x.wealthPerUnit.amount)).toBe(0);
    expect(chf(x.cantonal.amount)).toBe(3_226.33);
    expect(chf(x.communal.amount)).toBe(3_226.33);
    expect(chf(x.church?.amount)).toBe(520.38);
    expect(x.incomeCap).toBeNull();
    expect(chf(x.personal.amount)).toBe(50);
    expect(chf(r.total!)).toBe(7_023.04);
    expect(r.commune).toEqual({ bfs: null, name: 'Luzern', rate: 15_500 });
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
  });
});

describe('2. A couple with two children in Kriens, 2026, Reformed', () => {
  // p1: 110,000 gross, 7,040 AHV, 7,700 pension fund: net 95,260 (100). Car, no usable public
  // transport, 18 km x 2 x 220 days x 0.75 (2026) = 5,940 (208t; at most 6,500). Canteen (box G):
  // 220 days x 7.50 = 1,650, at most 1,600 (214). 3 % x 95,260 = 2,857.80 -> 2,858 (220). 3a 7,258.
  // p2: 60,000 gross, 3,840 AHV, 3,000 pension fund: net 53,160 (101). Public transport 1,100
  // (209t). 3 % x 53,160 = 1,594.80 -> at least 2,000 (221). 3a 3,000 (261).
  // Accounts 150,000, income 1,500 (WV 4); flat costs 0.3 % x 150,000 = 450 (WV 6).
  // Insurance: paid 14,000, at most 5,200 (spouses, with contributions) + 2 x 700 = 6,600 (270).
  // 301 = 95,260 + 53,160 + 1,500 - 450 = 149,470.
  // 302 = 5,940 + 1,600 + 2,858 + 1,100 + 2,000 + 7,258 + 3,000 + 6,600 = 30,356. 310 = 119,114.
  // Medical 4,000 < 5 % x 119,114 = 5,955.70 -> 5,956: none (320). Donations 1,500 <= 20 %: 1,500 (324).
  // Both earn (326): the lower, p2's 53,160, less 1,100 + 2,000 + 3,000 = 47,060 left: 5,000.
  // 330 = 119,114 - 1,500 - 5,000 = 112,614; the family limit 80,700 is below: no degressive.
  // Children: 2 x 8,100 = 16,200 (350); own care of the one under 14: 2,000 (353); childcare 15,000,
  // at most 18,200 on top of own care, both work: 15,000 (360).
  // 380 = 112,614 - 16,200 - 2,000 - 15,000 = 79,414, taken as 79,400.
  // Tax per unit (family, 2026): 275.50 at 32,500 + 4.5 % x 46,900 = 2,110.50 -> 2,386.00.
  // Wealth 150,000 - 125,000 (472) - 2 x 12,500 (474) = 0.
  // Kriens 2026: state 1.45, commune 1.85, Reformed 0.25 (all four members Reformed).
  // State 2,386 x 1.45 = 3,459.70; commune 2,386 x 1.85 = 4,414.10; church 2,386 x 0.25 = 596.50;
  // Personalsteuer 50 (one for the couple). Total 8,520.30.
  const input: LuEngineInput = {
    taxYear: 2026,
    commune: 'Kriens',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed', children: ['reformed', 'reformed'] },
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
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(3_000) },
        ],
        commuteCost: amt(1_100),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(15_000) },
      { custody: 'full', under14: false },
    ],
    household: { healthPremiums: amt(14_000), medicalCosts: amt(4_000), donations: amt(1_500) },
    movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
  };
  const r = computeReturn(input);

  it('the lines of the return', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '100', 'p1')).toBe(95_260);
    expect(line(r, '101', 'p2')).toBe(53_160);
    expect(line(r, '208t', 'p1')).toBe(-5_940);
    expect(line(r, '214', 'p1')).toBe(-1_600);
    expect(line(r, '220', 'p1')).toBe(-2_858);
    expect(line(r, '209t', 'p2')).toBe(-1_100);
    expect(line(r, '221', 'p2')).toBe(-2_000);
    expect(line(r, '260', 'p1')).toBe(-7_258);
    expect(line(r, '261', 'p2')).toBe(-3_000);
    expect(line(r, '270')).toBe(-6_600);
    expect(line(r, 'WV6')).toBe(-450);
    expect(chf(r.icc!.grossIncome.amount)).toBe(149_470);
    expect(chf(r.icc!.totalDeductions.amount)).toBe(-30_356);
    expect(chf(r.icc!.incomeAfterDeductions.amount)).toBe(119_114);
    expect(line(r, '320')).toBeUndefined();
    expect(r.notCounted).toContainEqual(NOTE.medicalBelow);
    expect(line(r, '324')).toBe(-1_500);
    expect(line(r, '326')).toBe(-5_000);
    expect(chf(r.icc!.netIncome.amount)).toBe(112_614);
    expect(line(r, '340')).toBeUndefined();
    expect(line(r, '350')).toBe(-16_200);
    expect(line(r, '353')).toBe(-2_000);
    expect(line(r, '360')).toBe(-15_000);
    expect(chf(r.icc!.taxableIncome.amount)).toBe(79_414);
    expect(line(r, '472')).toBe(-125_000);
    expect(line(r, '474')).toBe(-25_000);
    expect(r.icc!.tariff).toBe('family');
  });

  it('the taxes', () => {
    const x = r.icc!.taxes;
    expect(chf(x.incomePerUnit.amount)).toBe(2_386);
    expect(chf(x.cantonal.amount)).toBe(3_459.7);
    expect(chf(x.communal.amount)).toBe(4_414.1);
    expect(chf(x.church?.amount)).toBe(596.5);
    expect(chf(x.personal.amount)).toBe(50);
    expect(chf(r.total!)).toBe(8_520.3);
  });

  it('one spouse at home: no two-earner deduction and no childcare, own care stays', () => {
    const one = computeReturn({
      ...input,
      people: [input.people[0]!, { id: 'p2', pillar3a: amt(0) }],
    });
    expect(line(one, '326')).toBeUndefined();
    expect(line(one, '360')).toBeUndefined();
    expect(line(one, '353')).toBe(-2_000);
    expect(one.notCounted).toContainEqual(NOTE.childcareWork);
  });
});

describe('3. A single parent in Emmen, 2025, no church', () => {
  // Divorced, one child under 14 in full custody, living with the parent: the family tariff.
  // Salary 52,000 gross, 3,328 AHV, 2,400 pension fund: net 46,272 (100). Bike: 700 flat (208t).
  // Other costs: 3 % x 46,272 = 1,388.16, at least 2,000 (220). 3a 2,000 (260).
  // Child support received 9,600 (161). Account 12,000, income 10; flat costs 0.3 % = 36, at most
  // 10 (WV 6).
  // Insurance: premiums 3,600 less subsidy 1,200 = 2,400 paid; at most 2,600 + 700 = 3,300: 2,400.
  // 301 = 46,272 + 10 - 10 + 9,600 = 55,872; 302 = 700 + 2,000 + 2,000 + 2,400 = 7,100.
  // 310 = 330 = 48,772. Degressive (family limit 80,000): 14 % x 31,228 = 4,371.92 -> 4,372 (340).
  // Child 8,000 (350); own care 2,000 (353); childcare 8,000 (360).
  // 380 = 48,772 - 4,372 - 8,000 - 2,000 - 8,000 = 26,400.
  // Tax per unit (family, 2025) on 26,400: 65.50 at 26,200 + 3 % x 200 = 71.50 (the guide's table
  // prints 71.50, lu-2025-guide-wegleitung p. 59).
  // Wealth 12,000 - 62,500 (473) - 12,500 (474): none.
  // Emmen 2025: state 1.55, commune 2.15. State 71.50 x 1.55 = 110.825 -> 110.83; commune 71.50 x
  // 2.15 = 153.725 -> 153.73; Personalsteuer 50. Total 314.56.
  const r = computeReturn({
    taxYear: 2025,
    commune: 'Emmen',
    civilStatus: 'divorced',
    church: { p1: 'none', children: ['none'] },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(52_000), socialContributions: amt(3_328), pensionFund: amt(2_400) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(2_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(8_000) }],
    household: {
      healthPremiums: amt(3_600),
      healthSubsidy: amt(1_200),
      childSupportReceived: amt(9_600),
    },
    movable: [{ owner: 'p1', value: amt(12_000), income: amt(10) }],
  });

  it('the lines and the taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(r.icc!.tariff).toBe('family');
    expect(line(r, '208t', 'p1')).toBe(-700);
    expect(line(r, '220', 'p1')).toBe(-2_000);
    expect(line(r, '161')).toBe(9_600);
    expect(line(r, '270')).toBe(-2_400);
    expect(chf(r.icc!.grossIncome.amount)).toBe(55_872);
    expect(chf(r.icc!.netIncome.amount)).toBe(48_772);
    expect(line(r, '340')).toBe(-4_372);
    expect(line(r, '350')).toBe(-8_000);
    expect(line(r, '353')).toBe(-2_000);
    expect(line(r, '360')).toBe(-8_000);
    expect(chf(r.icc!.taxableIncome.amount)).toBe(26_400);
    expect(line(r, '473')).toBe(-62_500);
    expect(line(r, '474')).toBe(-12_500);
    const x = r.icc!.taxes;
    expect(chf(x.incomePerUnit.amount)).toBe(71.5);
    expect(chf(x.cantonal.amount)).toBe(110.83);
    expect(chf(x.communal.amount)).toBe(153.73);
    expect(x.church).toBeNull();
    expect(chf(r.total!)).toBe(314.56);
  });
});

describe('4. A retired couple with wealth in Horw, 2026, no church', () => {
  // p1: AHV pension 30,240 (130), pension fund pension 42,000 (132); p2: AHV pension 25,200 (131).
  // Securities 1,800,000, income 27,000 (WV 4); flat costs 0.3 % x 1,800,000 = 5,400 (WV 6).
  // 301 = 30,240 + 25,200 + 42,000 + 27,000 - 5,400 = 119,040. No earned income: no professional
  // costs. Insurance: paid 11,000; no pension fund or 3a contributions: at most 6,700 (270).
  // 302 = 6,700; 310 = 112,340. Medical: 9,000 - 5 % x 112,340 (5,617) = 3,383 (320).
  // 330 = 108,957; above the family limit 80,700: no degressive. 380 = 108,957, taken as 108,900.
  // Tax per unit (family, 2026): 275.50 at 32,500 + 4.5 % x 66,700 = 3,277.00 at 99,200, + 5 % x
  // 9,700 = 485: 3,762.00.
  // Wealth: 1,800,000 - 125,000 (472) = 1,675,000 (480); 0.75 per mille: 1,256.25 per unit.
  // Per unit 3,762.00 + 1,256.25 = 5,018.25. Horw 2026: state 1.45, commune 1.40.
  // State 5,018.25 x 1.45 = 7,276.4625 -> 7,276.46; commune 5,018.25 x 1.40 = 7,025.55;
  // Personalsteuer 50. Total 14,352.01.
  // Maximum burden: income 3,762 x 2.85 = 10,721.70 <= 22.4 % x 108,900 = 24,393.60; wealth
  // 1,256.25 x 2.85 = 3,580.31 <= 3 per mille x 1,675,000 = 5,025: no cut.
  const r = computeReturn({
    taxYear: 2026,
    commune: 'Horw',
    civilStatus: 'married',
    church: { p1: 'none', p2: 'none' },
    people: [
      { id: 'p1', pensionAvs: amt(30_240), pensionOccupational: amt(42_000) },
      { id: 'p2', pensionAvs: amt(25_200) },
    ],
    household: { healthPremiums: amt(11_000), medicalCosts: amt(9_000) },
    movable: [{ owner: 'household', value: amt(1_800_000), income: amt(27_000) }],
  });

  it('the lines and the taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(line(r, '130', 'p1')).toBe(30_240);
    expect(line(r, '131', 'p2')).toBe(25_200);
    expect(line(r, '132', 'p1')).toBe(42_000);
    expect(line(r, 'WV6')).toBe(-5_400);
    expect(line(r, '220')).toBeUndefined();
    expect(line(r, '270')).toBe(-6_700);
    expect(line(r, '320')).toBe(-3_383);
    expect(chf(r.icc!.netIncome.amount)).toBe(108_957);
    expect(chf(r.icc!.wealth.taxableWealth.amount)).toBe(1_675_000);
    const x = r.icc!.taxes;
    expect(chf(x.incomePerUnit.amount)).toBe(3_762);
    expect(chf(x.wealthPerUnit.amount)).toBe(1_256.25);
    expect(chf(x.cantonal.amount)).toBe(7_276.46);
    expect(chf(x.communal.amount)).toBe(7_025.55);
    expect(x.church).toBeNull();
    expect(x.incomeCap).toBeNull();
    expect(x.wealthCap).toBeNull();
    expect(chf(r.total!)).toBe(14_352.01);
    expect(r.assumptions).toContainEqual(NOTE.pensions100);
  });
});

describe('5. Shared custody without child support, Luzern, 2026, a Reformed parent and a Catholic child', () => {
  // Divorced, one child under 14 living with each parent in turn, no child support: half the child
  // amounts (§ 42 Abs. 2), own care and childcare per StV § 14b; the parent says the family tariff
  // is theirs (the guide's rule).
  // Salary 90,000 gross, 5,760 AHV, 6,300 pension fund: net 77,940 (100). Public transport 800
  // (208t). Meals 180 days x 15 = 2,700 (212). 3 % x 77,940 = 2,338.20 -> 2,338 (220). 3a 7,258.
  // Insurance: paid 5,000, at most 2,600 + 0.5 x 700 = 2,950 (270).
  // Account 20,000, income 20; flat costs 0.3 % = 60, at most 20 (WV 6).
  // 301 = 77,940; 302 = 800 + 2,700 + 2,338 + 7,258 + 2,950 = 16,046; 310 = 330 = 61,894.
  // Degressive (family, 2026 limit 80,700): 14 % x 18,806 = 2,632.84 -> 2,633 (340).
  // Child: 0.5 x 8,100 = 4,050 (350). Own care 1,000 (353). Childcare 6,000, at most 10,100 - 1,000
  // = 9,100 (360). 380 = 61,894 - 2,633 - 4,050 - 1,000 - 6,000 = 48,211, taken as 48,200.
  // Tax per unit (family, 2026): 275.50 + 4.5 % x 15,700 = 706.50 -> 982.00.
  // Wealth 20,000 - 62,500 (473) - 6,250 (474): none.
  // Luzern 2026: state 1.45, commune 1.45; church: two members, one Reformed (0.25), one Roman
  // Catholic (0.23): (0.25 + 0.23) / 2 = 0.24 units (§ 240 Abs. 2).
  // State 982 x 1.45 = 1,423.90; commune 1,423.90; church 982 x 0.24 = 235.68; Personalsteuer 50.
  // Total 3,133.48.
  const input: LuEngineInput = {
    taxYear: 2026,
    commune: 'Luzern',
    civilStatus: 'divorced',
    childSupport: 'none',
    familyTariff: true,
    church: { p1: 'reformed', children: ['catholic'] },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(6_300) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 180,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(6_000) }],
    household: { healthPremiums: amt(5_000) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  };
  const r = computeReturn(input);

  it('the lines and the taxes', () => {
    expect(r.unsupported).toEqual([]);
    expect(r.icc!.tariff).toBe('family');
    expect(line(r, '270')).toBe(-2_950);
    expect(chf(r.icc!.netIncome.amount)).toBe(61_894);
    expect(line(r, '340')).toBe(-2_633);
    expect(line(r, '350')).toBe(-4_050);
    expect(line(r, '353')).toBe(-1_000);
    expect(line(r, '360')).toBe(-6_000);
    expect(chf(r.icc!.taxableIncome.amount)).toBe(48_211);
    expect(line(r, '474')).toBe(-6_250);
    const x = r.icc!.taxes;
    expect(chf(x.incomePerUnit.amount)).toBe(982);
    expect(chf(x.cantonal.amount)).toBe(1_423.9);
    expect(chf(x.communal.amount)).toBe(1_423.9);
    expect(chf(x.church?.amount)).toBe(235.68);
    expect(chf(r.total!)).toBe(3_133.48);
    expect(r.unverifiedRules).toContainEqual(NOTE.churchShares);
    expect(r.assumptions).toContainEqual(NOTE.sharedCare);
  });

  it('the single tariff when the family tariff is the other parent’s', () => {
    const other = computeReturn({ ...input, familyTariff: false });
    expect(other.icc!.tariff).toBe('single');
    // Degressive on the single limit: 61,894 is above 50,400, none.
    expect(line(other, '340')).toBeUndefined();
  });

  it('paying child support: the child counts for the other parent', () => {
    const pays = computeReturn({
      ...input,
      childSupport: 'pays',
      church: { p1: 'reformed' },
      household: { ...input.household, childSupportPaid: amt(9_600) },
    });
    expect(pays.icc!.tariff).toBe('single');
    expect(line(pays, '255')).toBe(-9_600);
    expect(line(pays, '350')).toBeUndefined();
    expect(line(pays, '474')).toBeUndefined();
    expect(pays.assumptions).toContainEqual(NOTE.childSupportPaid);
  });
});

describe('the maximum burden (StG § 62)', () => {
  // Single, Luthern 2025: state 1.55 + commune 2.40 + Roman Catholic 0.45 = 4.40 units.
  // Taxable income 3,000,000 (above 2,093,000): 5.7 % per unit = 171,000; x 4.40 = 752,400 >
  // 22.8 % x 3,000,000 = 684,000: cut 68,400. Taxable wealth 10,000,000 - 62,500 = 9,937,500,
  // taken as 9,937,000 (whole CHF 1,000): 0.75 per mille = 7,452.75 per unit; x 4.40 = 32,792.10 >
  // 3 per mille x 9,937,000 = 29,811.00: cut 2,981.10.
  const input: LuEngineInput = {
    taxYear: 2025,
    commune: 'Luthern',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [{ id: 'p1' }],
    household: { otherIncome: amt(3_000_000), otherAssets: amt(10_000_000) },
  };
  it('cuts the income and the wealth tax', () => {
    const r = computeReturn(input);
    expect(chf(r.icc!.taxableIncome.amount)).toBe(3_000_000);
    expect(chf(r.icc!.taxes.incomePerUnit.amount)).toBe(171_000);
    expect(chf(r.icc!.taxes.incomeCap?.amount)).toBe(-68_400);
    expect(chf(r.icc!.taxes.wealthPerUnit.amount)).toBe(7_452.75);
    expect(chf(r.icc!.taxes.wealthCap?.amount)).toBe(-2_981.1);
    expect(r.unverifiedRules).toContainEqual(NOTE.capShare);
  });
  it('asks about the church when the cut depends on it', () => {
    const r = computeReturn({ ...input, church: undefined });
    expect(r.icc).toBeNull();
    expect(r.unsupported).toContainEqual(NOTE.churchForCap);
  });
});

describe('fail closed', () => {
  const base: LuEngineInput = {
    taxYear: 2025,
    commune: 'Luzern',
    civilStatus: 'single',
    people: [{ id: 'p1', employments: [{ gross: amt(60_000) }] }],
  };
  const unsupported = (input: LuEngineInput, note: (typeof NOTE)[keyof typeof NOTE]) => {
    const r = computeReturn(input);
    expect(r.icc).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toContainEqual(note);
  };

  it('an unknown commune, year or person throws', () => {
    expect(() => computeReturn({ ...base, commune: 'Bern' })).toThrow(LuInputError);
    expect(() => computeReturn({ ...base, taxYear: 2027 as 2025 })).toThrow(RangeError);
    expect(() => computeReturn({ ...base, people: [{ id: 'p1' }, { id: 'p2' }] })).toThrow(
      LuInputError,
    );
  });

  it('self-employment, a 3a catch-up', () => {
    unsupported(
      { ...base, people: [{ id: 'p1', selfEmploymentProfit: amt(50_000) }] },
      NOTE.selfEmployed,
    );
    unsupported({ ...base, people: [{ id: 'p1', pillar3aCatchUp: amt(2_000) }] }, NOTE.catchUp);
  });

  it('shared custody without the child support answer, or without the family tariff answer', () => {
    unsupported(
      { ...base, civilStatus: 'divorced', children: [{ custody: 'shared', under14: false }] },
      NOTE.childSupport,
    );
    unsupported(
      {
        ...base,
        civilStatus: 'divorced',
        childSupport: 'none',
        children: [{ custody: 'shared', under14: false }],
      },
      NOTE.familyTariff,
    );
  });

  it('a child living with you whose age is not given', () => {
    unsupported({ ...base, children: [{ custody: 'full' }] }, NOTE.under14);
  });

  it('the church tax asked without a child’s confession', () => {
    unsupported(
      { ...base, church: { p1: 'reformed' }, children: [{ custody: 'full', under14: false }] },
      NOTE.childConfession,
    );
  });

  it('medical costs whose limit depends on the training costs (law and form differ)', () => {
    // Net income 310: 60,000 - 2,000 (3 % flat, minimum) - 13,000 training = 45,000; 5 % = 2,250.
    // The law's base adds the training back: 58,000; 5 % = 2,900. Costs 3,000: 750 or 100.
    unsupported(
      {
        ...base,
        people: [{ id: 'p1', employments: [{ gross: amt(60_000) }], trainingCosts: amt(13_000) }],
        household: { medicalCosts: amt(3_000) },
      },
      NOTE.trainingBase,
    );
    // Costs far above both thresholds still differ; costs below both do not.
    const below = computeReturn({
      ...base,
      people: [{ id: 'p1', employments: [{ gross: amt(60_000) }], trainingCosts: amt(13_000) }],
      household: { medicalCosts: amt(1_000) },
    });
    expect(below.icc).not.toBeNull();
    expect(below.notCounted).toContainEqual(NOTE.medicalBelow);
  });
});
