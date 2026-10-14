// St. Gallen through the canton interface (packages/rules-ch, canton.ts): computeReturn gives
// exactly what the engine gives for the same household, a fact that would change St. Gallen's tax
// and that its engine does not read is refused, and the communes are the official table's.
// Synthetic only.
import { SALARY_CERTIFICATE_FIELDS_2026, type HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  communesFor,
  computeReturn,
  rules,
  SgInputError,
  type SgEngineInput,
  type StGallenCantonal,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: St. Gallen's extras under `cantonal`. */
function household(e: SgEngineInput): HouseholdInput<StGallenCantonal> {
  const { church, mainUpkeep, children, ...shared } = e;
  const extras = children?.map((c) => ({
    ...(c.stage ? { stage: c.stage } : {}),
    ...(c.minor !== undefined ? { minor: c.minor } : {}),
    ...(c.educationCosts ? { educationCosts: c.educationCosts } : {}),
    ...(c.scholarships ? { scholarships: c.scholarships } : {}),
  }));
  const cantonal: StGallenCantonal = {
    ...(church ? { church } : {}),
    ...(mainUpkeep !== undefined ? { mainUpkeep } : {}),
    ...(extras?.some((x) => Object.keys(x).length) ? { children: extras } : {}),
  };
  return {
    ...shared,
    ...(children
      ? {
          children: children.map((c) => {
            const q = { ...c };
            delete q.stage;
            delete q.minor;
            delete q.educationCosts;
            delete q.scholarships;
            return q;
          }),
        }
      : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: SgEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'St. Gallen',
    civilStatus: 'single',
    church: { p1: 'reformed', area: 'St. Gallen Tablat (O)' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(92_000), socialContributions: amt(5_888), pensionFund: amt(4_600) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_200),
        mealDays: 200,
        otherProfessionalCosts: amt(300),
        pillar3a: amt(7_258),
      },
    ],
    household: {
      healthPremiums: amt(4_200),
      savingsInterest: amt(50),
      medicalCosts: amt(2_000),
      donations: amt(1_247),
    },
    movable: [{ owner: 'p1', value: amt(150_000), income: amt(400) }],
  },
  {
    taxYear: 2026,
    commune: 'Rapperswil-Jona',
    civilStatus: 'married',
    church: { p1: 'catholic', p2: 'reformed' },
    people: [
      {
        id: 'p1',
        employments: [
          {
            gross: amt(130_000),
            socialContributions: amt(8_320),
            pensionFund: amt(9_100),
            canteen: true,
          },
        ],
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 15, days: 220 },
        mealDays: 200,
        pillar3a: amt(7_258),
        pillar3aCatchUp: amt(3_000),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(2_700) },
          { gross: amt(6_000), side: true },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_100),
        pillar3a: amt(7_258),
        trainingCosts: amt(2_574),
      },
    ],
    children: [
      { custody: 'full', stage: 'preschool', under14: true, childcare: amt(18_000) },
      { custody: 'full', stage: 'school', minor: true, under14: true, childcare: amt(6_000) },
      {
        custody: 'full',
        stage: 'school',
        minor: false,
        livesWithYou: false,
        educationCosts: amt(9_000),
        scholarships: amt(1_000),
      },
    ],
    household: {
      healthPremiums: amt(11_000),
      debtInterest: amt(2_000),
      debts: amt(30_000),
      politicalParty: amt(500),
      alimonyPaid: amt(4_000),
    },
    movable: [
      { owner: 'household', value: amt(250_000), income: amt(1_000) },
      { owner: 'child0', value: amt(3_000), income: amt(5) },
    ],
  },
  {
    taxYear: 2025,
    commune: 'Wil',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(75_000), socialContributions: amt(4_800), pensionFund: amt(3_750) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(5_070),
        alimonyReceived: amt(6_000),
        replacementIncome: amt(2_000),
      },
    ],
    children: [{ custody: 'full', stage: 'school', minor: true, childcare: amt(4_000) }],
    household: {
      childSupportReceived: amt(9_600),
      healthPremiums: amt(5_600),
      healthSubsidy: amt(1_200),
    },
    movable: [{ owner: 'p1', value: amt(20_000), income: amt(20) }],
  },
  {
    taxYear: 2026,
    commune: 'Gossau',
    civilStatus: 'widowed',
    church: { p1: 'catholic', area: 'Gossau' },
    people: [
      {
        id: 'p1',
        pensionAvs: amt(28_000),
        pensionOccupational: amt(36_000),
        pensionOther: amt(1_000),
      },
    ],
    household: {
      healthPremiums: amt(6_200),
      lifeInsurancePremiums: amt(1_000),
      bankFees: amt(1_800),
      medicalCosts: amt(4_500),
      donations: amt(3_026),
      cash: amt(5_000),
      lifeInsuranceValue: amt(80_000),
      vehicles: amt(12_000),
      otherAssets: amt(3_000),
      otherIncome: amt(500),
    },
    movable: [{ owner: 'p1', value: amt(1_200_000), income: amt(18_000) }],
  },
  {
    taxYear: 2025,
    commune: 'Rorschach',
    civilStatus: 'divorced',
    childSupport: 'none',
    mainUpkeep: true,
    church: { p1: 'catholic' },
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(58_000), socialContributions: amt(3_712), pensionFund: amt(2_320) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(800),
        mealDays: 100,
        pillar3a: amt(3_068),
        unemploymentBenefits: amt(1_500),
      },
    ],
    children: [{ custody: 'shared', stage: 'preschool', under14: true, childcare: amt(9_000) }],
    household: { healthPremiums: amt(3_000), childSupportPaid: amt(0) },
    movable: [{ owner: 'p1', value: amt(30_000) }],
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): SgEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const names = communesFor(2025).value.map((c) => c.name);
  const confessions = ['catholic', 'reformed', 'christ_catholic', 'none', 'other'] as const;
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    const year = r() < 0.5 ? 2026 : 2025;
    return {
      ...base,
      taxYear: year,
      commune: pick(names),
      ...(base.church || r() < 0.3
        ? {
            church: {
              p1: pick(confessions),
              ...(base.civilStatus === 'married' ? { p2: pick(confessions) } : {}),
            },
          }
        : {}),
      ...(base.childSupport === 'none' && r() < 0.3
        ? { childSupport: pick(['pays', 'receives', 'none'] as const), mainUpkeep: r() < 0.5 }
        : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.2
          ? {
              commuteMode: {
                by: pick(['car', 'motorbike'] as const),
                transitUsable: false,
                kmOneWay: 30,
                days: 230,
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

describe('St. Gallen through the canton interface', () => {
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

  it('computes the cantonal and communal tax of each household; no federal column', () => {
    for (const e of HOUSEHOLDS) {
      const r = rules.computeReturn(household(e));
      expect(r.unsupported).toEqual([]);
      expect(r.total).toBeGreaterThan(0);
      expect(r.ifd).toBeNull();
    }
  });

  it('leaves aside the facts that do not change St. Gallen’s tax', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const p1 = h.people[0]!;
    const other: HouseholdInput<StGallenCantonal> = {
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
      movable: h.movable!.map((m) => ({ ...m, withholdingSwiss: amt(70) })),
    };
    expect(rules.computeReturn(other)).toEqual(computeReturn(e));
  });

  it('refuses a fact St. Gallen does not read, a commune by number and an unknown commune', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<StGallenCantonal>[] = [
      { ...h, household: { childcare: amt(5_000) } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 3203 },
      { ...h, commune: 'Zürich' },
      { ...h, cantonal: { children: [{ stage: 'school' }] } },
      { ...h, cantonal: { church: { p1: 'reformed', area: 'Wittenbach' } } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(SgInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes with their Gesamtsteuerfuss, cited, without BFS numbers', () => {
    for (const year of [2025, 2026] as const) {
      const communes = rules.communes(year);
      const table = communesFor(year);
      expect(communes).toHaveLength(75);
      expect(new Set(communes.map((c) => c.slug)).size).toBe(75);
      expect(communes.every((c) => c.bfs === null)).toBe(true);
      expect(communes.find((c) => c.slug === 'st-gallen')).toEqual({
        bfs: null,
        slug: 'st-gallen',
        name: 'St. Gallen',
        rates: { value: [13_800], source: table.source },
      });
    }
    expect(rules.communes(2026).find((c) => c.slug === 'wittenbach')?.rates.value).toEqual([
      11_900,
    ]);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys and what a salary certificate gives', () => {
    expect(rules.canton).toBe('SG');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2025))).toEqual(
      expect.arrayContaining(['salary.gross', 'securities.isin', 'accounts.number']),
    );
    expect(rules.documents(2026)).toEqual([
      { kind: 'salary_certificate', keys: SALARY_CERTIFICATE_FIELDS_2026 },
    ]);
    expect(rules.sourcesIndex).toBe('docs/sources/sg');
  });
});
