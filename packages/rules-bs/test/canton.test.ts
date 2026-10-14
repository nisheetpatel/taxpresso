// Basel-Stadt through the canton interface (packages/rules-ch, canton.ts): computeReturn gives
// exactly what the engine gives for the same household, a fact that would change Basel-Stadt's tax
// and that its engine does not read is refused, and the communes are the official table's.
// Synthetic only.
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type HouseholdInput,
} from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  BsInputError,
  communesFor,
  computeReturn,
  rules,
  type BaselCantonal,
  type BsEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Basel-Stadt's extras under `cantonal`. */
function household(e: BsEngineInput): HouseholdInput<BaselCantonal> {
  const { cohabiting, mainUpkeep, church, people, children, ...shared } = e;
  const workRate: BaselCantonal['workRate'] = {};
  const referenceAge: BaselCantonal['referenceAge'] = {};
  const sharedPeople = people.map(({ workRate: w, referenceAge: a, ...p }) => {
    if (w !== undefined) workRate[p.id] = w;
    if (a !== undefined) referenceAge[p.id] = a;
    return p;
  });
  const minors = children?.map((c) => c.minor);
  const cantonal: BaselCantonal = {
    ...(Object.keys(workRate).length ? { workRate } : {}),
    ...(Object.keys(referenceAge).length ? { referenceAge } : {}),
    ...(minors?.every((m) => m !== undefined) && minors.length ? { childrenMinor: minors } : {}),
    ...(cohabiting !== undefined ? { cohabiting } : {}),
    ...(mainUpkeep !== undefined ? { mainUpkeep } : {}),
    ...(church !== undefined ? { church } : {}),
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

const HOUSEHOLDS: BsEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Basel',
    civilStatus: 'single',
    church: false,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(92_000), socialContributions: amt(5_888), pensionFund: amt(5_520) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(824),
        mealDays: 180,
        pillar3a: amt(7_258),
        workRate: 100,
        referenceAge: false,
      },
    ],
    household: { medicalCosts: amt(5_000), donations: amt(1_000), bankFees: amt(120) },
    movable: [{ owner: 'p1', value: amt(130_000), income: amt(1_460) }],
  },
  {
    taxYear: 2026,
    commune: 'Riehen',
    civilStatus: 'married',
    church: true,
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(120_000),
            socialContributions: amt(7_680),
            pensionFund: amt(9_000),
            canteen: true,
          },
        ],
        commuteCost: amt(1_032),
        mealDays: 200,
        pillar3a: amt(7_258),
        workRate: 100,
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(48_000), socialContributions: amt(3_072), pensionFund: amt(2_400) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(4_000),
        workRate: 50,
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(14_000), minor: true },
      { custody: 'full', under14: false, minor: true },
    ],
    household: { debtInterest: amt(2_000), debts: amt(50_000) },
    movable: [
      { owner: 'household', value: amt(80_000), income: amt(80) },
      { owner: 'child0', value: amt(5_000), income: amt(5) },
    ],
  },
  {
    taxYear: 2025,
    commune: 'Bettingen',
    civilStatus: 'widowed',
    church: false,
    people: [
      { id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(24_000), referenceAge: true },
    ],
    household: { lifeInsuranceValue: amt(40_000), cash: amt(10_000), bankFees: amt(600) },
    movable: [{ owner: 'p1', value: amt(350_000), income: amt(4_300) }],
  },
  {
    taxYear: 2026,
    commune: 'Basel',
    civilStatus: 'divorced',
    childSupport: 'none',
    ifdParentalScale: true,
    mainUpkeep: true,
    cohabiting: false,
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteCost: amt(824),
        pillar3a: amt(7_258),
        workRate: 100,
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(9_000) }],
    movable: [{ owner: 'p1', value: amt(25_000), income: amt(25) }],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): BsEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    return {
      ...base,
      taxYear: pick([2025, 2026] as const),
      commune: pick(['Basel', 'Riehen', 'Bettingen']),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 15_000)) } : {}),
        ...(r() < 0.3 ? { workRate: pick([20, 40, 60, 80, 100]) } : {}),
        ...(r() < 0.2 ? { otherProfessionalCosts: amt(Math.floor(r() * 6_000)) } : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
        ...(r() < 0.3 ? { politicalParty: amt(Math.floor(r() * 15_000)) } : {}),
        ...(r() < 0.3 ? { cash: amt(Math.floor(r() * 150_000)) } : {}),
      },
      movable: [
        ...(base.movable ?? []),
        {
          owner: 'household',
          value: amt(Math.floor(r() * 300_000)),
          income: amt(Math.floor(r() * 9_000)),
        },
      ],
    };
  });
}

