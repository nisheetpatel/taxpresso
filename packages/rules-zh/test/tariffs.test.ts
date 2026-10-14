// The tariffs as the law prints them (StG § 35 and § 47), checked for internal consistency (the
// law states the last threshold twice: as the sum of the steps and as "über Fr. ...") and against
// values worked out by hand from the printed steps. The Zurich documents in the library print no
// sample taxes for these tariffs; the official worked example (official-example.test.ts) stops at
// the taxable income and wealth.
import { describe, expect, it } from 'vitest';
import { stepsTotal, tariffFraction, zhParamsFor, type StepTariff } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
/** The simple tax on whole francs, in centimes, rounded to the centime as the engine does. */
const tax = (t: StepTariff, francs: number) => {
  const num = tariffFraction(t, chf(francs));
  return Math.floor((2 * num + t.denominator) / (2 * t.denominator));
};

describe('tariffs 2025 and 2026', () => {
  for (const year of [2025, 2026]) {
    const P = zhParamsFor(year);
    const all = {
      'income basic': P.incomeTariff.basic.value,
      'income married': P.incomeTariff.married.value,
      'wealth basic': P.wealthTariff.basic.value,
      'wealth married': P.wealthTariff.married.value,
    };
    for (const [name, t] of Object.entries(all)) {
      it(`${year} ${name}: the steps add up to the threshold printed on the last line`, () => {
        expect(stepsTotal(t)).toBe(t.above[0]);
      });
      it(`${year} ${name}: rates rise step by step, the first step is free`, () => {
        const rates = [...t.steps.map(([, r]) => r), t.above[1]];
        expect(rates[0]).toBe(0);
        for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]!);
      });
    }
  }

  it('2026 income, basic tariff: CHF 100,000', () => {
    // Steps to 76,400: 0 + 5,000 x 2 % (100) + 4,800 x 3 % (144) + 8,000 x 4 % (320)
    // + 9,700 x 5 % (485) + 11,200 x 6 % (672) + 13,100 x 7 % (917) + 17,600 x 8 % (1,408)
    // = 4,046; then (100,000 - 76,400) x 9 % = 2,124. Total 6,170.00.
    expect(tax(zhParamsFor(2026).incomeTariff.basic.value, 100_000)).toBe(chf(6_170));
  });

  it('2026 income, married tariff: CHF 100,000', () => {
    // Steps to 96,300: 0 + 6,400 x 2 % (128) + 8,100 x 3 % (243) + 9,800 x 4 % (392)
    // + 11,200 x 5 % (560) + 14,500 x 6 % (870) + 32,200 x 7 % (2,254) = 4,447;
    // then (100,000 - 96,300) x 8 % = 296. Total 4,743.00.
    expect(tax(zhParamsFor(2026).incomeTariff.married.value, 100_000)).toBe(chf(4_743));
  });

  it('2026 income, basic tariff, top step: CHF 300,000', () => {
    // To 76,400: 4,046; 34,000 x 9 % = 3,060 (7,106); 33,700 x 10 % = 3,370 (10,476);
    // 53,300 x 11 % = 5,863 (16,339); 69,300 x 12 % = 8,316 (24,655, at 266,700);
    // (300,000 - 266,700) x 13 % = 4,329. Total 28,984.00.
    expect(tax(zhParamsFor(2026).incomeTariff.basic.value, 300_000)).toBe(chf(28_984));
  });

  it('2025 income, basic tariff: CHF 50,000', () => {
    // 4,900 x 2 % (98) + 4,800 x 3 % (144) + 7,900 x 4 % (316) + 9,600 x 5 % (480)
    // + 11,000 x 6 % (660) = 1,698 at 45,100; (50,000 - 45,100) x 7 % = 343. Total 2,041.00.
    expect(tax(zhParamsFor(2025).incomeTariff.basic.value, 50_000)).toBe(chf(2_041));
  });

  it('2026 wealth, basic tariff: CHF 500,000', () => {
    // 81,000 free; 241,000 x 0.5 per mille = 120.50 (to 322,000); (500,000 - 322,000) x 1 per mille
    // = 178.00. Total 298.50.
    expect(tax(zhParamsFor(2026).wealthTariff.basic.value, 500_000)).toBe(chf(298.5));
  });

  it('2025 wealth, married tariff: CHF 458,373 (the taxable wealth of the official example)', () => {
    // 159,000 free; 239,000 x 0.5 per mille = 119.50 (to 398,000); 60,373 x 1 per mille = 60.373.
    // Total 179.873, to the centime 179.87.
    expect(tax(zhParamsFor(2025).wealthTariff.married.value, 458_373)).toBe(chf(179.87));
  });

  it('nothing on a zero or negative amount, and nothing in the free first step', () => {
    const t = zhParamsFor(2026).incomeTariff.basic.value;
    expect(tariffFraction(t, 0)).toBe(0);
    expect(tariffFraction(t, -500)).toBe(0);
    expect(tariffFraction(t, chf(7_000))).toBe(0);
    expect(tax(t, 7_001)).toBe(2); // 1 franc at 2 %
    expect(tariffFraction(zhParamsFor(2026).wealthTariff.married.value, chf(161_000))).toBe(0);
  });

  it('the cantonal multiplier: 98 % for 2024 and 2025, 95 % for 2026 and 2027', () => {
    expect(zhParamsFor(2025).cantonalRate.value).toBe(98);
    expect(zhParamsFor(2026).cantonalRate.value).toBe(95);
  });

  it('fails closed for a year without official values', () => {
    expect(() => zhParamsFor(2024)).toThrow(RangeError);
    expect(() => zhParamsFor(2027)).toThrow(RangeError);
  });
});
