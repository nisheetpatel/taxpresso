// Zurich through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact that would change Zurich's tax and that its
// engine does not read is refused, and the communes are the official table's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  rules,
  ZhInputError,
  type ZhEngineInput,
  type ZurichCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Zurich's extras under `cantonal`. */
function household(e: ZhEngineInput): HouseholdInput<ZurichCantonal> {
  const { communeVariant, marriedTariff, church, ...shared } = e;
  const cantonal = {
    ...(communeVariant !== undefined ? { communeVariant } : {}),
    ...(marriedTariff !== undefined ? { marriedTariff } : {}),
    ...(church ? { church } : {}),
  };
  return { ...shared, ...(Object.keys(cantonal).length ? { cantonal } : {}) };
}

const HOUSEHOLDS: ZhEngineInput[] = [
  {
    taxYear: 2026,
    commune: 261,
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(5_400) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800) },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(200) }],
  },
  {
    taxYear: 2025,
    commune: 230,
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(110_000),
            socialContributions: amt(7_040),
            pensionFund: amt(7_700),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 18, days: 220 },
        mealDays: 220,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(50_000), socialContributions: amt(3_200), pensionFund: amt(2_500) },
          { gross: amt(6_000), side: true },
        ],
        commuteCost: amt(1_100),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', livesWithYou: true },
    ],
    church: { p1: 'reformed', p2: 'catholic' },
    household: {
      healthPremiums: amt(13_000),
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
  },
  {
    taxYear: 2026,
    // Uster: two parts with different multipliers, the first one here.
    commune: 198,
    communeVariant: 1,
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [{ gross: amt(75_000), socialContributions: amt(4_800) }],
        hasPensionFund: false,
        pillar3a: amt(12_000),
        otherProfessionalCosts: amt(5_000),
      },
    ],
    children: [{ custody: 'shared' }],
    childSupport: 'none',
    marriedTariff: true,
    household: { cash: amt(2_000), vehicles: amt(15_000), childSupportReceived: amt(6_000) },
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): ZhEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const bfs = communesFor(2026)
    .value.filter((c) => new Set(c.rates).size === 1)
    .map((c) => c.bfs);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(bfs),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
      },
    };
  });
}

describe('Zurich through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    for (const e of [...HOUSEHOLDS, ...variations(200)]) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
  });

  it('computes the cantonal and communal tax of each household; the federal tax is not mapped yet', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.total).toBeGreaterThan(0);
      expect(r.ifd).toBeNull();
    }
  });

  it('leaves aside the facts only Geneva uses', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const genevaFacts: HouseholdInput<ZurichCantonal> = {
      ...h,
      people: [
        {
          ...p1,
          age: 'adult',
          mealsIccAllowed: true,
          employments: p1.employments!.map((x) => ({ ...x, workCommune: 'geneve' })),
        },
      ],
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(70) })),
    };
    expect(rules.computeReturn(genevaFacts)).toEqual(computeReturn(e));
  });

  it('refuses a fact Zurich does not read, and a commune given by name', () => {
    const h = household(HOUSEHOLDS[0]!);
    const p1 = h.people[0]!;
    const refused: HouseholdInput<ZurichCantonal>[] = [
      { ...h, people: [{ ...p1, pillar3aCatchUp: amt(2_000) }] },
      { ...h, household: { childcare: amt(5_000) } },
      { ...h, movable: [{ owner: 'child0', value: amt(1_000) }] },
      { ...h, commune: 'zurich' },
      { ...h, commune: 9_999 },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(ZhInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by BFS number with their multipliers, cited', () => {
    const communes = rules.communes(2026);
    const table = communesFor(2026);
    expect(communes).toHaveLength(table.value.length);
    expect(new Set(communes.map((c) => c.slug)).size).toBe(communes.length);
    const zurich = communes.find((c) => c.bfs === 261);
    expect(zurich).toEqual({
      bfs: 261,
      slug: 'zurich',
      name: 'Zürich',
      rates: { value: table.value.find((c) => c.bfs === 261)!.rates, source: table.source },
    });
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys, Zurich’s own, and what each document gives', () => {
    expect(rules.canton).toBe('ZH');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.civil_status',
        'profile.commune',
        'zh.church',
        'pillar3a.paid',
        'bank.balance',
      ]),
    );
    expect(rules.keys(2026)['profile.commune']?.values).toContain('198-2');
    expect(rules.documents(2026)[0]).toEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2026).map((d) => d.kind)).toContain('pillar3a_attestation');
    expect(rules.documents(2026).map((d) => d.kind)).not.toContain('tax_assessment');
    expect(rules.sourcesIndex).toBe('docs/sources/zh');
  });
});
