// The communal multipliers and church tax rates, generated from the tax administration's table by
// scripts/be-communes.mjs (which also checks them against the finance administration's printed
// table of each year). Spot values read in be-2025-steueranlagen-gemeinden-de and
// be-2026-steueranlagen-gemeinden-de, table 2.1 (p. 13 to 21).
import { describe, expect, it } from 'vitest';
import { churchRate, communeByBfs, communeByName, communesFor, foldName } from '../src/index.js';

describe('communes', () => {
  for (const [year, count] of [
    [2025, 335],
    [2026, 334],
  ] as const) {
    const all = communesFor(year).value;

    it(`${year}: ${count} communes, each BFS number and name once, whole ten-thousandths`, () => {
      expect(all).toHaveLength(count);
      expect(new Set(all.map((c) => c.bfs)).size).toBe(count);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(count);
      for (const c of all) {
        expect(Number.isInteger(c.rate), c.name).toBe(true);
        expect(c.parishes.length).toBeGreaterThan(0);
        for (const p of c.parishes) {
          for (const r of [p.reformed, p.catholic, p.christCatholic]) {
            if (r !== null) expect(Number.isInteger(r), c.name).toBe(true);
          }
        }
      }
    });
  }

  it('Bern, Biel/Bienne, Thun (2026, p. 13 and 20)', () => {
    expect(communeByBfs(2026, 351)).toEqual({
      bfs: 351,
      name: 'Bern',
      rate: 15_400,
      parishes: [{ name: 'Bern', reformed: 1_840, catholic: 1_900, christCatholic: 2_760 }],
    });
    expect(communeByBfs(2026, 371)).toMatchObject({ name: 'Biel/Bienne', rate: 16_300 });
    expect(communeByBfs(2026, 942)).toMatchObject({ name: 'Thun', rate: 16_600 });
  });

  it('changed between 2025 and 2026 (p. 18): Reutigen 1.75, then 1.65', () => {
    expect(communeByBfs(2025, 767)?.rate).toBe(17_500);
    expect(communeByBfs(2026, 767)?.rate).toBe(16_500);
  });

  it('a commune whose parts have different church rates: one parish per part', () => {
    const lyss = communeByBfs(2026, 306)!;
    expect(lyss.parishes.map((p) => [p.name, p.reformed])).toEqual([
      ['Busswil BE', 2_000],
      ['Lyss', 1_840],
    ]);
    expect(churchRate(lyss, 'reformed')).toBe('part');
    expect(churchRate(lyss, 'reformed', 'Lyss')).toBe(1_840);
    // The Roman Catholic rate is the same in both parts.
    expect(churchRate(lyss, 'catholic')).toBe(1_900);
  });

  it('parts with the same church rates are one parish (Madiswil)', () => {
    expect(communeByBfs(2026, 332)?.parishes).toEqual([
      { name: 'Madiswil', reformed: 1_840, catholic: 1_900, christCatholic: 2_760 },
    ]);
  });

  it('where the two official documents differ, the rate is null (docs/sources/be/NOTES.md)', () => {
    for (const bfs of [611, 616, 623, 630, 632]) {
      const c = communeByBfs(2025, bfs)!;
      expect(c.parishes.map((p) => p.catholic)).toEqual([null]);
      expect(churchRate(c, 'catholic')).toBe('conflict');
      expect(churchRate(c, 'reformed')).toBe(1_840);
      expect(communeByBfs(2026, bfs)?.parishes[0]?.catholic).toBe(1_700);
    }
    expect(communeByBfs(2026, 709)?.parishes[0]?.catholic).toBeNull(); // Seehof
    const jegenstorf = communeByBfs(2026, 540)!;
    expect(jegenstorf.parishes.map((p) => [p.name, p.reformed])).toEqual([
      ['Jegenstorf', 2_180],
      ['Scheunen', null],
    ]);
  });

  it('finds a commune by its name, accents and case aside', () => {
    expect(communeByName(2026, 'munchenbuchsee')?.bfs).toBe(546);
    expect(communeByName(2026, 'BIEL/BIENNE')?.bfs).toBe(371);
    expect(communeByName(2026, 'Zürich')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
