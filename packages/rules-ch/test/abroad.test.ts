// Real estate abroad, the rules every canton shares (abroad/property.ts): the split by the gross
// assets, the share not taxed here, what can't be split (fail closed), the federal tax at the rate
// of the whole income, and the latest official rate as an estimate for a year without its own.
// Every rule cites a document of the sources library (SPEC.md section 13, item 8b).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ABROAD_RULES,
  exemptPart,
  IFD_UPKEEP_FLAT,
  ifdParamsFor,
  ifdTax,
  ifdTaxAtRate,
  officialChf,
  officialChfOrLatest,
  shareAbroad,
  splitProblem,
  Trace,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;
const line = (centimes: number) =>
  new Trace().line(centimes, { en: 'x', fr: 'x' }, { en: 'x', fr: 'x' });

describe('real estate abroad, the shared rules', () => {
  it('cites a document of the library, with its article or page, for every rule', () => {
    const all = [
      ...Object.values(ABROAD_RULES),
      IFD_UPKEEP_FLAT[2025].source,
      IFD_UPKEEP_FLAT[2026].source,
    ];
    for (const source of all) {
      const ids = source.match(/\b(?:ch|zh)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? [];
      expect(ids.length, source).toBeGreaterThan(0);
      for (const id of ids) {
        expect(lock[id]?.status, `${id} in ${source}`).toBe('ok');
        expect(source.slice(source.indexOf(id) + id.length), source).toMatch(/^ (art\.|p\.)/);
      }
    }
  });

  it('splits an amount by where the gross assets lie, to the centime', () => {
    // 3'812 of interest, 297'760 of 577'760 abroad: 1'964.5941... -> 1'964.59.
    expect(shareAbroad(381_200, 29_776_000, 57_776_000)).toBe(196_459);
    expect(shareAbroad(381_200, 0, 57_776_000)).toBe(0);
    expect(shareAbroad(0, 1, 1)).toBe(0);
    // Exact where the product passes the safe integers: CHF 100 million of debts, 3 of 7 abroad,
    // 4'285'714'285.71 -> 4'285'714'286 centimes.
    expect(shareAbroad(10_000_000_000, 300_000_000_000, 700_000_000_000)).toBe(4_285_714_286);
  });

  it('gives the share not taxed here, to the franc, between nothing and the whole', () => {
    // 85'902 x 7'168.31 / 91'782.31 = 6'709.02 -> 6'709.
    expect(exemptPart(8_590_200, 716_831, 9_178_231)).toBe(670_900);
    expect(exemptPart(8_590_200, 0, 9_178_231)).toBe(0);
    expect(exemptPart(0, 716_831, 9_178_231)).toBe(0);
    expect(exemptPart(100_00, 200_00, 100_00)).toBe(100_00);
  });

  it('says why a split can’t be made: a loss abroad, a loss here, a Swiss interest surplus', () => {
    expect(splitProblem({ foreign: -1, world: 100 })).toBe('loss_abroad');
    expect(splitProblem({ foreign: 200, world: 100 })).toBe('loss_switzerland');
    expect(
      splitProblem({ foreign: 50, world: 100 }, { swissShare: 300, swissWealthIncome: 200 }),
    ).toBe('interest_surplus');
    expect(
      splitProblem({ foreign: 50, world: 100 }, { swissShare: 200, swissWealthIncome: 200 }),
    ).toBeUndefined();
  });

  it('taxes the income here at the rate of the whole income (LIFD art. 7 al. 1), each year', () => {
    // Single, 2025: the whole income 88'779.31, at 88'700 the scale gives 1'698.00 + 37 x 6.60 =
    // 1'942.20 (Form. 58c 2025); 82'167 taxed here, at 82'100: 82'100 x 1'942.20 / 88'700 =
    // 1'797.672... rounded down to 5 centimes, 1'797.65.
    const F25 = ifdParamsFor(2025);
    const r25 = ifdTaxAtRate(F25, line(8_877_931), line(8_216_700), 'single');
    expect(r25.scaleIncome.amount).toBe(8_870_000);
    expect(r25.scaleTax.amount).toBe(194_220);
    expect(r25.atRate.amount).toBe(179_765);
    expect(r25.tax.amount).toBe(179_765);
    expect(r25.scaleTax.sources.join(' ')).toMatch(/ch-2025-ifd-tarif-personnes-physiques/);
    // 2026: 1'694.35 + 244.20 = 1'938.55; 82'100 x 1'938.55 / 88'700 = 1'794.30.
    const r26 = ifdTaxAtRate(ifdParamsFor(2026), line(8_877_931), line(8_216_700), 'single');
    expect(r26.scaleTax.amount).toBe(193_855);
    expect(r26.tax.amount).toBe(179_430);
    // Married, 2025: 5'045.00 at 146'500 (4'825.00 at 144'300, 10.00 a CHF 100); 143'900 x 5'045 /
    // 146'500 = 4'955.46 -> 4'955.45.
    const m = ifdTaxAtRate(F25, line(14_650_162), line(14_393_200), 'married');
    expect(m.scaleTax.amount).toBe(504_500);
    expect(m.tax.amount).toBe(495_545);
    // Everything taxed here: the same as the ordinary federal tax.
    const all = ifdTaxAtRate(F25, line(8_877_931), line(8_877_931), 'single');
    expect(all.tax.amount).toBe(ifdTax(F25, line(8_877_931), 'single', 0).tax.amount);
    // Under the CHF 25 minimum: not collected (LIFD art. 36 al. 3).
    expect(ifdTaxAtRate(F25, line(3_000_000), line(100_000), 'single').tax.amount).toBe(0);
  });

  it('takes the latest official rate, as an estimate, for a year whose rates aren’t published', () => {
    // EUR 150'000.00 on 31 December 2025: x 0.930500 = 139'575.00 (ge-2025-taux-donnees-fiscales).
    expect(officialChfOrLatest(15_000_000, 'EUR', 2025, 'wealth')).toMatchObject({
      ok: true,
      centimes: 13_957_500,
    });
    expect(officialChfOrLatest(15_000_000, 'EUR', 2025, 'wealth')).not.toHaveProperty('estimate');
    expect(officialChf(15_000_000, 'EUR', 2026, 'wealth')).toEqual({
      ok: false,
      reason: 'no_rates_for_year',
    });
    expect(officialChfOrLatest(15_000_000, 'EUR', 2026, 'wealth')).toMatchObject({
      ok: true,
      centimes: 13_957_500,
      estimate: { year: 2025 },
    });
    // A currency with no official rate in Taxpresso: still not converted (fail closed).
    expect(officialChfOrLatest(15_000_000, 'NOK', 2026, 'wealth')).toEqual({
      ok: false,
      reason: 'no_rate_for_currency',
    });
    // An earlier year than the library's: no rate, never a later year's.
    expect(officialChfOrLatest(15_000_000, 'EUR', 2024, 'wealth')).toEqual({
      ok: false,
      reason: 'no_rates_for_year',
    });
  });
});
