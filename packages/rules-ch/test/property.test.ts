// A property in Switzerland its owner lives in or lets, the federal rules every canton shares
// (property/swiss.ts): the upkeep, flat or actual, the higher one; the reform that ends the rental
// value on 1 January 2029. Every rule cites a document of the sources library (SPEC.md section 13,
// item 8b).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  federalUpkeep,
  RENTAL_VALUE_REFORM,
  rentalValueTaxed,
  SWISS_PROPERTY_INSTRUCTIONS,
  SWISS_PROPERTY_RULES,
  Trace,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;
const base = { en: 'the rental value', fr: 'de la valeur locative' };

describe('a property in Switzerland, the shared federal rules', () => {
  it('cites a document of the library, with its article, page or part, for every rule', () => {
    const all = [
      ...Object.values(SWISS_PROPERTY_RULES),
      ...Object.values(SWISS_PROPERTY_INSTRUCTIONS).flatMap((y) => Object.values(y)),
      RENTAL_VALUE_REFORM.source,
    ];
    for (const source of all) {
      const ids = source.match(/\bch-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? [];
      expect(ids.length, source).toBeGreaterThan(0);
      for (const id of ids) {
        expect(lock[id]?.status, `${id} in ${source}`).toBe('ok');
        expect(source.slice(source.indexOf(id) + id.length), source).toMatch(/^ (art\.|p\.|\()/);
      }
    }
  });

  it('the flat 10 % or 20 % by the building’s age, or the actual costs, whichever is higher', () => {
    // ch-2026-ifd-instructions-personnes-physiques p. 6: 10 % up to 10 years at the start of the
    // tax period, 20 % above; the guide's example: 35'856 x 20 % = 7'171 (rounded to the franc).
    const old = federalUpkeep({
      taxYear: 2025,
      income: 3_585_600,
      old: true,
      actual: 550_000,
      inputs: [],
      base,
    });
    expect(old).toMatchObject({ amount: 717_100, flat: 717_100, used: 'flat', flatBp: 2000 });
    const young = federalUpkeep({
      taxYear: 2026,
      income: 2_640_000,
      old: false,
      actual: 300_000,
      inputs: [new Trace()],
      base,
    });
    expect(young).toMatchObject({ amount: 300_000, flat: 264_000, used: 'actual', flatBp: 1000 });
    expect(young.trace.sources).toContain('ch-2026-ifd-instructions-personnes-physiques p. 6');
    // The age not known: only the actual costs; nothing at all without them.
    expect(
      federalUpkeep({ taxYear: 2026, income: 2_640_000, actual: 120_000, inputs: [], base }),
    ).toMatchObject({ amount: 120_000, used: 'actual' });
    expect(
      federalUpkeep({ taxYear: 2026, income: 2_640_000, actual: 0, inputs: [], base }),
    ).toMatchObject({ amount: 0, used: 'none' });
  });

  it('the rental value is still taxed in 2025 and 2026: the reform enters into force in 2029', () => {
    expect(RENTAL_VALUE_REFORM.value.firstYear).toBe(2029);
    expect(rentalValueTaxed(2025)).toBe(true);
    expect(rentalValueTaxed(2026)).toBe(true);
    expect(rentalValueTaxed(2028)).toBe(true);
    expect(rentalValueTaxed(2029)).toBe(false);
  });
});
