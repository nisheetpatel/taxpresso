// The communal and parish coefficients, generated from the official tables by
// scripts/fr-communes.mjs (--check compares them with the files). Spot values read in
// fr-2025-communal-coefficients-opendata, fr-2025-parish-coefficients-catholic and -reformed (the
// SCC's PDFs, état au 1er août 2025), and fr-2026-parish-coefficients-catholic-opendata and
// -reformed-opendata.
import { describe, expect, it } from 'vitest';
import { communeByRef, communesFor, foldName, parishOf } from '../src/index.js';

describe('communes', () => {
  for (const [year, count] of [
    [2025, 121],
    [2026, 119],
  ] as const) {
    it(`${year}: ${count} communes, each number and name once, each with both churches' parishes`, () => {
      const all = communesFor(year).value;
      expect(all).toHaveLength(count);
      expect(new Set(all.map((c) => c.bfs)).size).toBe(count);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(count);
      for (const c of all) {
        expect(c.bfs, c.name).toBeGreaterThan(2000);
        expect(c.bfs, c.name).toBeLessThan(2400);
        expect(c.catholic.length, c.name).toBeGreaterThan(0);
        expect(c.reformed.length, c.name).toBeGreaterThan(0);
        for (const p of [...c.catholic, ...c.reformed]) {
          expect(p.income, `${c.name} ${p.name}`).toBeGreaterThan(0);
          expect(p.income, `${c.name} ${p.name}`).toBeLessThanOrEqual(2_000);
          expect(p.wealth, `${c.name} ${p.name}`).toBeLessThanOrEqual(2_000);
        }
      }
    });
  }

  it('2025: the communal coefficient of every commune, at most 125 % (LICo art. 4)', () => {
    for (const c of communesFor(2025).value) {
      expect(Number.isInteger(c.rate), c.name).toBe(true);
      expect(c.rate, c.name).toBeGreaterThan(0);
      expect(c.rate, c.name).toBeLessThanOrEqual(12_500);
    }
    const rate = (name: string) => communeByRef(2025, name)?.rate;
    expect(rate('Fribourg')).toBe(8_000);
    expect(rate('Bulle')).toBe(7_430);
    expect(rate('Murten')).toBe(6_200);
    expect(rate('Villars-sur-Glâne')).toBe(6_390);
    expect(rate('Düdingen')).toBe(8_200);
    expect(rate('Delley-Portalban')).toBe(4_990);
    expect(rate('Greng')).toBe(3_200);
    expect(rate('Jaun')).toBe(10_000);
  });

  it('2026: the communes of the parish tables, without a communal coefficient', () => {
    const all = communesFor(2026).value;
    expect(all.every((c) => c.rate === null)).toBe(true);
    expect(communeByRef(2026, 2056)?.name).toBe('Fétigny-Ménières');
    expect(communeByRef(2026, 'Fétigny')).toBeUndefined();
    expect(communeByRef(2026, 'Ménières')).toBeUndefined();
    expect(communeByRef(2026, 'Ulmiz')).toBeUndefined();
    expect(communeByRef(2025, 'Fétigny')?.bfs).toBe(2016);
    expect(communeByRef(2025, 'Ulmiz')?.bfs).toBe(2278);
  });

  it('parishes: Bulle 4 % and 15 % (Catholic), 9 % and 20 % (Reformed), in both years', () => {
    for (const year of [2025, 2026]) {
      const bulle = communeByRef(year, 'Bulle')!;
      expect(bulle.catholic).toEqual([{ name: 'Bulle-La Tour', income: 400, wealth: 1_500 }]);
      expect(bulle.reformed.map((p) => [p.income, p.wealth])).toEqual([[900, 2_000]]);
    }
  });

  it('a commune with several parishes of a church: the same coefficients, or name the parish', () => {
    const fribourg = communeByRef(2025, 'Fribourg')!;
    expect(fribourg.catholic).toHaveLength(6);
    expect(parishOf(fribourg, 'catholic')).toEqual({
      name: 'Christ-Roi, Fribourg',
      income: 600,
      wealth: 1_800,
    });
    const murten = communeByRef(2025, 'Murten')!;
    expect(murten.reformed).toEqual([
      { name: 'Ferenbalm', income: 900, wealth: 900 },
      { name: 'Meyriez', income: 1_000, wealth: 1_000 },
      { name: 'Murten', income: 900, wealth: 900 },
    ]);
    expect(parishOf(murten, 'reformed')).toBe('parish');
    expect(parishOf(murten, 'reformed', 'meyriez')).toEqual({
      name: 'Meyriez',
      income: 1_000,
      wealth: 1_000,
    });
    expect(parishOf(murten, 'reformed', 'Bulle')).toBe('parish');
    const villorsonnens = communeByRef(2025, 'Villorsonnens')!;
    expect(parishOf(villorsonnens, 'catholic')).toBe('parish');
    expect(parishOf(villorsonnens, 'catholic', 'Villaz')).toEqual({
      name: 'Villaz',
      income: 800,
      wealth: 2_000,
    });
  });

  it('finds a commune by number or name, accents, case and punctuation aside', () => {
    expect(communeByRef(2025, 2275)?.name).toBe('Murten');
    expect(communeByRef(2025, 'chatel saint denis')?.name).toBe('Châtel-Saint-Denis');
    expect(communeByRef(2025, 'cugy-fr')?.name).toBe('Cugy (FR)');
    expect(communeByRef(2025, 'Genève')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
