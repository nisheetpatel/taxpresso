// A year's notes cite that year's documents (docs/design/tax-years.md): the 2025 return explains
// its travel costs with the 2025 guide, never with the 2026 federal instructions.
import { describe, expect, it } from 'vitest';
import { computeReturn, type EngineInput } from '../src/index.js';

/** Francs as centimes, for the inputs written here. */
const chf = (francs: number) => francs * 100;

const job = (gross: number, social: number, lpp: number) => ({
  gross: { value: chf(gross) },
  socialContributions: { value: chf(social) },
  pensionFund: { value: chf(lpp) },
});

/** One by car with no usable public transport (actual costs above the flat), one by bike. */
const household = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'lancy',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [job(95_000, 6_200, 6_000)],
      commuteMode: { by: 'car', transitUsable: false, kmOneWay: 30, days: 220 },
      // Meals that count for the Geneva tax too (mealsIccAllowed): the actual costs pass the flat
      // deduction, so the travel costs are counted, with their note.
      mealDays: 200,
      mealsIccAllowed: true,
    },
    {
      id: 'p2',
      employments: [job(52_000, 3_400, 2_600)],
      commuteMode: { by: 'bike' },
      mealDays: 0,
    },
  ],
});

const notes = (taxYear: 2025 | 2026) =>
  computeReturn(household(taxYear)).unverifiedRules.map((t) => t.en);

describe('notes by tax year', () => {
  it('2026 keeps its notes as they were (the 2026 federal instructions)', () => {
    const n = notes(2026);
    expect(n.some((t) => /Bike or moped.*Form\. 2a 2026 p\. 6/.test(t))).toBe(true);
    expect(n.some((t) => /Travel costs, cantonal tax.*Form\. 2a 2026 p\. 6/.test(t))).toBe(true);
  });

  it('2025 cites the 2025 guide, and no 2026 document', () => {
    const n = notes(2025);
    expect(n.some((t) => /Bike or moped.*ge-2025-guide-declaration-pp p\. 20/.test(t))).toBe(true);
    expect(n.some((t) => /Travel costs, cantonal tax.*\(guide p\. 20\)/.test(t))).toBe(true);
    expect(n.join('\n')).not.toMatch(/2026/);
  });
});
