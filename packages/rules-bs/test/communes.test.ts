// The communes' shares and multipliers, generated from the canton's table of rates by
// scripts/bs-communes.mjs (--check compares them with the files). Values read in
// bs-2025-communal-ansaetze-abzuege and bs-2026-communal-ansaetze-abzuege p. 1, the 2025 tariff book
// (bs-2025-tariff-einkommens-vermoegenssteuer p. 2) and Bettingen's page for 2026.
import { describe, expect, it } from 'vitest';
import { communeByName, communesFor, foldName } from '../src/index.js';

describe('communes', () => {
  for (const year of [2025, 2026] as const) {
    it(`${year}: Basel, Riehen and Bettingen, each once`, () => {
      const all = communesFor(year).value;
      expect(all.map((c) => c.name)).toEqual(['Basel', 'Riehen', 'Bettingen']);
      expect(new Set(all.map((c) => foldName(c.name))).size).toBe(3);
    });

    it(`${year}: the city of Basel levies no communal tax, the canton the whole tax`, () => {
      expect(communeByName(year, 'Basel')).toEqual({
        name: 'Basel',
        cantonIncomeShare: 10_000,
        cantonWealthShare: 10_000,
        incomeRate: 0,
        wealthRate: 0,
      });
    });

    it(`${year}: Riehen 40 % on income and 46 % on wealth, Bettingen 37.5 % and 36.5 %, the canton 50 %`, () => {
      expect(communeByName(year, 'riehen')).toEqual({
        name: 'Riehen',
        cantonIncomeShare: 5_000,
        cantonWealthShare: 5_000,
        incomeRate: 4_000,
        wealthRate: 4_600,
      });
      expect(communeByName(year, 'BETTINGEN')).toEqual({
        name: 'Bettingen',
        cantonIncomeShare: 5_000,
        cantonWealthShare: 5_000,
        incomeRate: 3_750,
        wealthRate: 3_650,
      });
    });
  }

  it('cites the table of the year, and an unknown commune or year fails closed', () => {
    expect(communesFor(2026).source).toContain('bs-2026-communal-ansaetze-abzuege p. 1');
    expect(communesFor(2025).source).toContain('bs-2025-tariff-einkommens-vermoegenssteuer p. 2');
    expect(communeByName(2026, 'Liestal')).toBeUndefined();
    expect(() => communesFor(2024)).toThrow(RangeError);
  });
});
