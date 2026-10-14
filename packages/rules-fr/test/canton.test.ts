// Fribourg through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact that would change Fribourg's tax and that
// its engine does not read is refused, and the communes are the official tables'. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  FrInputError,
  NOTE,
  rules,
  type FrEngineInput,
  type FribourgCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/**
 * The same household as the canton interface takes it: Fribourg's extras under `cantonal` (the
 * church, each child's age band and whether under 14).
 */
function household(e: FrEngineInput): HouseholdInput<FribourgCantonal> {
  const { church, children, ...shared } = e;
  const own = children?.map((c) => ({
    ...(c.age !== undefined ? { age: c.age } : {}),
    ...(c.under14 !== undefined ? { under14: c.under14 } : {}),
  }));
  const cantonal: FribourgCantonal = {
    ...(church ? { church } : {}),
    ...(own?.some((c) => Object.keys(c).length) ? { children: own } : {}),
  };
  return {
    ...shared,
    ...(children
      ? {
          children: children.map((c) => ({
            custody: c.custody,
            ...(c.livesWithYou !== undefined ? { livesWithYou: c.livesWithYou } : {}),
            ...(c.childcare ? { childcare: c.childcare } : {}),
          })),
        }
      : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: FrEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Fribourg',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_880) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_000),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { lifeInsurancePremiums: amt(1_000), savingsInterest: amt(200) },
    movable: [{ owner: 'p1', value: amt(40_000), income: amt(200) }],
  },
  {
    taxYear: 2025,
    commune: 2125,
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
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        pillar3a: amt(3_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(9_000) },
      { custody: 'full', under14: false, age: 'young' },
    ],
    household: {
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
    taxYear: 2025,
    commune: 'Murten',
    civilStatus: 'divorced',
    church: { p1: 'reformed', parish: 'Meyriez' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(72_000), socialContributions: amt(4_608), pensionFund: amt(3_600) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(5_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(7_000) }],
    household: { healthSubsidy: amt(1_200), childSupportReceived: amt(9_600) },
  },
  {
    taxYear: 2025,
    commune: 'Villars-sur-Glâne',
    civilStatus: 'widowed',
    church: { p1: 'reformed' },
    people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(36_000) }],
    household: {
      bankFees: amt(1_200),
      medicalCosts: amt(6_000),
      cash: amt(5_000),
      vehicles: amt(15_000),
      lifeInsuranceValue: amt(60_000),
      otherAssets: amt(10_000),
    },
    movable: [{ owner: 'p1', value: amt(1_350_000), income: amt(18_000) }],
  },
  {
    taxYear: 2025,
    commune: 'Düdingen',
    civilStatus: 'divorced',
    childSupport: 'pays',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_700) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_500),
        mealDays: 180,
        pillar3a: amt(7_258),
      },
    ],
    children: [{ custody: 'shared' }],
    household: { childSupportPaid: amt(12_000) },
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): FrEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const names = communesFor(2025).value.map((c) => c.name);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    const year = r() < 0.15 ? 2026 : 2025;
    const commune = year === 2026 ? pick(communesFor(2026).value).bfs : pick(names);
    return {
      ...base,
      taxYear: year,
      commune,
      ...(base.church ? { church: { p1: pick(['catholic', 'reformed', 'none'] as const) } } : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.2
          ? { commuteMode: { by: 'car', transitUsable: false, kmOneWay: 30, days: 230 } }
          : {}),
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

describe('Fribourg through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    const all = [...HOUSEHOLDS, ...variations(200)];
    for (const e of all) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
    // The variations reach both computed and not computed results.
    const computed = all.filter((e) => computeReturn(e).icc).length;
    expect(computed).toBeGreaterThan(100);
    expect(computed).toBeLessThan(all.length);
  });

  it('computes the cantonal and communal tax of each household, and the federal tax', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.icc!.taxes.total.amount).toBeGreaterThan(0);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    }
  });

  it('leaves aside the facts that do not change Fribourg’s tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const other: HouseholdInput<FribourgCantonal> = {
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
      household: { ...h.household, healthPremiums: amt(5_500) },
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(70) })),
    };
    expect(rules.computeReturn(other)).toEqual(computeReturn(e));
  });

  it('refuses a fact Fribourg does not read, and an unknown commune', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<FribourgCantonal>[] = [
      { ...h, cantonal: { ...h.cantonal, childcare: [amt(5_000)] } },
      { ...h, cantonal: { ...h.cantonal, children: [{ age: 'young' }] } },
      { ...h, household: { accidentPremiums: amt(500) } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 5586 },
      { ...h, commune: 'Lausanne' },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(FrInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes with their numbers and coefficients, cited; none for 2026', () => {
    const communes = rules.communes(2025);
    const table = communesFor(2025);
    expect(communes).toHaveLength(121);
    expect(new Set(communes.map((c) => c.slug)).size).toBe(121);
    expect(communes.find((c) => c.slug === 'bulle')).toEqual({
      bfs: 2125,
      slug: 'bulle',
      name: 'Bulle',
      rates: { value: [7_430], source: table.source },
    });
    const c2026 = rules.communes(2026);
    expect(c2026).toHaveLength(119);
    expect(c2026.every((c) => c.rates.value.length === 0)).toBe(true);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and its own, and what each document gives', () => {
    expect(rules.canton).toBe('FR');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2025))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'fr.church',
        'fr.parish',
        'fr.child_age',
        'fr.child_care',
        'fr.health_subsidy',
        'fr.life_insurance',
        'fr.savings_interest',
      ]),
    );
    expect(rules.documents(2026)).toContainEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2026).map((d) => d.kind)).toEqual(
      expect.arrayContaining(['pillar3a_attestation', 'health_premiums', 'childcare_invoice']),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/fr');
  });
});

