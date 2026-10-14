// The canton's own worked figures:
// - the guide's sample return (Mustersteuererklärung, Familie Muster-Beispiel, married, two minor
//   children, tax year 2025: zg-2025-guide-wegleitung p. 17 to 19, cantonal column): its lines, given
//   to the assessment as printed, give its subtotals, its net income and its taxable income and
//   wealth; and the engine, given the family's facts, gives its insurance, social and wealth
//   deductions;
// - the rules the guide and the table of amounts state with their amounts (the flat professional
//   costs, a side job, a car, the pensioners' deduction).
// The tariff sheets' figures are in test/tariffs.test.ts, the Steuerfüsse's rebates in
// test/communes.test.ts.
import { describe, expect, it } from 'vitest';
import {
  assess,
  computeReturn,
  flatShare,
  pensionerAmount,
  rentDeduction,
  twoEarnerDeduction,
  vehicleCost,
  zgParamsFor,
  type ItemAmount,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

describe('the guide’s sample return, 2025 (p. 17 to 19)', () => {
  // Page 17: 100 (person 1) 116,881; 160 10,819; 181 19,200; 190 146,900.
  // Page 18: 201 5,806; 205 13,750; 220 7,258; 230 9,200; 255 2,500; 280 38,514; 287 108,386;
  // 296 230; 299 108,156; 400 24,000; 403 25,200; 404 24,400; 410 2,500; 490 32,056.
  // Page 19: 600 841,659; 603 100,000; 604 12,000; 610 600,000; 630 1,553,659; 640 550,000;
  // 660 1,003,659; 671 408,000; 673 204,000; 690 391,659.
  const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
    code,
    person,
    amount: chf(francs),
  });
  const r = assess({
    taxYear: 2025,
    commune: 'Zug',
    tariff: 'married',
    incomeItems: [
      line('100', 116_881, 'p1'),
      line('160', 10_819),
      line('181', 19_200),
      line('201', -5_806, 'p1'),
      line('205', -13_750),
      line('220', -7_258, 'p1'),
      line('230', -9_200),
      line('255', -2_500),
      line('296', -230),
      line('400', -24_000),
      line('403', -25_200),
      line('404', -24_400),
      line('410', -2_500),
    ],
    wealthItems: [
      line('600', 841_659),
      line('603', 100_000),
      line('604', 12_000),
      line('610', 600_000),
      line('640', -550_000),
      line('671', -408_000),
      line('673', -204_000),
    ],
  });

  it('gives the sample’s totals, net income and taxable income', () => {
    expect(r.grossIncome.amount).toBe(chf(146_900));
    expect(r.totalDeductions.amount).toBe(chf(38_514));
    expect(r.subtotal.amount).toBe(chf(108_386));
    expect(r.netIncome.amount).toBe(chf(108_156));
    expect(r.taxableIncome.amount).toBe(chf(32_056));
  });

  it('gives the sample’s wealth', () => {
    expect(r.wealth.grossWealth.amount).toBe(chf(1_553_659));
    expect(r.wealth.netWealth.amount).toBe(chf(1_003_659));
    expect(r.wealth.taxableWealth.amount).toBe(chf(391_659));
  });

  it('the engine gives the family’s insurance, social and wealth deductions', () => {
    // Married, person 1 employed with a pension fund and 3a, two children under 15 cared for at
    // home: 230 = 7,000 + 2 x 1,100 = 9,200 (premiums above it); 400 = 24,000;
    // 403 = 2 x 12,600 = 25,200; 404 = 2 x 12,200 = 24,400; 671 = 408,000; 673 = 2 x 102,000;
    // 296: the 230 given, in full.
    const e = computeReturn({
      taxYear: 2025,
      commune: 'Zug',
      civilStatus: 'married',
      people: [
        {
          id: 'p1',
          employments: [
            { gross: amt(130_000), socialContributions: amt(8_320), pensionFund: amt(4_799) },
          ],
          pillar3a: amt(7_258),
        },
        { id: 'p2' },
      ],
      children: [
        { custody: 'full', under15: true },
        { custody: 'full', under15: true },
      ],
      household: { healthPremiums: amt(12_000), donations: amt(230) },
    });
    const at = (code: string) =>
      [...(e.icc?.items ?? []), ...(e.icc?.wealth.items ?? [])]
        .filter((i) => i.code === code)
        .reduce((s, i) => s + i.amount, 0);
    expect(e.unsupported).toEqual([]);
    expect(at('100')).toBe(chf(116_881));
    expect(at('220')).toBe(chf(-7_258));
    expect(at('230')).toBe(chf(-9_200));
    expect(at('296')).toBe(chf(-230));
    expect(at('400')).toBe(chf(-24_000));
    expect(at('403')).toBe(chf(-25_200));
    expect(at('404')).toBe(chf(-24_400));
    expect(at('671')).toBe(chf(-408_000));
    expect(at('673')).toBe(chf(-204_000));
  });
});

