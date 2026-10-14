// Zug through the canton interface (packages/rules-ch, canton.ts): computeReturn gives exactly what
// the engine gives for the same household, a fact that would change Zug's tax and that its engine
// does not read is refused, and the communes are the official table's. Synthetic only.
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type HouseholdInput,
} from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  rules,
  ZgInputError,
  type ZgEngineInput,
  type ZugCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Zug's extras under `cantonal`. */
function household(e: ZgEngineInput): HouseholdInput<ZugCantonal> {
  const { church, citizenOf, mainCare, rent, children, ...shared } = e;
  const ages = children?.map((c) => ({
    ...(c.under15 !== undefined ? { under15: c.under15 } : {}),
    ...(c.minor !== undefined ? { minor: c.minor } : {}),
  }));
  const cantonal: ZugCantonal = {
    ...(church ? { church } : {}),
    ...(citizenOf ? { citizenOf } : {}),
    ...(mainCare !== undefined ? { mainCare } : {}),
    ...(rent ? { rent } : {}),
    ...(ages?.some((a) => Object.keys(a).length) ? { children: ages } : {}),
  };
  return {
    ...shared,
    ...(children
      ? {
          children: children.map((c) => {
            const q = { ...c };
            delete q.under15;
            delete q.minor;
            return q;
          }),
        }
      : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: ZgEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Zug',
    civilStatus: 'single',
    church: { p1: 'catholic' },
    rent: amt(30_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(120_000), socialContributions: amt(7_680), pensionFund: amt(8_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(729),
        mealDays: 200,
        pillar3a: amt(7_258),
      },
    ],
    household: { healthPremiums: amt(4_800), donations: amt(500) },
    movable: [{ owner: 'p1', value: amt(80_000), income: amt(400) }],
  },
  {
    taxYear: 2026,
    commune: 'Baar',
    civilStatus: 'married',
    church: { p1: 'reformed', p2: 'reformed' },
    citizenOf: { p1: 'Baar', p2: 'Baar' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(130_000),
            socialContributions: amt(8_320),
            pensionFund: amt(9_500),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 200 },
        mealDays: 200,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(2_500) },
          { gross: amt(6_000), side: true },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        pillar3a: amt(3_000),
        trainingCosts: amt(15_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(18_000) },
      { custody: 'full', under14: false, under15: false, minor: true },
    ],
    household: {
      healthPremiums: amt(14_000),
      medicalCosts: amt(6_000),
      debtInterest: amt(600),
      debts: amt(20_000),
      politicalParty: amt(300),
    },
    movable: [
      { owner: 'household', value: amt(150_000), income: amt(1_200) },
      { owner: 'child1', value: amt(5_000), income: amt(10) },
    ],
  },
  {
    taxYear: 2025,
    commune: 'Cham',
    civilStatus: 'divorced',
    rent: amt(24_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(4_250) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(5_000),
        alimonyReceived: amt(6_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(8_000) }],
    household: {
      healthPremiums: amt(6_500),
      healthSubsidy: amt(1_000),
      childSupportReceived: amt(12_000),
    },
  },
  {
    taxYear: 2026,
    commune: 'Walchwil',
    civilStatus: 'widowed',
    church: { p1: 'catholic' },
    citizenOf: { p1: 'Walchwil' },
    rent: amt(21_600),
    people: [{ id: 'p1', pensionAvs: amt(30_000), pensionOccupational: amt(24_000) }],
    household: {
      healthPremiums: amt(7_200),
      medicalCosts: amt(4_000),
      bankFees: amt(600),
      cash: amt(10_000),
      lifeInsuranceValue: amt(50_000),
      vehicles: amt(8_000),
      otherAssets: amt(2_000),
      otherIncome: amt(500),
    },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(9_000) }],
  },
  {
    taxYear: 2026,
    commune: 'Steinhausen',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainCare: true,
    ifdParentalScale: true,
    rent: amt(26_000),
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(729),
        pillar3a: amt(7_258),
        replacementIncome: amt(2_000),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(6_000) }],
    household: { healthPremiums: amt(5_000), childSupportPaid: amt(0), alimonyPaid: amt(3_000) },
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): ZgEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const names = communesFor(2025).value.map((c) => c.name);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    const year = r() < 0.5 ? 2026 : 2025;
    const couple = base.civilStatus === 'married';
    return {
      ...base,
      taxYear: year,
      commune: pick(names),
      ...(r() < 0.4
        ? {
            church: {
              p1: pick(['catholic', 'reformed', 'none'] as const),
              ...(couple ? { p2: pick(['catholic', 'reformed', 'none'] as const) } : {}),
            },
          }
        : {}),
      ...(r() < 0.4
        ? {
            citizenOf: {
              p1: pick([...names, null]),
              ...(couple ? { p2: pick([...names, null]) } : {}),
            },
          }
        : {}),
      ...(base.childSupport === 'none' && r() < 0.3
        ? { childSupport: pick(['receives', 'pays'] as const) }
        : {}),
      ...(base.mainCare !== undefined && r() < 0.3 ? { mainCare: r() < 0.5 } : {}),
      ...(r() < 0.2 ? { rent: undefined } : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.2 ? { pillar3aCatchUp: amt(2_000) } : {}),
        ...(r() < 0.2
          ? {
              commuteMode: {
                by: 'car',
                transitUsable: false,
                kmOneWay: 30,
                days: pick([200, 230]),
              },
            }
          : {}),
      })),
      household: {
        ...base.household,
        ...(r() < 0.5 ? { medicalCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.5 ? { donations: amt(Math.floor(r() * 30_000)) } : {}),
        ...(r() < 0.3 ? { politicalParty: amt(Math.floor(r() * 25_000)) } : {}),
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

describe('Zug through the canton interface', () => {
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

  it('computes the cantonal and communal tax of each household and the federal tax of its column', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.ifd).not.toBeNull();
      expect(r.total).toBe(r.icc!.taxes.total.amount + r.ifd!.tax.amount);
      expect(r.total).toBeGreaterThan(0);
    }
  });

  it('leaves aside the facts that change neither tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const other: HouseholdInput<ZugCantonal> = {
      ...h,
      people: [
        {
          ...p1,
          age: 'adult',
          mealsIccAllowed: true,
          employments: p1.employments!.map((x) => ({ ...x, workCommune: 'geneve' })),
        },
      ],
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(140) })),
    };
    expect(rules.computeReturn(other)).toEqual(computeReturn(e));
  });

  it('takes childcare given for the household where it can be told apart per child', () => {
    const e = HOUSEHOLDS[2]!; // one child under 14
    const h = household(e);
    const one = { ...h, children: [{ custody: 'full' as const, under14: true }] };
    const r = rules.computeReturn({ ...one, household: { ...h.household, childcare: amt(8_000) } });
    expect(r).toEqual(computeReturn(e));
    // Two children under 14 and more than the own care deduction: the split decides, not computed.
    const two = {
      ...h,
      children: [
        { custody: 'full' as const, under14: true },
        { custody: 'full' as const, under14: true },
      ],
      cantonal: { children: [{ under15: true }, { under15: true }] },
    };
    const split = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(20_000) },
    });
    expect(split.icc).toBeNull();
    expect(split.unsupported.map((x) => x.en).join(' ')).toMatch(/limit is per child/);
    // Split per child (the questionnaire's zg.child_care), it is computed: 20,000 for one child
    // (more than own care), own care for the other.
    const each = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(20_000) },
      cantonal: { ...two.cantonal, childcare: [amt(20_000), undefined] },
    });
    const code = (c: string) => each.icc?.items.find((i) => i.code === c)?.amount;
    expect(code('253')).toBe(-chf(20_000));
    expect(code('404')).toBe(-chf(12_200));
    // Under the own care deduction, any split gives own care for both: computed.
    const under = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(12_000) },
    });
    expect(under.icc?.items.find((i) => i.code === '253')).toBeUndefined();
    expect(under.icc?.items.find((i) => i.code === '404')?.amount).toBe(-chf(24_400));
  });

  it('refuses a fact Zug does not read, a commune by number and an unknown commune', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<ZugCantonal>[] = [
      { ...h, cantonal: { childcare: [amt(1_000)] } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 1711 },
      { ...h, commune: 'Luzern' },
      { ...h, cantonal: { children: [{ under15: true }] } },
      { ...h, cantonal: { citizenOf: { p1: 'Luzern' } } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(ZgInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes with their Steuerfuss, cited, without BFS numbers', () => {
    for (const year of [2025, 2026] as const) {
      const communes = rules.communes(year);
      const table = communesFor(year);
      expect(communes).toHaveLength(11);
      expect(new Set(communes.map((c) => c.slug)).size).toBe(11);
      expect(communes.every((c) => c.bfs === null)).toBe(true);
      expect(communes.find((c) => c.slug === 'walchwil')).toEqual({
        bfs: null,
        slug: 'walchwil',
        name: 'Walchwil',
        rates: { value: [year === 2025 ? 5_300 : 5_100], source: table.source },
      });
    }
    expect(rules.communes(2026).find((c) => c.slug === 'baar')?.rates.value).toEqual([4_753]);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys, its own and what each kind of document gives', () => {
    expect(rules.canton).toBe('ZG');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2025))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'zg.child_under15',
        'zg.child_minor',
        'zg.main_care',
        'zg.rent',
        'zg.church',
        'zg.citizen_of',
        'zg.child_care',
      ]),
    );
    expect(rules.keys(2026)['profile.commune']?.values).toHaveLength(11);
    expect(rules.keys(2026)['zg.citizen_of']?.values).toHaveLength(12);
    expect(rules.documents(2026)).toEqual(
      Object.entries({
        salary_certificate: SALARY_CERTIFICATE_FIELDS_2026,
        ...ATTESTATION_FIELDS_2026,
        ...DOCUMENT_FIELDS_WEALTH_2026,
      }).map(([kind, keys]) => ({ kind, keys })),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/zg');
  });
});
