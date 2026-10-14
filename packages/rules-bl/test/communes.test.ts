// The communes' Steuerfüsse and the 2026 church rates, generated from the canton's table by
// scripts/bl-communes.mjs (--check compares them with the files). Spot values read in the table's
// export (bl-2026-communal-steuerfuesse) and on the statistics page that shows it
// (bl-2025-gemeindesteuerfuesse), in percent of the state tax.
import { describe, expect, it } from 'vitest';
import { communeByName, communesFor, foldName, slugOf } from '../src/index.js';

describe('communes', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: 86 communes in five districts, each name once, at most 80 % (StG § 19 Abs. 2)`, () => {
      const all = communesFor(year).value;
      expect(all).toHaveLength(86);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(86);
      expect(new Set(all.map((c) => c.district))).toEqual(
        new Set(['Arlesheim', 'Laufen', 'Liestal', 'Sissach', 'Waldenburg']),
      );
      for (const c of all) {
        expect(Number.isInteger(c.rate), c.name).toBe(true);
        expect(c.rate, c.name).toBeGreaterThan(4_000);
        expect(c.rate, c.name).toBeLessThanOrEqual(8_000);
      }
    });
  }

  it('2025: the Steuerfuss of some communes', () => {
    const rate = (name: string) => communeByName(2025, name)?.rate;
    expect(rate('Liestal')).toBe(6_500);
    expect(rate('Allschwil')).toBe(5_800);
    expect(rate('Reinach')).toBe(5_450);
    expect(rate('Binningen')).toBe(4_900);
    expect(rate('Sissach')).toBe(5_700);
    expect(rate('Bottmingen')).toBe(4_800);
    expect(rate('Waldenburg')).toBe(7_200);
    expect(rate('Läufelfingen')).toBe(6_420);
    expect(rate('Ziefen')).toBe(6_300);
  });

  it('2026: changed Steuerfüsse, and the church rates', () => {
    const c = (name: string) => communeByName(2026, name)!;
    expect(c('Reinach').rate).toBe(5_850);
    expect(c('Ziefen').rate).toBe(5_900);
    expect(c('Böckten').rate).toBe(6_400);
    expect(c('Allschwil').church).toEqual({
      catholic: 800,
      reformed: { income: 55, wealth: 10 },
      christCatholic: { income: 70, wealth: 10 },
      childAmount: 6_000,
    });
    expect(c('Binningen').church?.catholic).toBe(630);
    expect(c('Liestal').church?.catholic).toBe(675);
    // The Laufen district: other Christ Catholic rates and amount per child.
    expect(c('Laufen').church).toEqual({
      catholic: 800,
      reformed: { income: 70, wealth: 7 },
      christCatholic: { income: 80, wealth: 8 },
      childAmount: 5_000,
    });
    for (const x of communesFor(2025).value) expect(x.church, x.name).toBeNull();
  });

  it('finds a commune by name or slug, accents, case and punctuation aside', () => {
    expect(communeByName(2025, 'burg i l')?.name).toBe('Burg i.L.');
    expect(communeByName(2025, slugOf('Burg i.L.'))?.name).toBe('Burg i.L.');
    expect(slugOf('Burg i.L.')).toBe('burg-i-l');
    expect(communeByName(2026, 'BOCKTEN')?.name).toBe('Böckten');
    expect(communeByName(2025, 'Basel')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
