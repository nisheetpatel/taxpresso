// The communal multipliers, generated from the statistics office table by scripts/zh-communes.mjs
// (which also checks them against the office's CSV time series). Spot values read in
// zh-na-communal-steuerfuesse-seit-2012, sheets STFUSS2025 and STFUSS2026.
import { describe, expect, it } from 'vitest';
import { communeByBfs, communeByName, communesFor, foldName } from '../src/index.js';

describe('communes', () => {
  for (const year of [2025, 2026]) {
    const all = communesFor(year).value;

    it(`${year}: 160 communes, each BFS number and name once, whole percents`, () => {
      expect(all).toHaveLength(160);
      expect(new Set(all.map((c) => c.bfs)).size).toBe(160);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(160);
      for (const c of all) {
        for (const r of [...c.rates, ...c.reformed, ...c.catholic, ...c.christCatholic]) {
          expect(Number.isInteger(r), c.name).toBe(true);
        }
        expect(c.rates.length).toBeGreaterThan(0);
      }
    });
  }

  it('Zürich and Winterthur', () => {
    expect(communeByBfs(2025, 261)).toMatchObject({ name: 'Zürich', rates: [119], reformed: [10] });
    expect(communeByBfs(2026, 261)).toMatchObject({ rates: [119], catholic: [10] });
    expect(communeByBfs(2026, 230)).toMatchObject({ name: 'Winterthur', rates: [125] });
  });

  it('communes whose parts have different multipliers', () => {
    expect(communeByBfs(2026, 198)?.rates).toEqual([112, 110]); // Uster
    expect(communeByBfs(2026, 228)?.rates).toEqual([122, 112]); // Turbenthal
    expect(communeByBfs(2026, 293)?.reformed).toEqual([11, 14]); // Wädenswil
  });

  it('changed between 2025 and 2026', () => {
    expect(communeByBfs(2025, 293)?.rates).toEqual([103]); // Wädenswil
    expect(communeByBfs(2026, 293)?.rates).toEqual([102]);
  });

  it('finds a commune by its name, accents and case aside', () => {
    expect(communeByName(2026, 'wadenswil')?.bfs).toBe(293);
    expect(communeByName(2026, 'ZÜRICH')?.bfs).toBe(261);
    expect(communeByName(2026, 'Genève')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
