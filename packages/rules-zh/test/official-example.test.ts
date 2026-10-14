// The official worked examples of the Zurich guides, line by line as printed.
//
// zh-2025-guide-natuerliche-personen p. 33 to 38: Felix and Regula Muster-Meister, married, two
// children under 18, both employed, their own home, Zürich. The guide fills in the return down to
// the taxable income (p. 37, line 390: 88,251 for the Staatssteuer) and the taxable wealth
// (p. 38, line 490: 458,373); it prints no tax. The taxes below are worked out by hand from the
// tariff and the multipliers, not printed by the canton.
//
// zh-2026-guide-unterjaehrig p. 35 and 37: the same couple in 2026, liable for 150 days only. Its
// deductions are cut to 150/360, so only the totals of the return are checked, not a tax.
import { describe, expect, it } from 'vitest';
import {
  assess,
  donationDeduction,
  flatShare,
  incomeTotals,
  insuranceCap,
  mealsDeduction,
  twoEarner,
  zhParamsFor,
  asItem,
  type ItemAmount,
} from '../src/index.js';
import { roundFranc } from '../src/calc.js';

const chf = (francs: number) => Math.round(francs * 100);
const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
  code,
  person,
  amount: chf(francs),
});

describe('Wegleitung 2025, Beispiel (p. 33 to 38)', () => {
  const A = zhParamsFor(2025).amounts;

  it('Berufsauslagen of Felix (p. 36): bike 700 + meals with a canteen 1,600 + 3 % of 83,841 = 4,815', () => {
    // Salary certificate (p. 34): box 8 97,200 - box 9 6,075 - box 10.1 7,284 = box 11 83,841.
    const flat = flatShare(chf(83_841), A.professionalFlat.value); // 2,515.23, to the franc
    expect(flat).toBe(chf(2_515));
    // Box G is ticked: the reduced rate, CHF 7.50 a day, at most 1,600 (reached from 214 days).
    expect(mealsDeduction(220, true, A.meals.value)).toBe(chf(1_600));
    expect(A.commuteBike.value + chf(1_600) + flat).toBe(chf(4_815));
  });

  it('Versicherungsprämien (p. 36): paid 11,953, limit 5,800 + 2 x 1,300 = 8,400', () => {
    const cap = insuranceCap(A.insurance.value, true, true, 2, 0);
    expect(cap).toBe(chf(8_400));
    expect(Math.min(chf(11_953), cap)).toBe(chf(8_400));
  });

  it('Sonderabzug beider Ehegatten (p. 37): Regula 42,000 less 3,200 costs leaves 38,800, so 6,100', () => {
    expect(twoEarner(chf(42_000 - 3_200), A.twoEarner.value)).toBe(chf(6_100));
  });

  it('Gemeinnützige Zuwendungen (p. 37): 400, under 20 % of the Nettoeinkommen 107,251', () => {
    expect(donationDeduction(chf(400), chf(107_251), A.donations.value).deduction).toBe(chf(400));
  });

  const incomeItems = [
    line('100', 83_841, 'p1'),
    line('101', 42_000, 'p2'),
    line('150', 3_843),
    line('188', 15_680),
    line('220', -4_815, 'p1'),
    line('240', -3_200, 'p2'),
    line('250', -8_000),
    line('260', -7_258, 'p1'),
    line('270', -8_400),
    line('283', -240),
    line('284', -100),
    line('290', -6_100),
    line('324', -400),
    line('370', -18_600),
  ];
  const wealthItems = [
    line('400', 132_903),
    line('406', 5_470),
    line('412', 20_000),
    line('421', 1_050_000),
    line('470', -750_000),
  ];

  it('the return, p. 35 to 38: 199, 299, 310, 350, 390 and 460, 490 as printed', () => {
    const r = assess({
      taxYear: 2025,
      commune: 261, // Zürich
      tariff: 'married',
      adults: 2,
      incomeItems,
      wealthItems,
    });
    expect(r.grossIncome.amount).toBe(chf(145_364));
    expect(r.totalDeductions.amount).toBe(chf(-38_113));
    expect(r.subtotal310.amount).toBe(chf(107_251));
    expect(r.netIncome.amount).toBe(chf(106_851));
    expect(r.taxableIncome.amount).toBe(chf(88_251));
    expect(r.wealth.grossWealth.amount).toBe(chf(1_208_373));
    expect(r.wealth.taxableWealth.amount).toBe(chf(458_373));
  });

  it('its taxes, by hand: Zürich 2025, married tariff', () => {
    // Income 88,251, married tariff 2025: to 63,300, 6,300 x 2 % (126) + 8,000 x 3 % (240)
    // + 9,700 x 4 % (388) + 11,100 x 5 % (555) + 14,300 x 6 % (858) = 2,167; then
    // (88,251 - 63,300) x 7 % = 24,951 x 7 % = 1,746.57. Simple income tax 3,913.57.
    // Wealth 458,373: 179.87 (tariffs.test.ts). Simple tax 4,093.44.
    // Staatssteuer 98 %: 4,011.5712, to the centime 4,011.57. Gemeindesteuer Zürich 119 %:
    // 4,871.1936, 4,871.19. Personalsteuer 2 x 24 = 48. Total 8,930.76.
    // With church tax, as on p. 33 Felix is Roman Catholic and Regula Reformed (Zürich 2025: 10 %
    // each): each church half, 5 % + 5 % = 10 % of 4,093.44 = 409.344, 409.34.
    const r = assess({
      taxYear: 2025,
      commune: 261,
      tariff: 'married',
      adults: 2,
      church: { members: ['catholic', 'reformed'] },
      incomeItems,
      wealthItems,
    });
    expect(r.taxes.simpleIncome.amount).toBe(chf(3_913.57));
    expect(r.taxes.simpleWealth.amount).toBe(chf(179.87));
    expect(r.taxes.simple.amount).toBe(chf(4_093.44));
    expect(r.taxes.cantonal.amount).toBe(chf(4_011.57));
    expect(r.taxes.communal.amount).toBe(chf(4_871.19));
    expect(r.taxes.church?.amount).toBe(chf(409.34));
    expect(r.taxes.personalTax.amount).toBe(chf(48));
    expect(r.taxes.total.amount).toBe(chf(8_930.76 + 409.34));
  });

  it('labels each printed line with its official term', () => {
    expect(asItem(line('290', -6_100)).label.en).toContain('Sonderabzug bei Erwerbstätigkeit');
    expect(() => asItem(line('999', 1))).toThrow();
  });
});