describe('Basel-Stadt through the canton interface', () => {
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

  it('computes the cantonal and communal tax of each household, and the federal tax of the Bund column', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    }
  });

  it('leaves aside the facts that do not change Basel-Stadt’s tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const more: HouseholdInput<BaselCantonal> = {
      ...h,
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

  it('counts the insurance premiums for the federal tax only (the cantonal deduction is a flat amount)', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const premiums = {
      healthPremiums: amt(4_800),
      accidentPremiums: amt(300),
      healthSubsidy: amt(1_000),
      lifeInsurancePremiums: amt(1_200),
      savingsInterest: amt(60),
    };
    const r = rules.computeReturn({ ...h, household: { ...h.household, ...premiums } });
    const without = computeReturn(e);
    expect(r.icc?.taxes.total.amount).toBe(without.icc?.taxes.total.amount);
    expect(r.ifd!.tax.amount).toBeLessThan(without.ifd!.tax.amount);
    expect(r.ifd!.items.find((i) => i.code === '631')?.amount).toBe(chf(-1_800));
  });

  it('takes childcare paid for the household as a whole, and split per child', () => {
    const e = HOUSEHOLDS[1]!;
    const h = household(e);
    const { children, ...rest } = h;
    const kids = children!.map(({ childcare, ...c }) => (void childcare, c));
    // One child under 14: the household's childcare is that child's.
    const whole = rules.computeReturn({
      ...rest,
      children: kids,
      household: { ...h.household, childcare: amt(14_000) },
    });
    expect(whole.icc?.items.find((i) => i.code === '670')?.amount).toBe(chf(-14_000));
    expect(whole.icc?.taxes.total.amount).toBe(computeReturn(e).icc?.taxes.total.amount);
    // Two children under 14 and a total above one child's limit: the split decides.
    const two = kids.map((c) => ({ ...c, under14: true }));
    const split = rules.computeReturn({
      ...rest,
      children: two,
      household: { ...h.household, childcare: amt(40_000) },
    });
    expect(split.icc).toBeNull();
    expect(split.unsupported.map((u) => u.en).join(' ')).toMatch(
      /Give the childcare paid for each child/,
    );
    const given = rules.computeReturn({
      ...rest,
      children: two,
      household: { ...h.household, childcare: amt(40_000) },
      cantonal: { ...h.cantonal, childcare: [amt(30_000), amt(10_000)] },
    });
    expect(given.icc?.items.find((i) => i.code === '670')?.amount).toBe(chf(-36_000));
  });

  it('takes an account or security without its income as having none, as the shared input says', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const r = rules.computeReturn({
      ...h,
      movable: [
        { owner: 'p1', value: amt(130_000) },
        { owner: 'p1', income: amt(1_460) },
      ],
    });
    expect(r.icc?.taxes.total.amount).toBe(computeReturn(e).icc?.taxes.total.amount);
    const unknown = rules.computeReturn({
      ...h,
      movable: [{ owner: 'p1', value: { ...amt(130_000), complete: false } }],
    });
    expect(unknown.complete).toBe(false);
  });

  it('refuses a fact Basel-Stadt does not read, and a commune given by number', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<BaselCantonal>[] = [
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, cantonal: { ...h.cantonal, childcare: [amt(1_000)] } },
      { ...h, commune: 2701 },
      { ...h, commune: 'Liestal' },
      { ...h, cantonal: { ...h.cantonal, childrenMinor: [true] } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(BsInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by name with their multipliers on income and wealth, cited', () => {
    for (const year of [2025, 2026]) {
      const table = communesFor(year);
      expect(rules.communes(year)).toEqual([
        { bfs: null, slug: 'basel', name: 'Basel', rates: { value: [0, 0], source: table.source } },
        {
          bfs: null,
          slug: 'riehen',
          name: 'Riehen',
          rates: { value: [4_000, 4_600], source: table.source },
        },
        {
          bfs: null,
          slug: 'bettingen',
          name: 'Bettingen',
          rates: { value: [3_750, 3_650], source: table.source },
        },
      ]);
    }
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys, its own, and what each kind of document gives', () => {
    expect(rules.canton).toBe('BS');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'bs.work_rate',
        'bs.reference_age',
        'bs.cohabiting',
        'bs.main_upkeep',
        'bs.child_minor',
        'bs.church',
      ]),
    );
    expect(rules.keys(2026)['profile.commune']?.values).toEqual(['basel', 'riehen', 'bettingen']);
    expect(rules.documents(2025)).toEqual([
      { kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 },
      ...Object.entries({ ...ATTESTATION_FIELDS_2026, ...DOCUMENT_FIELDS_WEALTH_2026 }).map(
        ([kind, keys]) => ({ kind, keys }),
      ),
    ]);
    expect(rules.sourcesIndex).toBe('docs/sources/bs');
  });
});
