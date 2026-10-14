// Bern through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly what
// the engine gives for the same household, a fact that would change Bern's tax and that its engine
// does not read is refused, and the communes are the official table's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  BeInputError,
  communesFor,
  computeReturn,
  rules,
  type BeEngineInput,
  type BernCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The object without one key. */
function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as Omit<T, K>;
}

/** The same household as the canton interface takes it: Bern's extras under `cantonal`. */
function household(e: BeEngineInput): HouseholdInput<BernCantonal> {
  const { ownHousehold, marriedTariff, sharedChildWealth, church, people, children, ...shared } = e;
  const party = Object.fromEntries(
    people.filter((p) => p.politicalParty).map((p) => [p.id, p.politicalParty]),
  );
  const education = children?.map((c) => c.education);
  const cantonal: BernCantonal = {
    ...(ownHousehold !== undefined ? { ownHousehold } : {}),
    ...(marriedTariff !== undefined ? { marriedTariff } : {}),
    ...(sharedChildWealth !== undefined ? { sharedChildWealth } : {}),
    ...(church ? { church } : {}),
    ...(Object.keys(party).length ? { politicalParty: party } : {}),
    ...(education?.some(Boolean) ? { childEducation: education } : {}),
  };
  return {
    ...shared,
    people: people.map((p) => without(p, 'politicalParty')),
    ...(children ? { children: children.map((c) => without(c, 'education')) } : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: BeEngineInput[] = [
  {
    taxYear: 2026,
    commune: 351,
    civilStatus: 'single',
    ownHousehold: true,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(900),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_200) },
    movable: [{ owner: 'p1', value: amt(30_000), income: amt(60) }],
  },
  {
    taxYear: 2025,
    commune: 942,
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed' },
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
        politicalParty: amt(400),
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
      { custody: 'full', under14: false, education: amt(3_000) },
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
    commune: 355,
    civilStatus: 'divorced',
    ownHousehold: true,
    childSupport: 'none',
    // The federal parental scale: this parent earns more (circular 30).
    ifdParentalScale: true,
    marriedTariff: true,
    sharedChildWealth: 'full',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [{ gross: amt(75_000), socialContributions: amt(4_800) }],
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
function variations(n: number): BeEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const bfs = communesFor(2026)
    .value.filter((c) => c.parishes.length === 1 && c.parishes[0]!.catholic !== null)
    .map((c) => c.bfs)
    .filter((b) => communesFor(2025).value.some((c) => c.bfs === b && c.parishes[0]?.catholic));
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

describe('Bern through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    for (const e of [...HOUSEHOLDS, ...variations(200)]) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
  });

  it('computes the cantonal, communal and federal tax of each household', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      // A side job in 2025: no 2025 document gives the federal flat's rate (fail closed).
      if (e.taxYear === 2025 && e.people.some((p) => p.employments?.some((j) => j.side))) {
        expect(r.ifd).toBeNull();
        expect(r.unsupported).toHaveLength(1);
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
    const genevaFacts: HouseholdInput<BernCantonal> = {
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

  it('refuses a fact Bern does not read, and a commune given by name', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<BernCantonal>[] = [
      // Childcare both per child and for the household.
      {
        ...h,
        children: [{ custody: 'full', childcare: amt(1_000) }],
        household: { childcare: amt(5_000) },
      },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, cantonal: { ...h.cantonal, childEducation: [amt(1_000)] } },
      { ...h, commune: 'bern' },
      { ...h, commune: 9_999 },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(BeInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('takes childcare paid for the household where one child’s limit settles it', () => {
    const h = household(HOUSEHOLDS[0]!);
    const child = { custody: 'full' as const, under14: true };
    const one = rules.computeReturn({
      ...h,
      children: [child],
      household: { ...h.household, childcare: amt(5_000) },
    });
    expect(one.icc?.items.find((i) => i.code === '2.1-betreuung')?.amount).toBe(-500_000);
    // Two children, within one child's limit: whatever the split, all of it counts.
    const small = rules.computeReturn({
      ...h,
      children: [child, child],
      household: { ...h.household, childcare: amt(2_000) },
    });
    expect(small.icc?.items.find((i) => i.code === '2.1-betreuung')?.amount).toBe(-200_000);
    // Two children, above one child's limit: the split decides, so not computed.
    const big = rules.computeReturn({
      ...h,
      children: [child, child],
      household: { ...h.household, childcare: amt(60_000) },
    });
    expect(big.icc).toBeNull();
    expect(big.unsupported.map((n) => n.en).join(' ')).toMatch(/limit is per child/);
    // Split per child (the questionnaire's child_care): it replaces the household's total.
    const split = rules.computeReturn({
      ...h,
      children: [child, child],
      household: { ...h.household, childcare: amt(60_000) },
      cantonal: { ...h.cantonal, childcare: [amt(5_000), amt(3_000)] },
    });
    expect(split.icc?.items.find((i) => i.code === '2.1-betreuung')?.amount).toBe(-800_000);
  });

  it('lists the communes by BFS number with their Steueranlagen, cited', () => {
    const communes = rules.communes(2026);
    const table = communesFor(2026);
    expect(communes).toHaveLength(table.value.length);
    expect(new Set(communes.map((c) => c.slug)).size).toBe(communes.length);
    expect(communes.find((c) => c.bfs === 371)).toEqual({
      bfs: 371,
      slug: 'biel-bienne',
      name: 'Biel/Bienne',
      rates: { value: [16_300], source: table.source },
    });
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys, Bern’s own, and what each document gives', () => {
    expect(rules.canton).toBe('BE');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'be.own_household',
        'be.church',
        'be.parish',
        'be.party',
        'be.child_education',
      ]),
    );
    expect(rules.documents(2026)).toContainEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2026).map((d) => d.kind)).toEqual(
      expect.arrayContaining(['pillar3a_attestation', 'health_premiums', 'bank_attestation']),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/be');
  });
});
