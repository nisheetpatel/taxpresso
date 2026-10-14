// The income and wealth tariffs: a sample of the rows the canton's tariff tables print (the
// einfache Steuer at 100 percent for a single taxpayer and with Vollsplitting, and its percentage),
// with the page; scripts/sg-tariff.mjs --check compares every row of both tables (5,185 and 5,191)
// with this module. The thresholds, the 5-Rappen rounding and the wealth rate are those of the law
// and of each tariff's page 1.
import { describe, expect, it } from 'vitest';
import {
  bracketTenths,
  incomeTariffTax,
  ratePercent,
  sgParamsFor,
  wealthTariffTax,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

/** [income, single tax, single %, Vollsplitting tax, Vollsplitting %, page]. */
type Row = [number, number, string, number, string, number];

const ROWS: Record<2025 | 2026, Row[]> = {
  // sg-2025-tariff-einkommen-vermoegen
  2025: [
    [11_600, 0, '0.0000', 0, '0.0000', 2],
    [11_700, 4, '0.0342', 0, '0.0000', 2],
    [15_800, 168, '1.0633', 0, '0.0000', 3],
    [40_000, 1_744, '4.3600', 840, '2.1000', 8],
    [50_100, 2_552, '5.0938', 1_442.9, '2.8800', 10],
    [60_700, 3_406, '5.6112', 2_079.45, '3.4257', 12],
    [80_000, 5_181.6, '6.4770', 3_488, '4.3600', 16],
    [98_300, 6_865.2, '6.9839', 4_949.05, '5.0346', 19],
    [120_000, 8_905, '7.4208', 6_688, '5.5733', 24],
    [150_000, 11_725, '7.8167', 9_443.2, '6.2955', 30],
    [264_200, 22_459.8, '8.5011', 20_084.8, '7.6021', 52],
    [264_300, 22_465.5, '8.5000', 20_092.4, '7.6021', 52],
    [528_400, 44_914, '8.5000', 44_919.6, '8.5011', 105],
  ],
  // sg-2026-tariff-einkommen-vermoegen
  2026: [
    [25_000, 720, '2.8800', 72, '0.2880', 5],
    [36_000, 1_424, '3.9556', 600, '1.6667', 7],
    [50_100, 2_552, '5.0938', 1_442.9, '2.8800', 10],
    [55_000, 2_944, '5.3527', 1_740, '3.1636', 11],
    [60_300, 3_368, '5.5854', 2_055.4, '3.4086', 12],
    [60_400, 3_377.2, '5.5914', 2_064, '3.4172', 12],
    [72_000, 4_444.4, '6.1728', 2_848, '3.9556', 14],
    [80_000, 5_180.4, '6.4755', 3_488, '4.3600', 16],
    [120_000, 8_903.6, '7.4197', 6_688, '5.5733', 24],
    [150_000, 11_723.6, '7.8157', 9_440.8, '6.2939', 30],
    [264_500, 22_486.6, '8.5016', 20_108.4, '7.6024', 52],
    [264_600, 22_491, '8.5000', 20_119.6, '7.6038', 52],
    [529_000, 44_965, '8.5000', 44_973.2, '8.5016', 105],
  ],
};

const pct = (rate: { num: number; den: number }) => ratePercent(rate, 'en').replace(' %', '');

describe('income tariff (StG Art. 50)', () => {
  for (const year of [2025, 2026] as const) {
    const f = sgParamsFor(year).income.value;
    for (const [income, single, sp, couple, cp, page] of ROWS[year]) {
      it(`${year}, CHF ${income} (sg-${year}-tariff-einkommen-vermoegen p. ${page})`, () => {
        const s = incomeTariffTax(f, chf(income), false);
        const c = incomeTariffTax(f, chf(income), true);
        expect([s.tax, pct(s.rate), c.tax, pct(c.rate)]).toEqual([
          chf(single),
          sp,
          chf(couple),
          cp,
        ]);
      });
    }
  }

  it('the brackets add up to the top amount, where 8.5 percent takes over (Abs. 2)', () => {
    for (const year of [2025, 2026] as const) {
      const f = sgParamsFor(year).income.value;
      expect(f.brackets.reduce((s, [w]) => s + w, 0)).toBe(f.topFrom);
      // 8.5 percent of the top amount is just under the brackets' tax there: the tax drops a little
      // above it, as the tables print (2025: 22,459.80 at 264,200, 22,465.50 at 264,300).
      expect(f.topFrom * f.topRate).toBeLessThan(bracketTenths(f, f.topFrom));
    }
  });

  it('Vollsplitting above twice the top amount: 8.5 percent of the whole income (tariff p. 1)', () => {
    const f = sgParamsFor(2025).income.value;
    expect(incomeTariffTax(f, chf(528_500), true)).toMatchObject({ tax: chf(44_922.5), top: true });
    expect(incomeTariffTax(f, chf(1_000_000), false).tax).toBe(chf(85_000));
  });

  it('takes whole francs, and rounds to the nearest 5 Rappen', () => {
    const f = sgParamsFor(2025).income.value;
    // 60,201 francs, single: 3,360 + 9.2 % of 1 = 3,360.092, to 5 Rappen 3,360.10.
    expect(incomeTariffTax(f, chf(60_201.95), false).tax).toBe(chf(3_360.1));
    // Under the first bracket: nothing.
    expect(incomeTariffTax(f, chf(11_600), false).tax).toBe(0);
    expect(incomeTariffTax(f, 0, true).tax).toBe(0);
  });
});

describe('wealth tariff (StG Art. 65)', () => {
  it('1.7 per mille, the francs under 1,000 dropped', () => {
    for (const year of [2025, 2026] as const) {
      const w = sgParamsFor(year).wealth.value;
      expect(wealthTariffTax(w, chf(400_000))).toEqual({ tax: chf(680), base: chf(400_000) });
      expect(wealthTariffTax(w, chf(200_999))).toEqual({ tax: chf(340), base: chf(200_000) });
      expect(wealthTariffTax(w, chf(999)).tax).toBe(0);
      expect(wealthTariffTax(w, chf(1_000)).tax).toBe(chf(1.7));
    }
  });
});

describe('the years', () => {
  it('fails closed for a year without official values', () => {
    expect(() => sgParamsFor(2024)).toThrow(RangeError);
    expect(() => sgParamsFor(2027)).toThrow(/not supported/);
  });
});
