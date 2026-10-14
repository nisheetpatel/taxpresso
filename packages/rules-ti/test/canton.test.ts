// Ticino through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact that would change Ticino's tax and that its
// engine does not read is refused, and the communes are the official table's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  rules,
  TiInputError,
  type TicinoCantonal,
  type TiEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Ticino's extras under `cantonal`. */
function household(e: TiEngineInput): HouseholdInput<TicinoCantonal> {
  const { changedThisYear, people, children, ...shared } = e;
  const workRate: TicinoCantonal['workRate'] = {};
  const monthsWorked: TicinoCantonal['monthsWorked'] = {};
  const sharedPeople = people.map(({ workRate: w, monthsWorked: m, ...p }) => {
    if (w !== undefined) workRate[p.id] = w;
    if (m !== undefined) monthsWorked[p.id] = m;
    return p;
  });
  const minors = children?.map((c) => c.minor);
  const cantonal: TicinoCantonal = {
    ...(Object.keys(workRate).length ? { workRate } : {}),
    ...(Object.keys(monthsWorked).length ? { monthsWorked } : {}),
    ...(minors?.length && minors.every((m) => m !== undefined) ? { childrenMinor: minors } : {}),
    ...(changedThisYear !== undefined ? { changedThisYear } : {}),
  };
  return {
    ...shared,
    people: sharedPeople,
    ...(children
      ? {
          children: children.map((c) => {
            const { minor, ...rest } = c;
            void minor; // under cantonal.childrenMinor
            return rest;
          }),
        }
      : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: TiEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'LUGANO',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_000),
        mealDays: 200,
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    household: { healthPremiums: amt(4_800), medicalCosts: amt(3_500), donations: amt(400) },
    movable: [{ owner: 'p1', value: amt(260_000), income: amt(900) }],
  },
  {
    taxYear: 2026,
    commune: 'BELLINZONA',
    civilStatus: 'married',
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(110_000),
            socialContributions: amt(7_040),
            pensionFund: amt(8_800),
            canteen: true,
          },
        ],
        commuteCost: amt(1_200),
        mealDays: 180,
        pillar3a: amt(7_258),
        workRate: 100,
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(45_000), socialContributions: amt(2_880), pensionFund: amt(1_800) },
        ],
        commuteMode: { by: 'bike' },
        commuteCost: amt(500),
        pillar3a: amt(3_000),
        workRate: 50,
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(9_000), minor: true },
      { custody: 'full', under14: false, minor: true },
    ],
    household: { healthPremiums: amt(12_000), debtInterest: amt(1_500), debts: amt(40_000) },
    movable: [
      { owner: 'household', value: amt(90_000), income: amt(120) },
      { owner: 'child0', value: amt(3_000), income: amt(2) },
    ],
  },
  {
    taxYear: 2026,
    commune: 'MENDRISIO',
    civilStatus: 'widowed',
    changedThisYear: false,
    people: [{ id: 'p1', pensionAvs: amt(26_000), pensionOccupational: amt(30_000) }],
    household: {
      healthPremiums: amt(6_200),
      medicalCosts: amt(4_000),
      bankFees: amt(400),
      lifeInsuranceValue: amt(50_000),
      cash: amt(5_000),
      vehicles: amt(12_000),
    },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(9_000) }],
  },
  {
    taxYear: 2025,
    commune: 'LOCARNO',
    civilStatus: 'divorced',
    childSupport: 'none',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(6_300) },
        ],
        commuteCost: amt(900),
        mealDays: 150,
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(4_000), minor: true }],
    household: { healthPremiums: amt(5_800), donations: amt(2_000) },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(20) }],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): TiEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const communes = ['LUGANO', 'BELLINZONA', 'LOCARNO', 'MENDRISIO', 'ASCONA', 'CHIASSO', 'BIASCA'];
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(communes),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 15_000)) } : {}),
        ...(r() < 0.3 ? { workRate: pick([20, 40, 60, 80, 100]) } : {}),
        ...(r() < 0.2 ? { otherProfessionalCosts: amt(Math.floor(r() * 6_000)) } : {}),
        ...(r() < 0.1 ? { monthsWorked: pick([4, 8, 12]) } : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
        ...(r() < 0.3 ? { politicalParty: amt(Math.floor(r() * 15_000)) } : {}),
        ...(r() < 0.3 ? { cash: amt(Math.floor(r() * 150_000)) } : {}),
        ...(r() < 0.3 ? { alimonyPaid: amt(Math.floor(r() * 20_000)) } : {}),
      },
      movable: [
        ...(base.movable ?? []),
        {
          owner: 'household',
          value: amt(Math.floor(r() * 1_500_000)),
          income: amt(Math.floor(r() * 30_000)),
        },
      ],
    };
  });
}

