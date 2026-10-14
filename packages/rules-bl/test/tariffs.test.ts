// The tariffs against the canton's own tables. The income rows are read on page 1 of the tariff sheet
// of each year (bl-2025-tariff-staatssteuer, bl-2026-tariff-staatssteuer: "Auszug aus der Tabelle mit
// Steuerbeträgen", a single person and Vollsplitting); the workbook of each year
// (bl-<year>-tariff-tariftabelle) holds the same rows, and scripts/bl-tariff.mjs --check compares
// every one of them with the formula: all 188 values of each year equal. The wealth tariff against
// the sheet's own example (page 2).
import { describe, expect, it } from 'vitest';
import { blParamsFor, formulaTax, incomeTariffTax, wealthTax } from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

// [taxable income in CHF, tax single, tax with Vollsplitting, both in CHF as printed]
type Rows = [number, number, number][];
const INCOME: Record<2025 | 2026, Rows> = {
  2025: [
    [16_715, 0, 0],
    [16_716, 81.9, 81.9],
    [17_000, 94.9, 83.3],
    [30_000, 1_061.95, 147],
    [33_000, 1_367.4, 161.7],
    [34_000, 1_474.75, 189.8],
    [47_000, 3_083.85, 993.45],
    [55_000, 4_193.9, 1_655.8],
    [65_000, 5_651.5, 2_629.5],
    [70_000, 6_405.85, 3_169.55],
    [100_000, 11_223.8, 6_987.45],
    [120_000, 14_650.9, 9_827.4],
    [230_000, 34_124.65, 27_571.3],
    [500_000, 83_977, 75_469.6],
    [530_000, 89_631.35, 80_906.85],
  ],
  2026: [
    [16_730, 0, 0],
    [16_731, 82, 82],
    [17_000, 94.3, 83.3],
    [18_000, 143.3, 88.2],
    [34_000, 1_472.8, 188.55],
    [55_000, 4_190.75, 1_652.9],
    [60_000, 4_910.35, 2_120.65],
    [120_000, 14_645.55, 9_820.75],
    [250_000, 37_728.3, 31_025.9],
    [530_000, 89_622.35, 80_893.6],
  ],
};

describe('income tariff (StG § 34, the year’s parameters)', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the rows of the tariff sheet, p. 1, both columns`, () => {
      const f = blParamsFor(year).income.value;
      for (const [income, single, splitting] of INCOME[year]) {
        expect(incomeTariffTax(f, chf(income), false).tax, `${income} single`).toBe(chf(single));
        expect(incomeTariffTax(f, chf(income), true).tax, `${income} Vollsplitting`).toBe(
          chf(splitting),
        );
      }
    });

    it(`${year}: centimes of income are dropped; the rate of half the income, rounded down`, () => {
      const f = blParamsFor(year).income.value;
      expect(incomeTariffTax(f, chf(70_000.95), false).tax).toBe(
        incomeTariffTax(f, chf(70_000), false).tax,
      );
      expect(incomeTariffTax(f, chf(54_201), true).rateIncome).toBe(27_100);
    });

    it(`${year}: the formula is continuous at the Eckwerte and rises with income`, () => {
      const f = blParamsFor(year).income.value;
      for (const e of [f.medium1, f.medium2]) {
        expect(formulaTax(f, e + 1) - formulaTax(f, e)).toBeGreaterThan(0);
        expect(formulaTax(f, e + 1) - formulaTax(f, e)).toBeLessThan(1);
      }
      let previous = 0;
      for (let income = f.min; income < 3_000_000; income += 997) {
        const tax = incomeTariffTax(f, income * 100, false).tax;
        expect(tax, String(income)).toBeGreaterThanOrEqual(previous);
        previous = tax;
      }
    });

    it(`${year}: above the last Eckwert, the maximum rate on the rest (Anwendungsregeln Ziffer 4)`, () => {
      const f = blParamsFor(year).income.value;
      const at = formulaTax(f, f.max);
      expect(formulaTax(f, f.max + 100_000) - at).toBeCloseTo(18_620, 6);
    });
  }

  it('the minimum rate with Vollsplitting: 0.49 % below the first Eckwert (2026 sheet p. 1)', () => {
    const f = blParamsFor(2026).income.value;
    const r = incomeTariffTax(f, chf(20_000), true);
    expect(r.atMinimumRate).toBe(true);
    expect(r.rate).toBe(0.0049);
    expect(r.tax).toBe(chf(98));
  });

  it('the canton’s worked example of the formula (Steuerbuch 34 Nr. 3, p. 216 and 217)', () => {
    // Tax year 2017, Vollsplitting, taxable 103,334: x = 51,667, b2 = -0.326307, c2 = 0.043109,
    // d2 = -1,186.893636; the three terms add up to 3,898.567067, the rate is 7.545565 %. The
    // segment's Eckwerte: the 2005 ones (StG § 34 Abs. 1) at the 2017 index 107.4 over 104.0
    // (bl-2025-tariff-tariftabelle, sheet Tarif, row 15), to the franc (Anwendungsregeln Ziffer 3).
    // The other segments' parameters are not printed and not used.
    const at = (e: number) => Math.round((e * 1.074) / 1.04);
    const f = {
      min: at(15_000),
      medium1: at(40_000),
      medium2: at(100_000),
      max: at(1_150_000),
      segments: [
        { b: 0, c: 0, d: 0 },
        { b: -326_307, c: 43_109, d: -1_186_893_636 },
        { b: 0, c: 0, d: 0 },
      ] as const,
      minRate: 4_900,
      maxRate: 186_200,
    };
    expect(formulaTax(f, 51_667)).toBeCloseTo(3_898.567067, 6);
    const r = incomeTariffTax(f, chf(103_334), true);
    expect(r.rateIncome).toBe(51_667);
    expect((r.rate * 100).toFixed(6)).toBe('7.545565');
    // The example prints 7,797.10: 7,797.134 rounded down. The rules of application round to the
    // nearest 5 centimes (Ziffer 7), and so do all 376 rows of the 2025 and 2026 tables (nearest,
    // not down: scripts/bl-tariff.mjs --check), which gives 7,797.15. Recorded as a conflict in
    // docs/sources/bl/NOTES.md; Taxpresso follows the rules and the tables.
    expect(r.tax).toBe(chf(7_797.15));
  });
});

describe('wealth tariff (StG § 51)', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: the sheet’s example, CHF 250,000 gives CHF 455 (p. 2)`, () => {
      const w = blParamsFor(year).wealth.value;
      expect(wealthTax(w.scale, chf(250_000))).toBe(chf(455));
      expect(wealthTax(w.scale, chf(150_000))).toBe(chf(165));
      // 350,000: 165 + 580; 400,000: + 50,000 x 3.3 per mille = 165.
      expect(wealthTax(w.scale, chf(350_000))).toBe(chf(745));
      expect(wealthTax(w.scale, chf(400_000))).toBe(chf(910));
      expect(w.exemptBelow).toBe(chf(10_000));
      // 12,345 x 1.1 per mille = 13.5795, to 5 centimes 13.60.
      expect(wealthTax(w.scale, chf(12_345))).toBe(chf(13.6));
    });
  }
});