describe('Wegleitung 2026 unterjährig, Beispiel (p. 35 and 37)', () => {
  it('the totals of the return as printed: 199 62,522; 299 21,388; 310 41,134; 350 41,014; 390 33,181', () => {
    const items = [
      line('100', 32_247, 'p1'),
      line('101', 16_153, 'p2'),
      line('150', 1_872),
      line('188', 12_250),
      line('220', -1_926, 'p1'),
      line('240', -1_333, 'p2'),
      line('250', -4_688),
      line('260', -7_258, 'p1'),
      line('270', -3_500),
      line('284', -100),
      line('290', -2_583),
      line('324', -120),
      line('370', -7_833),
    ].map(asItem);
    const t = incomeTotals(items);
    expect(t.grossIncome.amount).toBe(chf(62_522));
    expect(t.totalDeductions.amount).toBe(chf(-21_388));
    expect(t.subtotal310.amount).toBe(chf(41_134));
    expect(t.netIncome.amount).toBe(chf(41_014));
    expect(t.taxableIncome.amount).toBe(chf(33_181));
  });

  it('prints its shares to the nearest franc (p. 37): 6,200 : 360 x 150 = 2,583; 13,600 : 360 x 150 = 5,667', () => {
    // The 2026 amounts behind them: the two-earner deduction 6,200 and two child deductions of
    // 9,400 (18,800 : 360 x 150 = 7,833), as in zh-2026-law-steuergesetz-631-1-stand-2026.
    const A = zhParamsFor(2026).amounts;
    expect(roundFranc(A.twoEarner.value * 150, 360)).toBe(chf(2_583));
    expect(roundFranc(2 * A.child.value * 150, 360)).toBe(chf(7_833));
    expect(roundFranc(chf(13_600) * 150, 360)).toBe(chf(5_667)); // federal column, rounded up
  });
});
