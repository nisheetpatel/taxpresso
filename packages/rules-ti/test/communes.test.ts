// The communes' multipliers, generated from the canton's table (ti-2025-communal-rates and
// ti-2026-communal-rates, one page with a column per year) by scripts/ti-communes.mjs, whose --check
// compares them with the files. The values below were read on the page.
import { describe, expect, it } from 'vitest';
import { communeByName, communesFor, foldName, slugOf } from '../src/index.js';

describe('communes', () => {
  it('2025: 99 communes, 2026: 100 (LEMA has a multiplier from 2026 only)', () => {
    expect(communesFor(2025).value).toHaveLength(99);
    expect(communesFor(2026).value).toHaveLength(100);
    expect(communeByName(2025, 'Lema')).toBeUndefined();
    expect(communeByName(2026, 'Lema')).toEqual({ name: 'LEMA', rate: 9_500 });
    for (const year of [2025, 2026]) {
      const names = communesFor(year).value.map((c) => foldName(c.name));
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('the multipliers for natural persons (PF), in hundredths of a percent', () => {
    expect(communeByName(2025, 'LUGANO')?.rate).toBe(7_700);
    expect(communeByName(2026, 'Lugano')?.rate).toBe(8_000);
    expect(communeByName(2025, 'Bellinzona')?.rate).toBe(9_300);
    expect(communeByName(2026, 'Bellinzona')?.rate).toBe(9_300);
    expect(communeByName(2025, 'Locarno')?.rate).toBe(9_000);
    expect(communeByName(2026, 'Mendrisio')?.rate).toBe(7_700);
    // The PF column, not the PG one: Agno 2025 is 82 for natural persons, 95 for legal persons.
    expect(communeByName(2025, 'Agno')?.rate).toBe(8_200);
    expect(communeByName(2026, 'Airolo')?.rate).toBe(9_000);
    expect(communeByName(2025, 'Airolo')?.rate).toBe(8_700);
  });

  it('finds a commune by its name or slug, case, accents and punctuation aside', () => {
    expect(communeByName(2026, 'collina d’oro')?.name).toBe("COLLINA D'ORO");
    expect(communeByName(2026, slugOf('BRIONE S/MINUSIO'))?.name).toBe('BRIONE S/MINUSIO');
    expect(slugOf("SANT'ANTONINO")).toBe('sant-antonino');
  });

  it('cites the table of the year, and an unknown commune or year fails closed', () => {
    expect(communesFor(2025).source).toContain('ti-2025-communal-rates');
    expect(communesFor(2026).source).toContain('ti-2026-communal-rates');
    expect(communeByName(2026, 'Basel')).toBeUndefined();
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
