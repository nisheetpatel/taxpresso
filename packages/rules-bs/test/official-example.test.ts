// The official worked example for Basel-Stadt, as printed (amounts in CHF): the Winter-Sommer
// family of the guide, a married couple with two minor children in Basel, both employed, owning
// their house (bs-2025-guide-wegleitung p. 11 to 17; the 2026 guide prints the same example,
// bs-2026-guide-wegleitung-b p. 11 to 17). Its main form gives every line in the cantonal column
// down to the taxable income (page 3) and the taxable wealth (page 4), and its forms B, K and W the
// professional costs, the illness costs and the value of the securities. The guide prints no tax;
// the tariff's tax comes from the tariff's rule (tariff B, CHF 21 per CHF 100, p. 46).
// The example's forms are not all consistent with its main form (docs/sources/bs/NOTES.md): form K
// starts from a net income of 115,886 where the main form's 709 is 115,484, and form W's yield
// value is not its gross income times 345. Each rule is checked against the numbers its own form
// prints.
import { describe, expect, it } from 'vitest';
import {
  assess,
  bsParamsFor,
  illnessDeduction,
  mealsCost,
  professionalFlat,
  securitiesValue,
  type ItemAmount,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
  code,
  person,
  amount: chf(francs),
});

// The main form's cantonal column, pages 2 to 4 (bs-2025-guide-wegleitung p. 13, 15 and 16).
const INCOME: ItemAmount[] = [
  line('100', 115_941, 'p1'),
  line('105', 13_023, 'p2'),
  line('115', 1_200, 'p2'),
  line('369', 712),
  line('479', 17_416),
  line('519', -4_200, 'p1'),
  line('539', -1_050, 'p2'),
  line('550', -10_800),
  line('620', -7_258, 'p1'),
  line('630', -8_400),
  line('660', -1_100),
  line('725', -5_381),
  line('750', -18_000),
  line('760', -38_000),
];
const WEALTH: ItemAmount[] = [
  line('800', 90_865),
  line('821', 622_000),
  line('870', -540_000),
  line('890', -150_000),
  line('892', -30_000),
];

describe('the Winter-Sommer family (bs-2025-guide-wegleitung p. 11 to 17)', () => {
  for (const taxYear of [2025, 2026] as const) {
    it(`${taxYear}: the main form's totals, and the tax by tariff B in Basel`, () => {
      const r = assess({
        taxYear,
        commune: 'Basel',
        incomeTariff: 'B',
        wealthTariff: 'B',
        lowIncomeFamily: true,
        incomeItems: INCOME,
        wealthItems: WEALTH,
      });
      // Page 2: 299 = 130,164; 499 = 148,292. Page 3: 699 = 32,808; 709 = 115,484; 739 = 110,103;
      // 799 = 54,103.
      expect(r.grossIncome.amount).toBe(chf(148_292));
      expect(r.netIncome.amount).toBe(chf(115_484));
      expect(r.pureIncome.amount).toBe(chf(110_103));
      expect(r.taxableIncome.amount).toBe(chf(54_103));
      // Page 4: 869 = 712,865; 889 = 172,865; 899 = 0 (172,865 - 180,000, never below zero).
      expect(r.wealth.grossWealth.amount).toBe(chf(712_865));
      expect(r.wealth.netWealth.amount).toBe(chf(172_865));
      expect(r.wealth.taxableWealth.amount).toBe(0);
      // Tariff B at 54,100: 21 % = 11,361.00; in Basel all of it is cantonal.
      expect(r.taxes.incomeTariffTax.amount).toBe(chf(11_361));
      expect(r.taxes.cantonalIncome.amount).toBe(chf(11_361));
      expect(r.taxes.communalIncome.amount).toBe(0);
      expect(r.taxes.wealthTariffTax.amount).toBe(0);
      expect(r.taxes.total.amount).toBe(chf(11_361));
    });
  }

  it('form B: the flat amount of CHF 4,200 at 100 %, CHF 1,050 at a work rate of 25 % (p. 14)', () => {
    for (const taxYear of [2025, 2026] as const) {
      const flat = bsParamsFor(taxYear).amounts.professionalFlat.value;
      expect(professionalFlat(100, flat)).toBe(chf(4_200));
      expect(professionalFlat(25, flat)).toBe(chf(1_050));
    }
  });

  it('page 3: the flat insurance deduction for spouses (630), two earners (660), the social deductions', () => {
    for (const taxYear of [2025, 2026] as const) {
      const A = bsParamsFor(taxYear).amounts;
      expect(A.insurance.value.married).toBe(chf(8_400));
      // 660: the lower income, 13,023 + 1,200 - 1,050 = 13,173, is more than 1,100.
      expect(Math.min(A.twoEarner.value, chf(13_023 + 1_200 - 1_050))).toBe(chf(1_100));
      expect(2 * A.social.value.child).toBe(chf(18_000));
      expect(A.social.value.married).toBe(chf(38_000));
      expect(2 * A.wealthFree.value.perMinorChild).toBe(chf(30_000));
      expect(A.wealthFree.value.family).toBe(chf(150_000));
    }
  });

  it('form K: 11,175 of illness costs less 5 % of 115,886 (5,794): 5,381 (p. 14)', () => {
    const m = illnessDeduction(chf(11_175), chf(115_886), 500);
    expect(m.threshold).toBe(chf(5_794));
    expect(m.deduction).toBe(chf(5_381));
  });

  it('form W: the market value 90,865 is taken, the mean being higher (p. 16)', () => {
    // Gross income 797 (line 4) x 345 = 274,965; mean 182,915: the market value stays.
    const v = securitiesValue(chf(90_865), chf(797), 345);
    expect(v.yieldValue).toBe(chf(274_965));
    expect(v.mean).toBe(chf(182_915));
    expect(v.value).toBe(chf(90_865));
  });
});

describe('the guide’s rules for professional costs (bs-2025-guide-wegleitung p. 30 and 31)', () => {
  const A = bsParamsFor(2025).amounts;
  it('the flat amount is whole above 60 %, in proportion at 60 % or less, at least CHF 840', () => {
    const flat = A.professionalFlat.value;
    expect(professionalFlat(61, flat)).toBe(chf(4_200));
    expect(professionalFlat(60, flat)).toBe(chf(2_520));
    expect(professionalFlat(10, flat)).toBe(chf(840));
    expect(() => professionalFlat(0, flat)).toThrow(RangeError);
  });

  it('lunch: CHF 15 a day up to CHF 3,200, CHF 7.50 with a canteen up to CHF 1,600, 220 days', () => {
    const m = A.meals.value;
    expect(mealsCost(100, m.perDay, m.perYear, m.maxDays)).toBe(chf(1_500));
    expect(mealsCost(220, m.perDay, m.perYear, m.maxDays)).toBe(chf(3_200));
    expect(mealsCost(240, m.reducedPerDay, m.reducedPerYear, m.maxDays)).toBe(chf(1_600));
    expect(mealsCost(200, m.reducedPerDay, m.reducedPerYear, m.maxDays)).toBe(chf(1_500));
  });
});
