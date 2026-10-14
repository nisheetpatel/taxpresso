// The Steuerfüsse of the communes, parishes, Bürgergemeinden and the canton, generated from the
// Steuerverwaltung's tables by scripts/zg-communes.mjs (--check compares them with the files, and
// checks every rebate footnote against its cell). Spot values as the tables print them
// (zg-2025-communal-steuerfuesse, zg-2026-communal-steuerfuesse), in % of the einfache Steuer.
import { describe, expect, it } from 'vitest';
import { communeByName, communesFor, foldName, slugOf, zgParamsFor } from '../src/index.js';

describe('communes', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: 11 communes, each name once`, () => {
      const all = communesFor(year).value;
      expect(all).toHaveLength(11);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(11);
      for (const c of all) {
        expect(Number.isInteger(c.rate), c.name).toBe(true);
        expect(c.rate, c.name).toBeGreaterThan(4_000);
        expect(c.rate, c.name).toBeLessThan(7_000);
      }
    });
  }

  it('2025: the Steuerfüsse, rebates included (footnotes 1, 2, 17 and 18)', () => {
    const c = (name: string) => communeByName(2025, name)!;
    // 1) 54 % less a 3.5 % rebate: 52.11 %.
    expect(c('Zug')).toEqual({ name: 'Zug', rate: 5_211, catholic: 700, citizens: null });
    // 17) 57 % less 3 points: 54 %.
    expect(c('Oberägeri').rate).toBe(5_400);
    // 18) 63 % less 4 points: 59 %.
    expect(c('Menzingen')).toEqual({
      name: 'Menzingen',
      rate: 5_900,
      catholic: 900,
      citizens: 250,
    });
    expect(c('Baar')).toEqual({ name: 'Baar', rate: 5_100, catholic: 720, citizens: 200 });
    // 2) 9 % less a 20 % rebate: 7.2 %.
    expect(c('Cham').catholic).toBe(720);
    expect(c('Walchwil')).toEqual({
      name: 'Walchwil',
      rate: 5_300,
      catholic: 1_100,
      citizens: 'special',
    });
    expect(c('Neuheim').rate).toBe(6_500);
    expect(zgParamsFor(2025).reformed.value).toBe(750);
    expect(zgParamsFor(2025).canton.value).toBe(8_200);
  });

  it('2026: the changed Steuerfüsse (footnotes 19 to 26) and the canton’s 78 %', () => {
    const c = (name: string) => communeByName(2026, name)!;
    expect(c('Zug')).toEqual({ name: 'Zug', rate: 5_200, catholic: 595, citizens: null });
    // 21) 49 % less a 3 % rebate: 47.53 %; 24) 7 % less 5 %: 6.65 %.
    expect(c('Baar')).toEqual({ name: 'Baar', rate: 4_753, catholic: 665, citizens: 200 });
    // 19) 56 % less 3 points: 53 %.
    expect(c('Steinhausen').rate).toBe(5_300);
    expect(c('Unterägeri').rate).toBe(5_300);
    // 20) 61 % less 6 points: 55 %; 22) 65 % less 6 points: 59 %.
    expect(c('Menzingen').rate).toBe(5_500);
    expect(c('Neuheim').rate).toBe(5_900);
    // 25) 9 % less a 10 % rebate: 8.1 %.
    expect(c('Cham').catholic).toBe(810);
    expect(c('Hünenberg').catholic).toBe(810);
    expect(c('Walchwil').rate).toBe(5_100);
    expect(c('Oberägeri').citizens).toBe(0);
    // 26) 8.5 % less 2.5 points: 6 %.
    expect(zgParamsFor(2026).reformed.value).toBe(600);
    expect(zgParamsFor(2026).canton.value).toBe(7_800);
    expect(zgParamsFor(2026).canton.source).toContain('zg-2026-law-steuergesetz § 2 Abs. 2b');
  });

  it('finds a commune by name or slug, accents, case and punctuation aside', () => {
    expect(communeByName(2025, 'oberageri')?.name).toBe('Oberägeri');
    expect(communeByName(2025, slugOf('Hünenberg'))?.name).toBe('Hünenberg');
    expect(slugOf('Unterägeri')).toBe('unterageri');
    expect(communeByName(2026, 'BAAR')?.name).toBe('Baar');
    expect(communeByName(2025, 'Luzern')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