describe('Ticino through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    const all = [...HOUSEHOLDS, ...variations(300)];
    for (const e of all) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
    // The variations reach both computed and not computed results.
    const computed = all.filter((e) => computeReturn(e).icc).length;
    expect(computed).toBeGreaterThan(100);
    expect(computed).toBeLessThan(all.length);
  });

  it('computes the cantonal and communal tax of each household, and the federal tax derived from it', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household({ ...e, ifdParentalScale: true }));
      expect(r.unsupported).toEqual([]);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    }
  });

  it('takes childcare given for the household as the one child’s, or per child', () => {
    const one = household(HOUSEHOLDS[3]!);
    const { childcare, ...child } = one.children![0]!;
    const given = rules.computeReturn({
      ...one,
      ifdParentalScale: true,
      children: [child],
      household: { ...one.household, childcare: childcare! },
    });
    const direct = rules.computeReturn({ ...one, ifdParentalScale: true });
    expect(given.icc!.items.find((i) => i.code === '20')!.amount).toBe(-chf(4_000));
    expect(given.total).toBe(direct.total);
    // Two children under 14, the invoices' total above one child's limit: the split decides the
    // deduction, so it is asked per child (cantonal.childcare); until then, not computed.
    const two = household(HOUSEHOLDS[1]!);
    const kids = two.children!.map((c) => ({ custody: c.custody, under14: true }));
    const split = rules.computeReturn({
      ...two,
      children: kids,
      household: { ...two.household, childcare: amt(40_000) },
    });
    expect(split.icc).toBeNull();
    expect(split.unsupported.map((n) => n.en).join(' ')).toMatch(/per child under 14/);
    const perChild = rules.computeReturn({
      ...two,
      children: kids,
      household: { ...two.household, childcare: amt(40_000) },
      cantonal: { ...two.cantonal, childcare: [amt(30_000), amt(10_000)] },
    });
    expect(perChild.icc!.items.find((i) => i.code === '20')!.amount).toBe(-chf(26_200 + 10_000));
  });

  it('leaves aside the facts that do not change Ticino’s tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const more: HouseholdInput<TicinoCantonal> = {
      ...h,
      ifdParentalScale: true,
      people: [
        {
          ...p1,
          age: 'adult',
          mealsIccAllowed: true,
          employments: p1.employments!.map((x) => ({ ...x, workCommune: 'geneve' })),
        },
      ],
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(500) })),
    };
    expect(rules.computeReturn(more)).toEqual(computeReturn(e));
  });

  it('refuses a fact Ticino does not read, and a commune given by number', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<TicinoCantonal>[] = [
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 5192 },
      { ...h, commune: 'Basel' },
      { ...h, taxYear: 2025, commune: 'LEMA' },
      { ...h, cantonal: { ...h.cantonal, childrenMinor: [true] } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(TiInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by name with their multiplier, cited', () => {
    for (const year of [2025, 2026]) {
      const table = communesFor(year);
      const list = rules.communes(year);
      expect(list).toHaveLength(table.value.length);
      expect(list.find((c) => c.slug === 'lugano')).toEqual({
        bfs: null,
        slug: 'lugano',
        name: 'LUGANO',
        rates: { value: [year === 2025 ? 7_700 : 8_000], source: table.source },
      });
    }
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and what a salary certificate gives', () => {
    expect(rules.canton).toBe('TI');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining(['salary.gross', 'securities.isin', 'accounts.number']),
    );
    expect(rules.documents(2025)).toContainEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2026).map((d) => d.kind)).toEqual(
      expect.arrayContaining(['pillar3a_attestation', 'health_premiums', 'bank_attestation']),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/ti');
  });
});
