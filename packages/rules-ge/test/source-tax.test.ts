// Geneva source tax, 2025 and 2026. Expected rates are copied from the readable tables
// (ge-<year>-source-tariff-pdf, page given per row); the code reads the official ASCII files.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ge2025 from '../../../data/ge/2025/source-tax/tariffs.json';
import ge2026 from '../../../data/ge/2026/source-tax/tariffs.json';
import { expandTariff } from '@taxpresso/rules-ch';
import {
  normalizeTariff,
  sourceTax,
  SourceTaxError,
  sourceTaxTariffs,
} from '../src/source-tax/index.js';

const CHF = (n: number) => Math.round(n * 100);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rate = (year: number, tariff: string, annualChf: number) =>
  sourceTax(year, tariff, CHF(annualChf), 'year').rateBp;

/** One printed row: the yearly income it starts at and the rates in %, '_' for none. */
const COLUMNS = ['A0', 'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5'];
const H = ['H1', 'H2', 'H3', 'H4', 'H5'];
function expectRow(year: number, annualChf: number, printed: string) {
  const cells = printed.split(/\s+/);
  [...COLUMNS, ...H].forEach((code, i) => {
    const want = cells[i] === '_' ? 0 : Math.round(Number(cells[i]) * 100);
    expect(rate(year, code, annualChf), `${year} ${code} at ${annualChf}`).toBe(want);
    // The last franc of the row has the same rate.
    expect(rate(year, code, annualChf + 599), `${year} ${code} at ${annualChf + 599}`).toBe(want);
  });
}

describe('source-tax tables 2026', () => {
  it('match the printed rows for A0, B0 to B5, C0 to C5 and H1 to H5', () => {
    // ge-2026-source-tariff-pdf p. 3, p. 3, p. 4, p. 5, p. 6.
    expectRow(2026, 60_000, '7.62 0.17 _ _ _ _ _ 7.60 4.56 2.00 0.17 _ _ _ _ _ _ _');
    expectRow(2026, 84_000, '11.62 3.73 0.57 _ _ _ _ 11.03 8.41 5.86 3.47 1.50 _ 1.73 _ _ _ _');
    expectRow(
      2026,
      102_000,
      '13.60 6.36 3.01 0.46 _ _ _ 12.57 10.26 7.94 5.62 3.42 1.53 4.43 1.38 _ _ _',
    );
    expectRow(
      2026,
      120_000,
      '15.56 8.53 5.39 2.53 0.39 _ _ 13.90 11.84 9.76 7.62 5.48 3.39 6.70 3.73 1.17 _ _',
    );
    expectRow(
      2026,
      150_000,
      '17.99 11.59 8.75 6.05 3.58 1.35 _ 16.11 14.13 12.32 10.50 8.63 6.69 10.01 7.22 4.63 2.26 0.47',
    );
  });

  it('match the first and the top rows (p. 2, p. 29, p. 32)', () => {
    expect(rate(2026, 'A0', 29_399)).toBe(0); // 0 - 29'399: no tax
    expect(rate(2026, 'A0', 29_400)).toBe(9); // 29'400 - 29'999: 0.09 %
    expect(rate(2026, 'A0', 4_986_600)).toBe(3944);
    expect(rate(2026, 'A0', 103_021_800)).toBe(4052); // top row 98'106'600 - 103'021'800
    expect(() => sourceTax(2026, 'A0', CHF(103_100_000), 'year')).toThrow(SourceTaxError);
  });

  it('compute the tax for a month or a year, as the directives do (p. 14)', () => {
    // 5'000 a month, A0: the monthly row 5'000 - 5'049.95 and the yearly row 60'000 - 60'599.
    const month = sourceTax(2026, 'A0', CHF(5_000), 'month');
    expect(month).toMatchObject({
      tariff: 'A0N',
      rateBp: 762,
      taxCentimes: CHF(381),
      bracket: { fromCentimes: CHF(5_000), toCentimes: CHF(5_050) },
    });
    const year = sourceTax(2026, 'A0N', CHF(60_000), 'year');
    expect(year.taxCentimes).toBe(CHF(4_572)); // 60'000 x 7.62 %
    expect(year.taxCentimes).toBe(month.taxCentimes * 12);
    expect(year.bracket).toEqual({ fromCentimes: CHF(60_000), toCentimes: CHF(60_600) });
    expect(sourceTax(2026, 'A0', CHF(5_049.95), 'month').rateBp).toBe(762);
    expect(sourceTax(2026, 'A0', CHF(5_050), 'month').rateBp).toBe(774); // next row, p. 3
    expect(sourceTax(2026, 'A0', CHF(60_600), 'year').rateBp).toBe(774);
    expect(year.sources).toContain('ge-2026-source-tariff-ascii');
    expect(year.sources).toContain('ge-2026-source-directives p. 9, p. 14');
  });

  it('rounds the tax to the centime', () => {
    // 5'012.35 x 7.62 % = 381.941...
    expect(sourceTax(2026, 'A0', 501_235, 'month').taxCentimes).toBe(38_194);
    expect(sourceTax(2026, 'A0', 0, 'year').taxCentimes).toBe(0);
  });
});

