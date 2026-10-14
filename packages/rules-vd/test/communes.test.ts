// The communal rates, generated from the official tables of the arrêtés d'imposition by
// scripts/vd-communes.mjs (--check compares them with the files). Spot values read in
// vd-2025-communal-arretes-imposition and vd-2026-communal-arretes-imposition (sheet
// arreteImposition), and Lausanne's rate in the guide's worked examples (vd-2025-guide p. 61).
import { describe, expect, it } from 'vitest';
import { communeByName, communeRate, communesFor, foldName } from '../src/index.js';

describe('communes', () => {
  for (const year of [2025, 2026] as const) {
    const all = communesFor(year).value;

    it(`${year}: 300 communes, each name once, rates the sum of their parts`, () => {
      expect(all).toHaveLength(300);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(300);
      for (const c of all) {
        expect(Number.isInteger(c.rate), c.name).toBe(true);
        expect(c.main + c.special, c.name).toBe(c.rate);
        expect(c.rate, c.name).toBeGreaterThan(3_000);
        expect(c.rate, c.name).toBeLessThan(10_000);
      }
    });
  }

  it('Lausanne 78.5 % in both years, as the guide’s examples use it (p. 61)', () => {
    expect(communeByName(2025, 'Lausanne')).toEqual({
      name: 'Lausanne',
      rate: 7_850,
      main: 7_850,
      special: 0,
      personalTax: null,
    });
    expect(communeByName(2026, 'lausanne')?.rate).toBe(7_850);
  });

  it('Nyon 61 %, Yverdon-les-Bains 75 %, Montreux 65 % (2025 and 2026)', () => {
    for (const year of [2025, 2026]) {
      expect(communeByName(year, 'Nyon')?.rate).toBe(6_100);
      expect(communeByName(year, 'yverdon les bains')?.rate).toBe(7_500);
      expect(communeByName(year, 'MONTREUX')?.rate).toBe(6_500);
    }
  });

  it('changed between 2025 and 2026: Prangins 55 %, then 57 %; Hermenches 73.5 %, then 78 %', () => {
    expect(communeByName(2025, 'Prangins')?.rate).toBe(5_500);
    expect(communeByName(2026, 'Prangins')?.rate).toBe(5_700);
    expect(communeByName(2025, 'Hermenches')?.rate).toBe(7_350);
    expect(communeByName(2026, 'Hermenches')?.rate).toBe(7_800);
  });

  it('a special earmarked tax counts in the rate: Château-d’Oex 79.5 + 2 = 81.5 %', () => {
    expect(communeByName(2026, "Château-d'Oex")).toMatchObject({
      rate: 8_150,
      main: 7_950,
      special: 200,
    });
    expect(communeByName(2025, 'Ormont-Dessous')).toMatchObject({ main: 7_490, special: 210 });
  });

  it('the fixed personal tax where the table gives one (Moudon CHF 10, Mutrux CHF 6)', () => {
    expect(communeByName(2025, 'Moudon')?.personalTax).toBe(1_000);
    expect(communeByName(2026, 'Mutrux')?.personalTax).toBe(600);
  });

  it('fractions of communes: Le Chenit 58.5 %, Le Brassus + 8 %; the part must be named', () => {
    const chenit = communeByName(2025, 'Le Chenit')!;
    expect(chenit.fractions).toEqual([
      { name: 'Le Brassus', rate: 800 },
      { name: 'Le Sentier', rate: 800 },
      { name: "L'Orient", rate: 1_000 },
    ]);
    expect(communeRate(chenit)).toBe('part');
    expect(communeRate(chenit, 'Le Brassus')).toEqual({
      rate: 6_650,
      fraction: { name: 'Le Brassus', rate: 800 },
    });
    expect(communeRate(chenit, 'Le Chenit')).toEqual({ rate: 5_850, fraction: null });
    expect(communeRate(chenit, 'Lausanne')).toBe('part');
    expect(communeByName(2026, "L'Abbaye")?.fractions).toEqual([{ name: 'Les Bioux', rate: 300 }]);
    expect(communeRate(communeByName(2026, 'Nyon')!)).toEqual({ rate: 6_100, fraction: null });
  });

  it('finds a commune by its name, accents, case and punctuation aside', () => {
    expect(communeByName(2026, 'chateau d oex')?.name).toBe("Château-d'Oex");
    expect(communeByName(2026, 'forel-lavaux')?.name).toBe('Forel (Lavaux)');
    expect(communeByName(2026, 'Genève')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