describe('caps, flat amounts and tables', () => {
  it('the other professional costs: 3 % of the net salary, at least 2,000, at most 4,000 (guide p. 32)', () => {
    const p = zgParamsFor(2025).amounts.otherFlat.value;
    expect(flatShare(chf(1_500), p)).toBe(chf(1_500));
    expect(flatShare(chf(50_000), p)).toBe(chf(2_000));
    expect(flatShare(chf(100_000), p)).toBe(chf(3_000));
    expect(flatShare(chf(200_000), p)).toBe(chf(4_000));
    expect(zgParamsFor(2026).amounts.otherFlat.value).toEqual(p);
  });

  it('a side job: 20 %, at least 800, at most 2,400, never more than its income (guide p. 34)', () => {
    const p = zgParamsFor(2025).amounts.sideJob.value;
    expect(flatShare(chf(500), p)).toBe(chf(500));
    expect(flatShare(chf(3_000), p)).toBe(chf(800));
    expect(flatShare(chf(10_000), p)).toBe(chf(2_000));
    expect(flatShare(chf(20_000), p)).toBe(chf(2_400));
    expect(flatShare(0, p)).toBe(0);
  });

  it('a car without usable public transport: km x 2 x days x 0.70 (2025, guide p. 32), 0.75 (2026)', () => {
    expect(vehicleCost(10, 220, zgParamsFor(2025).amounts.travel.value.carPerKm)).toBe(chf(3_080));
    expect(vehicleCost(10, 220, zgParamsFor(2026).amounts.travel.value.carPerKm)).toBe(chf(3_300));
    expect(vehicleCost(10, 200, zgParamsFor(2026).amounts.travel.value.motorbikePerKm)).toBe(
      chf(1_600),
    );
    expect(zgParamsFor(2025).amounts.travel.value.max).toBe(chf(6_000));
  });

  it('both spouses work: the lower earned income, at most 4,600 (guide p. 40)', () => {
    const max = zgParamsFor(2025).amounts.twoEarner.value;
    expect(twoEarnerDeduction(chf(50_000), max)).toBe(chf(4_600));
    expect(twoEarnerDeduction(chf(3_000), max)).toBe(chf(3_000));
    expect(twoEarnerDeduction(chf(-500), max)).toBe(0);
  });

  it('the pensioners’ deduction: 2025 by net income 34,400 and 57,400 (guide p. 42), 2026 6,000', () => {
    const p25 = zgParamsFor(2025).amounts.pensioner.value;
    expect(pensionerAmount(p25.small, chf(34_400))).toBe(chf(3_400));
    expect(pensionerAmount(p25.small, chf(34_401))).toBe(chf(1_700));
    expect(pensionerAmount(p25.large, chf(57_400))).toBe(chf(1_700));
    expect(pensionerAmount(p25.large, chf(57_401))).toBe(0);
    expect(p25.maxWealth).toBe(chf(287_000));
    expect(p25.perPerson).toBe(false);
    const p26 = zgParamsFor(2026).amounts.pensioner.value;
    expect(pensionerAmount(p26.large, chf(120_000))).toBe(chf(6_000));
    expect(pensionerAmount(p26.large, chf(120_001))).toBe(0);
    expect(pensionerAmount(p26.small, chf(60_000))).toBe(chf(6_000));
    expect(pensionerAmount(p26.small, chf(60_001))).toBe(0);
    expect(p26.maxWealth).toBe(chf(400_000));
    expect(p26.perPerson).toBe(true);
  });

  it('a pensioner couple, 2025 and 2026: once per couple, then once per pensioner', () => {
    const couple = (taxYear: 2025 | 2026) =>
      computeReturn({
        taxYear,
        commune: 'Menzingen',
        civilStatus: 'married',
        people: [
          { id: 'p1', pensionAvs: amt(26_000) },
          { id: 'p2', pensionAvs: amt(24_000) },
        ],
        movable: [{ owner: 'household', value: amt(100_000), income: amt(200) }],
      });
    // 2025: net income 50,200 (at most 57,400): 1,700, once. 2026: 2 x 6,000.
    const in2025 = couple(2025).icc!.items.find((i) => i.code === '406');
    const in2026 = couple(2026).icc!.items.find((i) => i.code === '406');
    expect(in2025?.amount).toBe(chf(-1_700));
    expect(in2026?.amount).toBe(chf(-12_000));
  });

  it('renters: 30 % of the net rent, at most 10,800 (guide p. 42)', () => {
    const p = zgParamsFor(2025).amounts.rent.value;
    expect(rentDeduction(chf(20_000), p)).toBe(chf(6_000));
    expect(rentDeduction(chf(40_000), p)).toBe(chf(10_800));
  });
});
