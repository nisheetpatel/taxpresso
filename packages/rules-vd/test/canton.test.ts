// Vaud through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly what
// the engine gives for the same household, a fact that would change Vaud's tax and that its engine
// does not read is refused, and the communes are the official table's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  FEDERAL_NOTE,
  rules,
  VdInputError,
  type VaudCantonal,
  type VdEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Vaud's extras under `cantonal`. */
function household(e: VdEngineInput): HouseholdInput<VaudCantonal> {
  const {
    communePart,
    ownHousehold,
    mainUpkeep,
    rent,
    furnitureInsurance,
    furnitureWithin,
    ...shared
  } = e;
  const cantonal: VaudCantonal = {
    ...(communePart !== undefined ? { communePart } : {}),
    ...(ownHousehold !== undefined ? { ownHousehold } : {}),
    ...(mainUpkeep !== undefined ? { mainUpkeep } : {}),
    ...(rent !== undefined ? { rent } : {}),
    ...(furnitureInsurance !== undefined ? { furnitureInsurance } : {}),
    ...(furnitureWithin !== undefined ? { furnitureWithin } : {}),
  };
  return { ...shared, ...(Object.keys(cantonal).length ? { cantonal } : {}) };
}

const HOUSEHOLDS: VdEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Lausanne',
    civilStatus: 'single',
    rent: amt(18_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport', kmOneWay: 12 },
        mealDays: 220,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800), savingsInterest: amt(60) },
    movable: [{ owner: 'p1', value: amt(30_000), income: amt(60) }],
  },
  {
    taxYear: 2025,
    commune: 'Nyon',
    civilStatus: 'married',
    rent: amt(30_000),
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
        commuteMode: { by: 'public_transport', kmOneWay: 8 },
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', under14: false },
    ],
    household: {
      healthPremiums: amt(13_000),
      medicalCosts: amt(9_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_500) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  },
  {
    taxYear: 2026,
    commune: 'Yverdon-les-Bains',
    civilStatus: 'divorced',
    ownHousehold: true,
    rent: amt(21_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(72_000), socialContributions: amt(4_608), pensionFund: amt(3_600) },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 10, days: 200 },
        mealDays: 200,
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(9_000) }],
    household: { healthPremiums: amt(6_200), childSupportReceived: amt(9_600) },
  },
  {
    taxYear: 2025,
    commune: 'Morges',
    civilStatus: 'divorced',
    childSupport: 'none',
    ifdParentalScale: false,
    ownHousehold: true,
    mainUpkeep: true,
    rent: amt(13_000),
    furnitureInsurance: amt(80_000),
    people: [
      {
        id: 'p1',
        employments: [{ gross: amt(95_000), socialContributions: amt(6_080) }],
        hasPensionFund: false,
        pillar3a: amt(12_000),
        otherProfessionalCosts: amt(5_000),
      },
    ],
    children: [{ custody: 'shared', childcare: amt(10_000) }],
    household: { cash: amt(2_000), vehicles: amt(15_000), healthPremiums: amt(3_000) },
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): VdEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const names = communesFor(2026)
    .value.filter((c) => !c.fractions)
    .map((c) => c.name);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(names),
      ...(r() < 0.5 ? { rent: amt(Math.floor(r() * 40_000)) } : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
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
          value: amt(Math.floor(r() * 3_000_000)),
          income: amt(Math.floor(r() * 30_000)),
        },
      ],
    };
  });
}

describe('Vaud through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    const all = [...HOUSEHOLDS, ...variations(200)];
    for (const e of all) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
    // The variations reach both computed and not computed results.
    const computed = all.filter((e) => computeReturn(e).icc).length;
    expect(computed).toBeGreaterThan(50);
    expect(computed).toBeLessThan(all.length);
  });

  it('computes the cantonal and communal tax and the federal tax of each household', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.icc).not.toBeNull();
      // A side job in 2025: no 2025 document gives its federal flat, so the federal tax fails closed.
      const side = e.taxYear === 2025 && e.people.some((p) => p.employments?.some((x) => x.side));
      if (side) {
        expect(r.unsupported).toEqual([FEDERAL_NOTE.sideJob2025]);
        expect(r.ifd).toBeNull();
        expect(r.total).toBeNull();
        continue;
      }
      expect(r.unsupported).toEqual([]);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    }
  });

  it('leaves aside the facts only Geneva uses', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const genevaFacts: HouseholdInput<VaudCantonal> = {
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

  it('refuses a fact Vaud does not read, and a commune given by number', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<VaudCantonal>[] = [
      { ...h, cantonal: { ...h.cantonal, childcare: [amt(5_000)] } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 5586 },
      { ...h, commune: 'Bern' },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(VdInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by name with their rates, cited; fractions after the commune', () => {
    const communes = rules.communes(2026);
    const table = communesFor(2026);
    expect(communes).toHaveLength(300);
    expect(new Set(communes.map((c) => c.slug)).size).toBe(300);
    expect(communes.find((c) => c.slug === 'lausanne')).toEqual({
      bfs: null,
      slug: 'lausanne',
      name: 'Lausanne',
      rates: { value: [7_850], source: table.source },
    });
    expect(communes.find((c) => c.slug === 'le-chenit')?.rates.value).toEqual([
      5_850, 6_650, 6_650, 6_850,
    ]);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and what a salary certificate gives', () => {
    expect(rules.canton).toBe('VD');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'vd.commune_part',
        'vd.own_household',
        'vd.main_upkeep',
        'vd.rent',
        'vd.contents_high',
        'vd.contents_value',
        'vd.child_care',
        'vd.savings_interest',
      ]),
    );
    expect(rules.documents(2026)).toContainEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2026).map((d) => d.kind)).toEqual(
      expect.arrayContaining(['pillar3a_attestation', 'health_premiums', 'bank_attestation']),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/vd');
  });
});
