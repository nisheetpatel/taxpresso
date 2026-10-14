// Lucerne through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly
// what the engine gives for the same household, a fact that would change Lucerne's tax and that
// its engine does not read is refused, and the communes are the official table's. Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  LuInputError,
  NOTE,
  rules,
  type LucerneCantonal,
  type LuEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The object without one key. */
function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as Omit<T, K>;
}

/** The same household as the canton interface takes it: Lucerne's extras under `cantonal`. */
function household(e: LuEngineInput): HouseholdInput<LucerneCantonal> {
  const { familyTariff, church, children, ...shared } = e;
  const away = children?.map((ch) => Boolean(ch.away));
  const cantonal: LucerneCantonal = {
    ...(familyTariff !== undefined ? { familyTariff } : {}),
    ...(church ? { church } : {}),
    ...(away?.some(Boolean) ? { childrenAway: away } : {}),
  };
  return {
    ...shared,
    ...(children ? { children: children.map((ch) => without(ch, 'away')) } : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: LuEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Luzern',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteCost: amt(900),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_200) },
    movable: [{ owner: 'p1', value: amt(30_000), income: amt(60) }],
  },
  {
    taxYear: 2026,
    commune: 'Kriens',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'catholic', children: ['reformed', 'none'] },
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
        trainingCosts: amt(4_000),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(3_000) },
          { gross: amt(6_000), side: true },
        ],
        commuteCost: amt(1_100),
        pillar3a: amt(3_000),
        pensionBuyIn: amt(5_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(15_000) },
      { custody: 'full', under14: false, away: true },
    ],
    household: {
      healthPremiums: amt(14_000),
      donations: amt(1_500),
      debtInterest: amt(3_000),
      debts: amt(90_000),
      politicalParty: amt(300),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_500) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  },
  {
    taxYear: 2025,
    commune: 'Emmen',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(52_000), socialContributions: amt(3_328), pensionFund: amt(2_400) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(2_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(8_000) }],
    household: {
      healthPremiums: amt(3_600),
      healthSubsidy: amt(1_200),
      childSupportReceived: amt(9_600),
    },
  },
  {
    taxYear: 2026,
    commune: 'Horw',
    civilStatus: 'married',
    people: [
      { id: 'p1', pensionAvs: amt(30_240), pensionOccupational: amt(42_000) },
      { id: 'p2', pensionAvs: amt(25_200), pensionOther: amt(3_000) },
    ],
    household: {
      healthPremiums: amt(11_000),
      medicalCosts: amt(9_000),
      bankFees: amt(9_000),
      lifeInsuranceValue: amt(50_000),
      cash: amt(5_000),
      vehicles: amt(12_000),
    },
    movable: [{ owner: 'household', value: amt(1_800_000), income: amt(27_000) }],
  },
  {
    taxYear: 2026,
    commune: 'Luzern',
    civilStatus: 'divorced',
    childSupport: 'none',
    ifdParentalScale: false,
    familyTariff: true,
    church: { p1: 'reformed', children: ['catholic'] },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(90_000), socialContributions: amt(5_760), pensionFund: amt(6_300) },
        ],
        commuteCost: amt(800),
        mealDays: 180,
        pillar3a: amt(7_258),
        replacementIncome: amt(2_000),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(6_000) }],
    household: { healthPremiums: amt(5_000), alimonyPaid: amt(6_000) },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): LuEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const communes = ['Luzern', 'Kriens', 'Emmen', 'Horw', 'Meggen', 'Luthern', 'Sursee', 'Weggis'];
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
        ...(r() < 0.2 ? { otherProfessionalCosts: amt(Math.floor(r() * 6_000)) } : {}),
        ...(r() < 0.1 ? { unemploymentBenefits: amt(Math.floor(r() * 30_000)) } : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
        ...(r() < 0.3 ? { politicalParty: amt(Math.floor(r() * 15_000)) } : {}),
        ...(r() < 0.3 ? { otherIncome: amt(Math.floor(r() * 3_000_000)) } : {}),
        ...(r() < 0.3 ? { otherAssets: amt(Math.floor(r() * 12_000_000)) } : {}),
      },
      movable: [
        ...(base.movable ?? []),
        {
          owner: 'household',
          value: amt(Math.floor(r() * 4_500_000)),
          income: amt(Math.floor(r() * 60_000)),
        },
      ],
    };
  });
}

