// The federal tax of a year of arrival from abroad or of departure abroad, the part every canton
// shares (src/ifd/part-year.ts): the days, the amounts reduced in proportion, the tax at a full
// year's rate with the reduction per child in proportion (ch-na-circulaire-30-epoux-famille p. 26,
// ch. 13.4.6, whose example of an arrival from abroad on 1 June is redone here with 2026 amounts).
import { describe, expect, it } from 'vitest';
import {
  forDays,
  ifdParamsFor,
  ifdPartYearParams,
  ifdTaxPartYear,
  partYear,
  toYear,
  Trace,
  type Line,
} from '../src/index.js';

const line = (francs: number): Line =>
  new Trace().line(francs * 100, { en: 'x', fr: 'x' }, { en: 'x', fr: 'x' });

describe('a part year for the federal tax', () => {
  it('converts to a year and reduces in proportion, x 360 / days', () => {
    const py = partYear(2026, 'arrival', '2026-06-01');
    expect(py.days).toBe(210);
    expect(toYear(7_000_000, 210)).toBe(12_000_000);
    expect(forDays(280_000, 210)).toBe(163_300); // 2,800 x 210 / 360 = 1,633.33, to the franc
  });

  it('reduces the amounts the instructions list, not pillar 3a or the scale', () => {
    const F = ifdParamsFor(2026);
    const P = ifdPartYearParams(F, partYear(2026, 'departure', '2026-06-30'), 2026);
    expect(P.insurance.value.other).toBe(90_000);
    expect(P.twoEarner.value).toMatchObject({ min: 430_000, max: 705_000 });
    expect(P.child.value).toBe(340_000);
    expect(P.married.value).toBe(140_000);
    expect(P.childcareMax.value).toBe(1_290_000);
    expect(P.professionalFlat.value).toMatchObject({ rateBp: 300, min: 100_000, max: 200_000 });
    expect(P.pillar3a).toBe(F.pillar3a);
    expect(P.marriedScale).toBe(F.marriedScale);
    expect(P.insurance.source).toMatch(/ch-2026-ifd-instructions-personnes-physiques p\. 1/);
    expect(P.professionalFlat.source).toMatch(/ch-na-ordonnance-frais-professionnels art\. 7/);
  });

  it('taxes the period at the rate of the year, the reduction per child in proportion', () => {
    // Circular 30's example: a couple with two children arriving on 1 June, taxable 146,000, the
    // rate income 250,000. 2026 married scale at 250,000: 5,692 at 152,400, + 13.00 a CHF 100
    // above it (LIFD art. 36 al. 2): 18,380; 146,000 x 18,380 / 250,000 = 10,733.92, rounded down to
    // 5 centimes 10,733.90; the reduction (2 x 263) x 146,000 / 250,000 = 307.18, down to 307.15.
    const t = ifdTaxPartYear(ifdParamsFor(2026), line(146_000), line(250_000), 'married', 2, 2026);
    expect(t.scaleIncome.amount).toBe(25_000_000);
    expect(t.scaleTax.amount).toBe(1_838_000);
    expect(t.atRate.amount).toBe(1_073_390);
    expect(t.childReduction.amount).toBe(-30_715);
    expect(t.tax.amount).toBe(1_073_390 - 30_715);
  });

  it('collects nothing under 25 francs', () => {
    const t = ifdTaxPartYear(ifdParamsFor(2026), line(1_000), line(40_000), 'single', 0, 2026);
    expect(t.tax.amount).toBe(0);
  });
});
