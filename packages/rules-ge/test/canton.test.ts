// Geneva through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact Geneva does not read is refused, and the
// communes, keys and documents are the engine's own. Synthetic households only.
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  COMMUNE_CENTIMES_2026,
  COMMUNES_2026,
  computeReturn,
  documentFields,
  EngineInputError,
  KEYS_2026,
  rules,
  type EngineInput,
  type GenevaCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number, status?: 'stated' | 'extracted' | 'estimate') => ({
  value: chf(francs),
  ...(status ? { status } : {}),
});

/** The same household as the canton interface takes it: Geneva's extras under `cantonal`. */
function household(e: EngineInput): HouseholdInput<GenevaCantonal> {
  const { splitting, wealthItems, ...shared } = e;
  const cantonal = { ...(splitting ? { splitting } : {}), ...(wealthItems ? { wealthItems } : {}) };
  return { ...shared, ...(Object.keys(cantonal).length ? { cantonal } : {}) };
}

const HOUSEHOLDS: EngineInput[] = [
  {
    taxYear: 2026,
    commune: 'geneve',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_000), pensionFund: amt(5_500) },
        ],
        pillar3a: amt(7_258),
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(500),
        mealDays: 200,
      },
    ],
    household: { healthPremiums: amt(6_000), medicalCosts: amt(3_000), donations: amt(500) },
    movable: [{ owner: 'p1', value: amt(80_000), income: amt(300), withholdingSwiss: amt(105) }],
  },
  {
    taxYear: 2025,
    commune: 'carouge',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(120_000),
            socialContributions: amt(7_600),
            pensionFund: amt(8_000),
            workCommune: 'geneve',
          },
        ],
        pillar3a: amt(7_258),
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 18, days: 220 },
        mealDays: 220,
        mealsIccAllowed: true,
      },
      {
        id: 'p2',
        employments: [{ gross: amt(48_000), socialContributions: amt(3_000), canteen: true }],
        hasPensionFund: false,
        pillar3a: amt(9_000, 'extracted'),
        commuteMode: { by: 'bike' },
        mealDays: 180,
        trainingCosts: amt(2_500),
      },
    ],
    children: [{ custody: 'full', childcare: amt(14_000) }, { custody: 'full' }],
    household: {
      healthPremiums: amt(14_000),
      lifeInsurancePremiums: amt(1_200),
      debtInterest: amt(2_000),
      debts: amt(60_000),
      politicalParty: amt(300),
    },
  },
  {
    taxYear: 2026,
    commune: 'lancy',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [{ gross: amt(70_000, 'estimate'), socialContributions: amt(4_400) }],
        otherProfessionalCosts: amt(6_000),
        pillar3aCatchUp: amt(2_000),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(5_000) }],
    childSupport: 'none',
    ifdParentalScale: true,
    splitting: 'partial',
  },
  {
    taxYear: 2026,
    commune: 'vernier',
    civilStatus: 'widowed',
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(22_000) }],
    household: { medicalCosts: amt(9_000), alimonyPaid: amt(0) },
    wealthItems: [
      {
        code: '14.00',
        part: 'wealth',
        person: 'p1',
        centimes: chf(250_000),
        taxes: ['icc', 'ifd'],
        estimate: false,
        complete: true,
        label: { en: 'Securities', fr: 'Titres' },
        source: 'ge-2025-guide-declaration-pp p. 41',
      },
    ],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): EngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const slugs = COMMUNES_2026.map((c) => c.slug);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(slugs),
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

describe('Geneva through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    for (const e of [...HOUSEHOLDS, ...variations(200)]) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
  });

  it('computes the tax of each household (not an error on both sides)', () => {
    for (const e of HOUSEHOLDS) expect(rules.computeReturn(household(e)).total).toBeGreaterThan(0);
  });

  it('refuses a fact Geneva does not read, and an unknown commune', () => {
    const [h] = HOUSEHOLDS.map(household);
    const p1 = h!.people[0]!;
    const refused: HouseholdInput<GenevaCantonal>[] = [
      { ...h!, people: [{ ...p1, unemploymentBenefits: amt(1_000) }] },
      { ...h!, people: [{ ...p1, employments: [{ gross: amt(1_000), side: true }] }] },
      { ...h!, children: [{ custody: 'full', livesWithYou: false }] },
      { ...h!, household: { cash: amt(1_000) } },
      { ...h!, commune: 261 },
      { ...h!, commune: 'zurich' },
      { ...h!, people: [{ ...p1, employments: [{ gross: amt(1_000), workCommune: 'bern' }] }] },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(EngineInputError);
    expect(() => rules.computeReturn({ ...h!, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes with their centimes, cited', () => {
    const communes = rules.communes(2026);
    expect(communes).toHaveLength(COMMUNES_2026.length);
    const geneve = communes.find((c) => c.slug === 'geneve');
    expect(geneve).toEqual({
      bfs: null,
      slug: 'geneve',
      name: 'Genève',
      rates: { value: [COMMUNE_CENTIMES_2026.value.geneve], source: COMMUNE_CENTIMES_2026.source },
    });
    expect(rules.communes(2025)).toHaveLength(COMMUNES_2026.length);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the keys and what each document gives', () => {
    expect(rules.canton).toBe('GE');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(rules.keys(2026)).toBe(KEYS_2026);
    const salary = rules.documents(2026).find((d) => d.kind === 'salary_certificate');
    expect(salary?.keys).toEqual(documentFields('salary_certificate'));
    expect(rules.sourcesIndex).toBe('docs/sources/ge');
  });
});