describe('source-tax tables 2025', () => {
  it('match the printed rows and differ from 2026', () => {
    // ge-2025-source-tariff-pdf p. 3 and p. 5.
    expectRow(2025, 60_000, '7.83 0.18 _ _ _ _ _ 7.81 4.77 2.18 0.31 _ _ _ _ _ _ _');
    expectRow(
      2025,
      120_000,
      '15.79 8.76 5.61 2.72 0.53 _ _ 14.05 12.00 9.92 7.78 5.63 3.54 6.91 3.92 1.32 _ _',
    );
    expect(rate(2025, 'A0', 60_000)).not.toBe(rate(2026, 'A0', 60_000));
  });
});

describe('tariff codes', () => {
  it('lists A0 to A5, B0 to B5, C0 to C5 and H1 to H5, without church tax only', () => {
    for (const year of [2025, 2026]) {
      const codes = sourceTaxTariffs(year);
      expect(codes).toHaveLength(23);
      expect(codes.every((c) => /^[ABCH]\dN$/.test(c))).toBe(true);
      expect(codes).not.toContain('H0N');
    }
  });

  it('reads what a payslip writes, and refuses what Geneva does not publish', () => {
    expect(normalizeTariff(2026, ' b2 ')).toBe('B2N');
    expect(normalizeTariff(2026, 'H1N')).toBe('H1N');
    expect(() => normalizeTariff(2026, 'A0Y')).toThrow(/without church tax/);
    expect(() => normalizeTariff(2026, 'D0')).toThrow(SourceTaxError); // not A, B, C or H
    expect(() => normalizeTariff(2026, 'H0')).toThrow(SourceTaxError);
    expect(() => normalizeTariff(2026, 'A10')).toThrow(SourceTaxError);
    expect(() => sourceTax(2024, 'A0', 100, 'month')).toThrow(/2024/);
    expect(() => sourceTax(2026, 'A0', -1, 'month')).toThrow(SourceTaxError);
    expect(() => sourceTax(2026, 'A0', 10.5, 'month')).toThrow(SourceTaxError);
  });
});

describe('the stored tables', () => {
  const lock = JSON.parse(
    readFileSync(path.join(root, 'docs/sources/lock.json'), 'utf8'),
  ) as Record<string, { status: string; sha256?: string }>;
  for (const data of [ge2025, ge2026]) {
    it(`${data.taxYear}: come from the file pinned in lock.json, and every table is sound`, () => {
      expect(lock[data.source]).toMatchObject({ status: 'ok', sha256: data.sha256 });
      expect(data.validFrom).toBe(`${data.taxYear}-01-01`);
      expect(data.church).toEqual(['N']);
      for (const [code, t] of Object.entries(data.tariffs)) {
        const { from, rates, top } = expandTariff(t as Parameters<typeof expandTariff>[0]);
        expect(from[0], code).toBe(0);
        for (let i = 1; i < from.length; i++) {
          expect(from[i]! > from[i - 1]!, `${code} row ${i}`).toBe(true);
          expect(rates[i]! >= rates[i - 1]!, `${code} row ${i}`).toBe(true);
        }
        expect(top > from.at(-1)!).toBe(true);
      }
    });
  }

  it('never taxes more with more children, at the same income', () => {
    for (const annual of [40_000, 80_000, 130_000, 250_000, 1_000_000]) {
      for (const t of ['A', 'B', 'C', 'H']) {
        const first = t === 'H' ? 1 : 0;
        for (let n = first + 1; n <= 5; n++) {
          expect(rate(2026, `${t}${n}`, annual)).toBeLessThanOrEqual(
            rate(2026, `${t}${n - 1 < first ? first : n - 1}`, annual),
          );
        }
      }
    }
  });
});
