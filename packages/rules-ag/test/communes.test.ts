// The communal and church Steuerfüsse, generated from the canton's lists by scripts/ag-communes.mjs
// (which also checks the cantonal Steuerfuss in their titles against the table of cantonal
// multipliers). Spot values read in ag-2025-communal-steuerfuesse and ag-2026-communal-steuerfuesse.
import { describe, expect, it } from 'vitest';
import {
  churchRate,
  churchRates,
  communeByName,
  communesFor,
  foldName,
  slugOf,
} from '../src/index.js';

describe('communes', () => {
  for (const [year, count] of [
    [2025, 197],
    [2026, 196],
  ] as const) {
    const all = communesFor(year).value;

    it(`${year}: ${count} communes, each name once, whole percents`, () => {
      expect(all).toHaveLength(count);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(count);
      expect(new Set(all.map((c) => slugOf(c.name))).size).toBe(count);
      for (const c of all) {
        for (const r of [c.rate, ...churchRates(c)]) {
          expect(Number.isInteger(r) && r > 0 && r < 200, c.name).toBe(true);
        }
        for (const p of c.extra) {
          expect(p.parish, c.name).toMatch(/^(ref\.|röm\.-kath\.) Kirche \S/);
        }
      }
    });
  }

  it('Aarau (p. 1 and 9): 96 %, churches 15, 19 and 25 %, the Reformed parish of Rohr 20 %', () => {
    for (const year of [2025, 2026] as const) {
      expect(communeByName(year, 'Aarau')).toEqual({
        name: 'Aarau',
        rate: 96,
        church: { reformed: 15, catholic: 19, christCatholic: 25 },
        extra: [{ parish: 'ref. Kirche Rohr', confession: 'reformed', rate: 20 }],
      });
    }
  });

  it('changed between 2025 and 2026 (p. 1): Baden 92 %, then 89 %', () => {
    expect(communeByName(2025, 'Baden')?.rate).toBe(92);
    expect(communeByName(2026, 'Baden')?.rate).toBe(89);
  });

  it('Villnachern is on the 2025 list only (p. 7): it joined Brugg', () => {
    expect(communeByName(2025, 'Villnachern')).toMatchObject({ rate: 120 });
    expect(communeByName(2026, 'Villnachern')).toBeUndefined();
  });

  it('Zurzach (p. 8 and 9): five further parishes, their names joined across lines', () => {
    expect(communeByName(2026, 'Zurzach')?.extra).toEqual([
      { parish: 'röm.-kath. Kirche Baldingen Böbikon', confession: 'catholic', rate: 28 },
      { parish: 'röm.-kath. Kirche Kaiserstuhl Fisibach', confession: 'catholic', rate: 22 },
      { parish: 'röm.-kath. Kirche Rümikon Wislikofen', confession: 'catholic', rate: 22 },
      { parish: 'ref. Kirche Tegerfelden', confession: 'reformed', rate: 19 },
      { parish: 'ref. Kirche Kaiserstuhl Fisibach', confession: 'reformed', rate: 16 },
    ]);
  });

  it('the church rate: the own parish, or a further parish once named', () => {
    const brugg = communeByName(2026, 'brugg (ag)')!;
    expect(brugg.name).toBe('Brugg (AG)');
    expect(brugg.extra.map((p) => [p.parish, p.rate])).toEqual([
      ['ref. Kirche Rein', 16],
      ['ref. Kirche Umiken', 19],
      ['ref. Kirche Birr', 19],
    ]);
    expect(churchRate(brugg, 'reformed')).toBe('parish');
    expect(churchRate(brugg, 'reformed', 'Brugg (AG)')).toBe(16);
    expect(churchRate(brugg, 'reformed', 'ref. Kirche Umiken')).toBe(19);
    expect(churchRate(brugg, 'reformed', 'ref. Kirche Muri')).toBe('parish');
    // No further Roman Catholic parish in Brugg: the commune's own rate, whatever is named.
    expect(churchRate(brugg, 'catholic')).toBe(20);
    expect(churchRate(brugg, 'catholic', 'ref. Kirche Umiken')).toBe(20);
    expect(churchRate(brugg, 'christ_catholic')).toBe(20);
    const bottstein = communeByName(2026, 'Bottstein')!;
    expect(bottstein.extra).toEqual([
      { parish: 'ref. Kirche Böttstein', confession: 'reformed', rate: 23 },
    ]);
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