describe('Lucerne through the canton interface', () => {
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

  it('computes the state, communal and personal tax of each household, and the federal tax', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.icc!.taxes.total.amount).toBeGreaterThan(0);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
    }
  });

  it('leaves aside the facts that do not change Lucerne’s tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const more: HouseholdInput<LucerneCantonal> = {
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

  it('refuses a fact Lucerne does not read, and a commune given by number', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<LucerneCantonal>[] = [
      { ...h, cantonal: { ...h.cantonal, childcare: [amt(5_000)] } },
      { ...h, cantonal: { ...h.cantonal, children: [{ under14: true }] } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 1061 },
      { ...h, commune: 'Bern' },
      { ...h, taxYear: 2025, commune: 'Honau' },
      { ...h, cantonal: { ...h.cantonal, childrenAway: [true] } },
      { ...h, cantonal: { church: { p1: 'catholic', children: ['catholic'] } } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(LuInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes by name with their units, cited', () => {
    for (const year of [2025, 2026]) {
      const table = communesFor(year);
      const list = rules.communes(year);
      expect(list).toHaveLength(table.value.length);
      expect(list.find((c) => c.slug === 'luzern')).toEqual({
        bfs: null,
        slug: 'luzern',
        name: 'Luzern',
        rates: { value: [year === 2025 ? 15_500 : 14_500], source: table.source },
      });
    }
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and its own, and what each document gives', () => {
    expect(rules.canton).toBe('LU');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2026))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'lu.church',
        'lu.child_church',
        'lu.child_under14',
        'lu.child_lives_with_you',
        'lu.child_away',
        'lu.family_tariff',
        'lu.child_care',
      ]),
    );
    expect(rules.documents(2025)).toContainEqual({
      kind: 'salary_certificate',
      keys: SALARY_CERTIFICATE_FIELDS_2026,
    });
    expect(rules.documents(2025).map((d) => d.kind)).toEqual(
      expect.arrayContaining(['pillar3a_attestation', 'health_premiums', 'childcare_invoice']),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/lu');
  });
});

describe('childcare given for the household, and each child’s answers', () => {
  // A single parent in Luzern, 2026, with one or two children under 14 living with them: own care
  // 2,000 each (353) and childcare by others up to 18,200 per child on top (360).
  const base = (children: number, cantonal: LucerneCantonal = {}, care = 12_000) =>
    rules.computeReturn({
      taxYear: 2026,
      commune: 'Luzern',
      civilStatus: 'divorced',
      people: [
        {
          id: 'p1',
          employments: [{ gross: amt(90_000), socialContributions: amt(5_760) }],
        },
      ],
      children: Array.from({ length: children }, () => ({ custody: 'full' as const })),
      household: { childcare: amt(care) },
      cantonal: {
        church: { p1: 'none', children: Array.from({ length: children }, () => 'none' as const) },
        children: Array.from({ length: children }, () => ({ under14: true, livesWithYou: true })),
        ...cantonal,
      },
    });
  const line = (r: ReturnType<typeof base>, code: string) =>
    r.icc?.items.find((i) => i.code === code)?.amount;

  it('one child: the invoices’ total is that child’s', () => {
    const r = base(1);
    expect(line(r, '360')).toBe(chf(-12_000));
    expect(r.limits.find((l) => l.code === '360')?.person).toBe('child1');
  });

  it('two children: any split gives the same within one child’s limit, else it is asked', () => {
    expect(line(base(2), '360')).toBe(chf(-12_000));
    const split = base(2, {}, 30_000);
    expect(split.icc).toBeNull();
    expect(split.unsupported).toEqual([NOTE.childcareSplit]);
    const given = base(2, { childcare: [amt(20_000), amt(10_000)] }, 30_000);
    expect(line(given, '360')).toBe(chf(-(18_200 + 10_000)));
  });

  it('a child of 14 or more, or not living with you: no childcare, and the result says so', () => {
    const older = base(1, { children: [{ under14: false, livesWithYou: true }] });
    expect(line(older, '360')).toBeUndefined();
    expect(line(older, '353')).toBeUndefined();
    expect(older.notCounted).toContainEqual(NOTE.childcareNotCounted);
    const away = base(1, { children: [{ under14: true, livesWithYou: false }] });
    expect(away.notCounted).toContainEqual(NOTE.childcareNotCounted);
    // The federal tax counts no child who does not live with you yet (fail closed).
    expect(away.ifd).toBeNull();
    expect(away.total).toBeNull();
  });
});