describe('childcare given for the household, each child’s answers, and the answers that replace documents', () => {
  // A single parent in Bulle, 2025, with one or two children under 14 living with them: childcare
  // up to 12,000 per child (4.380, LICD art. 34 al. 3).
  const base = (children: number, cantonal: FribourgCantonal = {}, care = 9_000) =>
    rules.computeReturn({
      taxYear: 2025,
      commune: 2125,
      civilStatus: 'divorced',
      people: [
        { id: 'p1', employments: [{ gross: amt(90_000), socialContributions: amt(5_760) }] },
      ],
      children: Array.from({ length: children }, () => ({ custody: 'full' as const })),
      household: { childcare: amt(care) },
      cantonal: {
        church: { p1: 'none' },
        children: Array.from({ length: children }, () => ({
          age: 'child' as const,
          under14: true,
        })),
        ...cantonal,
      },
    });
  const line = (r: ReturnType<typeof base>, code: string) =>
    r.icc?.items.find((i) => i.code === code)?.amount;

  it('one child: the invoices’ total is that child’s', () => {
    const r = base(1);
    expect(line(r, '4.380')).toBe(chf(-9_000));
    expect(r.limits.find((l) => l.code === '4.380')?.person).toBe('child1');
  });

  it('two children: any split gives the same within one child’s limit, else it is asked', () => {
    expect(line(base(2), '4.380')).toBe(chf(-9_000));
    const split = base(2, {}, 20_000);
    expect(split.icc).toBeNull();
    expect(split.unsupported).toEqual([NOTE.childcareSplit]);
    const given = base(2, { childcare: [amt(15_000), amt(5_000)] }, 20_000);
    expect(line(given, '4.380')).toBe(chf(-(12_000 + 5_000)));
  });

  it('a child of 14 or more: no childcare, and the result says so', () => {
    const older = base(1, { children: [{ age: 'child', under14: false }] });
    expect(line(older, '4.380')).toBeUndefined();
    expect(older.notCounted).toContainEqual(NOTE.childcareNotCounted);
  });

  it('a young adult in training and an adult child: their flat health amounts, or not computed', () => {
    const young = base(1, { children: [{ age: 'young', under14: false }] }, 0);
    expect(line(young, '4.110')).toBe(chf(-(4_810 + 4_210)));
    const adult = base(1, { children: [{ age: 'adult', under14: false }] }, 0);
    expect(adult.unsupported).toContainEqual(NOTE.adultChild);
  });

  it('the subsidy, life insurance and savings interest answered replace the documents’ own', () => {
    const r = rules.computeReturn({
      taxYear: 2025,
      commune: 2125,
      civilStatus: 'single',
      people: [{ id: 'p1', employments: [{ gross: amt(70_000) }] }],
      household: { healthSubsidy: amt(500), savingsInterest: amt(40) },
      movable: [{ owner: 'p1', value: amt(50_000), income: amt(100) }],
      cantonal: {
        church: { p1: 'none' },
        healthSubsidy: amt(1_000),
        lifeInsurancePremiums: amt(600),
        savingsInterest: amt(400),
      },
    });
    expect(line(r, '4.110')).toBe(chf(-(4_810 - 1_000)));
    expect(line(r, '4.120')).toBe(chf(-600));
    // 400 given, never more than the income of the accounts (100): 100.
    expect(line(r, '4.150')).toBe(chf(-100));
    expect(r.notCounted).toContainEqual(NOTE.savingsAbove);
  });
});

describe('tax year 2026 through the interface', () => {
  it('says why the tax waits, and gives the lines of the return', () => {
    const r = rules.computeReturn(household({ ...HOUSEHOLDS[0]!, taxYear: 2026, commune: 2196 }));
    expect(r.icc).toBeNull();
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported).toEqual([NOTE.communes2026]);
    expect(r.unsupported[0]!.de).toMatch(/noch nicht veröffentlicht/);
    expect(r.form?.items.length).toBeGreaterThan(3);
    expect(r.limits.length).toBeGreaterThan(0);
  });
});
