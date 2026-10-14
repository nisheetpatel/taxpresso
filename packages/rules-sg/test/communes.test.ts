// The communes' Gesamtsteuerfüsse and their church areas, generated from the canton's yearly table
// by scripts/sg-communes.mjs (--check compares them with the files, and checks every row against the
// table's own totals). Spot values read in the tables (sg-2025-communal-steuerfuesse,
// sg-2026-communal-steuerfuesse), in percent of the einfache Steuer.
import { describe, expect, it } from 'vitest';
import {
  areaByName,
  churchRate,
  communeByName,
  communesFor,
  foldName,
  sgParamsFor,
  slugOf,
} from '../src/index.js';
import { TABLE_CANTONAL_2025 } from '../src/2025/communes.js';
import { TABLE_CANTONAL_2026 } from '../src/2026/communes.js';

describe('communes', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: 75 political communes, each name once, each with its church areas`, () => {
      const all = communesFor(year).value;
      expect(all).toHaveLength(75);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(75);
      expect(all.reduce((s, c) => s + c.areas.length, 0)).toBe(111);
      for (const c of all) {
        expect(Number.isInteger(c.rate), c.name).toBe(true);
        expect(c.rate, c.name).toBeGreaterThan(5_000);
        expect(c.rate, c.name).toBeLessThan(16_000);
        expect(c.areas.length, c.name).toBeGreaterThan(0);
      }
    });

    it(`${year}: the table states the cantonal multiplier of the tariff module`, () => {
      const table = year === 2025 ? TABLE_CANTONAL_2025 : TABLE_CANTONAL_2026;
      expect(sgParamsFor(year).multiplier.value).toBe(table);
      expect(sgParamsFor(year).christCatholic.value).toBe(2_400);
    });
  }

  it('2025: some communes and their church rates', () => {
    const c = (name: string) => communeByName(2025, name)!;
    expect(c('St. Gallen').rate).toBe(13_800);
    expect(c('Rapperswil-Jona')).toEqual({
      name: 'Rapperswil-Jona',
      rate: 7_400,
      areas: [{ name: 'Rapperswil-Jona', catholic: 1_900, reformed: 2_000 }],
    });
    expect(c('Wil').rate).toBe(11_500);
    expect(c('Gossau').areas).toEqual([
      { name: 'Gossau', catholic: 2_000, reformed: 2_300 },
      { name: 'Arnegg (Andwil)', catholic: 1_900, reformed: 2_300, notes: { catholic: 4 } },
    ]);
    // A half percent: Schänis, Evangelisch 22.5 %.
    expect(c('Schänis').areas[0]?.reformed).toBe(2_250);
    // Footnote 3: Häggenschwil's Evangelical rate.
    expect(c('Häggenschwil').areas[0]?.notes).toEqual({ reformed: 3 });
    expect(c('Mörschwil').rate).toBe(7_000);
    expect(c('Lütisburg').rate).toBe(14_500);
  });

  it('2026: changed multipliers', () => {
    const rate = (name: string) => communeByName(2026, name)?.rate;
    expect(rate('Wittenbach')).toBe(11_900);
    expect(rate('Mörschwil')).toBe(6_700);
    expect(rate('Lütisburg')).toBe(15_500);
    expect(rate('Gaiserwald')).toBe(9_900);
    expect(rate('Rapperswil-Jona')).toBe(7_400);
    expect(communeByName(2026, 'Schänis')?.areas[0]?.reformed).toBe(2_000);
  });

  it('a commune whose main row has no church rates has its areas only', () => {
    const sg = communeByName(2025, 'St. Gallen')!;
    expect(sg.areas.map((a) => a.name)).toEqual([
      'St. Gallen Centrum (C)',
      'St. Gallen Tablat (O)',
      'St. Gallen Straubenzell (W)',
    ]);
    expect(churchRate(sg, 'catholic')).toMatchObject({ rate: 2_600 });
    expect(churchRate(sg, 'reformed')).toBe('area');
    expect(churchRate(sg, 'reformed', 'st gallen straubenzell w')).toMatchObject({ rate: 2_600 });
    expect(churchRate(sg, 'reformed', 'Rorschach')).toBe('area');
    expect(areaByName(sg, 'ST. GALLEN TABLAT (O)')?.reformed).toBe(2_500);
  });

  it('finds a commune by name or slug, accents, case and punctuation aside', () => {
    expect(communeByName(2025, 'st gallen')?.name).toBe('St. Gallen');
    expect(slugOf('Wildhaus-Alt St. Johann')).toBe('wildhaus-alt-st-johann');
    expect(communeByName(2025, slugOf('Wildhaus-Alt St. Johann'))?.name).toBe(
      'Wildhaus-Alt St. Johann',
    );
    expect(communeByName(2026, 'HAGGENSCHWIL')?.name).toBe('Häggenschwil');
    expect(communeByName(2025, 'Zürich')).toBeUndefined();
  });

  it('fails closed for another year', () => {
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
