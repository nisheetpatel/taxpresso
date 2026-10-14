// Aargau through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact that would change Aargau's tax and that its
// engine does not read is refused, and the communes are the official list's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  AgInputError,
  communesFor,
  computeReturn,
  rules,
  type AargauCantonal,
  type AgEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The object without one key. */
function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as Omit<T, K>;
}

/** The same household as the canton interface takes it: Aargau's extras under `cantonal`. */
function household(e: AgEngineInput): HouseholdInput<AargauCantonal> {
  const { mainUpkeep, church, children, ...shared } = e;
  const bands = children?.map((c) => c.band);
  const cantonal: AargauCantonal = {
    ...(mainUpkeep !== undefined ? { mainUpkeep } : {}),
    ...(church ? { church } : {}),
    ...(bands?.some(Boolean) ? { childBands: bands } : {}),
  };
  return {
    ...shared,
    ...(children ? { children: children.map((c) => without(c, 'band')) } : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: AgEngineInput[] = [
  {
    taxYear: 2026,
    commune: 'Aarau',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(80) }],
  },
  {
    taxYear: 2025,
    commune: 'Baden',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed', parish: 'Baden' },
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
        trainingCosts: amt(2_500),
      },
    ],
    children: [
      { custody: 'full', band: 'under14', childcare: amt(12_000) },
      { custody: 'full', band: 'adult', livesWithYou: false },
    ],
    household: {
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
      politicalParty: amt(400),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_500) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  },
  {
    taxYear: 2026,
    commune: 'Wettingen',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainUpkeep: true,
    church: { p1: 'christ_catholic' },
    people: [
      {
        id: 'p1',
        employments: [{ gross: amt(75_000), socialContributions: amt(4_800) }],
        hasPensionFund: false,
        pillar3a: amt(12_000),
        otherProfessionalCosts: amt(5_000),
      },
    ],
    children: [{ custody: 'shared', band: 'under14', childcare: amt(10_000) }],
    household: { cash: amt(2_000), vehicles: amt(15_000), alimonyPaid: amt(6_000) },
  },
  {
    taxYear: 2026,
    commune: 'Rheinfelden',
    civilStatus: 'widowed',
    church: { p1: 'reformed' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(30_000) }],
    household: { bankFees: amt(2_000), medicalCosts: amt(3_000), lifeInsuranceValue: amt(40_000) },
    movable: [{ owner: 'p1', value: amt(1_800_000), income: amt(25_000) }],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): AgEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  // Communes on both lists without further parishes: every church tax can be computed.
  const names = communesFor(2026)
    .value.filter((c) => !c.extra.length)
    .map((c) => c.name)
    .filter((name) => communesFor(2025).value.some((c) => c.name === name && !c.extra.length));
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(names),
      ...(base.church ? { church: without(base.church, 'parish') } : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 25_000)) } : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
        ...(r() < 0.3 ? { politicalParty: amt(Math.floor(r() * 15_000)) } : {}),
      },
      movable: [
        ...(base.movable ?? []),
        {
          owner: 'household',
          value: amt(Math.floor(r() * 6_000_000)),
          income: amt(Math.floor(r() * 30_000)),
        },
      ],
    };
  });
}

describe('Aargau through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    const all = [...HOUSEHOLDS, ...variations(240)];
    for (const e of all) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
    // Most variations compute; the rest say why not (fail closed), the same both ways.
    const computed = all.filter((e) => computeReturn(e).total !== null).length;
    expect(computed).toBeGreaterThan(all.length * 0.8);
    // Some of them reach the maximum burden (StG § 56).
    expect(all.some((e) => computeReturn(e).icc?.taxes.maxBurden)).toBe(true);
  });

  it('computes the cantonal, communal and church tax of each household; no federal part yet', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.total).toBeGreaterThan(0);
      expect(r.icc?.taxes.church).not.toBeNull();
      expect(r.ifd).toBeNull();
    }
  });

  it('leaves aside the insurance premiums (a flat amount) and the facts only Geneva uses', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const extra: HouseholdInput<AargauCantonal> = {
      ...h,
      people: [
        {
          ...p1,
          age: 'adult',
          mealsIccAllowed: true,
          employments: p1.employments!.map((x) => ({ ...x, workCommune: 'geneve' })),
        },
      ],
      household: {
        healthPremiums: amt(4_200),
        accidentPremiums: amt(300),
        lifeInsurancePremiums: amt(1_000),
        savingsInterest: amt(80),
        healthSubsidy: amt(500),
      },
      ifdParentalScale: true,
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(28) })),
    };
    expect(rules.computeReturn(extra)).toEqual(computeReturn(e));
  });

  it('refuses a fact Aargau does not read, and a commune given by BFS number', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<AargauCantonal>[] = [
      { ...h, household: { childcare: amt(5_000) } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, cantonal: { ...h.cantonal, childBands: ['under14'] } },
      { ...h, commune: 4001 },
      { ...h, commune: 'Zürich' },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(AgInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by name with their Steuerfuss, cited, without BFS numbers', () => {
    const communes = rules.communes(2026);
    const table = communesFor(2026);
    expect(communes).toHaveLength(table.value.length);
    expect(new Set(communes.map((c) => c.slug)).size).toBe(communes.length);
    expect(communes.find((c) => c.name === 'Brugg (AG)')).toEqual({
      bfs: null,
      slug: 'brugg-ag',
      name: 'Brugg (AG)',
      rates: { value: [97], source: table.source },
    });
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and what a salary certificate gives', () => {
    expect(rules.canton).toBe('AG');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining(['salary.gross', 'securities.isin', 'accounts.number']),
    );
    expect(rules.documents(2026)).toEqual([
      { kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 },
    ]);
    expect(rules.sourcesIndex).toBe('docs/sources/ag');
  });
});
