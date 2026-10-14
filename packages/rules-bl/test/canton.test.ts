// Basel-Landschaft through the canton interface (packages/rules-ch, canton.ts): computeReturn gives
// exactly what the engine gives for the same household, a fact that would change Basel-Landschaft's
// tax and that its engine does not read is refused, and the communes are the official table's.
// Synthetic only.
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
  type HouseholdInput,
} from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import {
  BlInputError,
  communesFor,
  computeReturn,
  rules,
  type BaselLandCantonal,
  type BlEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

/** The same household as the canton interface takes it: Basel-Landschaft's extras under `cantonal`. */
function household(e: BlEngineInput): HouseholdInput<BaselLandCantonal> {
  const { church, mainUpkeep, people, children, ...shared } = e;
  const pensionKind = Object.fromEntries(
    people.filter((p) => p.pensionKind).map((p) => [p.id, p.pensionKind]),
  );
  const ownIncome = children?.map((c) => c.ownIncome ?? false);
  const cantonal: BaselLandCantonal = {
    ...(church ? { church } : {}),
    ...(mainUpkeep !== undefined ? { mainUpkeep } : {}),
    ...(Object.keys(pensionKind).length ? { pensionKind } : {}),
    ...(ownIncome?.some(Boolean) ? { childrenOwnIncome: ownIncome } : {}),
  };
  return {
    ...shared,
    people: people.map((p) => {
      const q = { ...p };
      delete q.pensionKind;
      return q;
    }),
    ...(children
      ? {
          children: children.map((c) => {
            const q = { ...c };
            delete q.ownIncome;
            return q;
          }),
        }
      : {}),
    ...(Object.keys(cantonal).length ? { cantonal } : {}),
  };
}

const HOUSEHOLDS: BlEngineInput[] = [
  {
    taxYear: 2025,
    commune: 'Liestal',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(100_000), socialContributions: amt(6_400), pensionFund: amt(7_000) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        mealDays: 200,
        otherProfessionalCosts: amt(300),
        pillar3a: amt(7_258),
      },
    ],
    household: { medicalCosts: amt(1_200), donations: amt(1_610) },
    movable: [{ owner: 'p1', value: amt(50_000), income: amt(300) }],
  },
  {
    taxYear: 2026,
    commune: 'Allschwil',
    civilStatus: 'married',
    church: { p1: 'catholic', p2: 'catholic' },
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
        commuteMode: { by: 'car', transitUsable: false, kmOneWay: 12, days: 220 },
        mealDays: 200,
        pillar3a: amt(7_258),
      },
      {
        id: 'p2',
        employments: [
          { gross: amt(60_000), socialContributions: amt(3_840), pensionFund: amt(3_000) },
          { gross: amt(5_000), side: true },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        pillar3a: amt(6_330),
        trainingCosts: amt(15_000),
      },
    ],
    children: [
      { custody: 'full', under14: true, childcare: amt(12_000) },
      { custody: 'full', under14: false, ownIncome: true },
    ],
    household: { debtInterest: amt(1_500), debts: amt(40_000), politicalParty: amt(500) },
    movable: [
      { owner: 'household', value: amt(300_000), income: amt(2_000) },
      { owner: 'child0', value: amt(4_000), income: amt(10) },
    ],
  },
  {
    taxYear: 2025,
    commune: 'Reinach',
    civilStatus: 'divorced',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(80_000), socialContributions: amt(5_120), pensionFund: amt(4_000) },
        ],
        commuteMode: { by: 'bike' },
        pillar3a: amt(4_000),
        trainingCosts: amt(1_830),
        alimonyReceived: amt(6_000),
      },
    ],
    children: [{ custody: 'full', under14: true, childcare: amt(6_000) }],
    household: { childSupportReceived: amt(9_600) },
  },
  {
    taxYear: 2026,
    commune: 'Binningen',
    civilStatus: 'widowed',
    church: { p1: 'none' },
    people: [
      {
        id: 'p1',
        pensionAvs: amt(30_000),
        pensionKind: 'ahv',
        pensionOccupational: amt(24_000),
        pensionOther: amt(2_000),
      },
    ],
    household: {
      bankFees: amt(1_000),
      medicalCosts: amt(3_000),
      cash: amt(5_000),
      lifeInsuranceValue: amt(40_000),
      vehicles: amt(8_000),
      otherAssets: amt(2_000),
      otherIncome: amt(500),
    },
    movable: [{ owner: 'p1', value: amt(900_000), income: amt(12_000) }],
  },
  {
    taxYear: 2025,
    commune: 'Sissach',
    civilStatus: 'divorced',
    childSupport: 'pays',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(95_000), socialContributions: amt(6_080), pensionFund: amt(5_700) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_032),
        mealDays: 162,
        pillar3a: amt(7_258),
        replacementIncome: amt(2_000),
      },
    ],
    children: [{ custody: 'shared', under14: true, childcare: amt(3_000) }],
    household: { childSupportPaid: amt(12_000), alimonyPaid: amt(6_000) },
  },
];

/** Seeded variations around the households above, so many branches go through both paths. */
function variations(n: number): BlEngineInput[] {
  let seed = 20_261_014;
  const r = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const names = communesFor(2025).value.map((c) => c.name);
  return Array.from({ length: n }, (_, i) => {
    const base = HOUSEHOLDS[i % HOUSEHOLDS.length]!;
    const year = r() < 0.5 ? 2026 : 2025;
    return {
      ...base,
      taxYear: year,
      commune: pick(names),
      ...(base.church || r() < 0.3
        ? { church: { p1: pick(['catholic', 'reformed', 'none'] as const) } }
        : {}),
      ...(base.childSupport === 'pays' && r() < 0.3
        ? { childSupport: 'none' as const, mainUpkeep: r() < 0.5 }
        : {}),
      people: base.people.map((p) => ({
        ...p,
        ...(r() < 0.5 ? { pillar3a: amt(Math.floor(r() * 40_000)) } : {}),
        ...(r() < 0.3 ? { trainingCosts: amt(Math.floor(r() * 20_000)) } : {}),
        ...(r() < 0.2
          ? { commuteMode: { by: 'car', transitUsable: false, kmOneWay: 30, days: 230 } }
          : {}),
        ...(p.pensionAvs && r() < 0.2 ? { pensionKind: undefined } : {}),
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

describe('Basel-Landschaft through the canton interface', () => {
  it('gives exactly what the engine gives', () => {
    const all = [...HOUSEHOLDS, ...variations(250)];
    for (const e of all) {
      expect(rules.computeReturn(household(e))).toEqual(computeReturn(e));
    }
    // The variations reach both computed and not computed results.
    const computed = all.filter((e) => computeReturn(e).icc).length;
    expect(computed).toBeGreaterThan(100);
    expect(computed).toBeLessThan(all.length);
  });

  it('computes the state and communal tax of each household and the federal tax of its column', () => {
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
    const other: HouseholdInput<BaselLandCantonal> = {
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
    expect(rules.computeReturn(other)).toEqual(computeReturn(e));
  });

  it('counts the insurance premiums for the federal tax only (the canton deducts its maximum)', () => {
    const e = HOUSEHOLDS[0]!;
    const h = household(e);
    const with_ = rules.computeReturn({
      ...h,
      household: {
        ...h.household,
        healthPremiums: amt(5_500),
        accidentPremiums: amt(300),
        healthSubsidy: amt(1_000),
        lifeInsurancePremiums: amt(800),
        savingsInterest: amt(100),
      },
    });
    const without_ = computeReturn(e);
    expect(with_.icc).toEqual(without_.icc);
    expect(with_.ifd!.items.find((i) => i.code === '625')?.amount).toBeLessThan(0);
    expect(without_.ifd!.items.find((i) => i.code === '625')).toBeUndefined();
    expect(with_.ifd!.tax.amount).toBeLessThan(without_.ifd!.tax.amount);
  });

  it('takes childcare given for the household where one child’s limit settles it', () => {
    const e = HOUSEHOLDS[2]!; // one child under 14
    const h = household(e);
    const one = { ...h, children: [{ custody: 'full' as const, under14: true }] };
    const r = rules.computeReturn({ ...one, household: { ...h.household, childcare: amt(6_000) } });
    expect(r).toEqual(computeReturn(e));
    // Two children under 14 and more than one child's limit: the split decides, not computed.
    const two = {
      ...h,
      children: [
        { custody: 'full' as const, under14: true },
        { custody: 'full' as const, under14: true },
      ],
    };
    const split = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(15_000) },
    });
    expect(split.icc).toBeNull();
    expect(split.unsupported.map((x) => x.en).join(' ')).toMatch(/limit is per child/);
    // Split per child (the questionnaire's bl.child_care), it is computed.
    const each = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(15_000) },
      cantonal: { childcare: [amt(9_000), amt(6_000)] },
    });
    expect(each.icc?.items.find((i) => i.code === '640')?.amount).toBe(-chf(15_000));
    // Within one child's limit, any split gives the same: computed.
    const within = rules.computeReturn({
      ...two,
      household: { ...h.household, childcare: amt(8_000) },
    });
    expect(within.icc?.items.find((i) => i.code === '640')?.amount).toBe(-chf(8_000));
  });

  it('refuses a fact Basel-Landschaft does not read, a commune by number and an unknown commune', () => {
    const h = household(HOUSEHOLDS[0]!);
    const refused: HouseholdInput<BaselLandCantonal>[] = [
      { ...h, cantonal: { childcare: [amt(1_000)] } },
      { ...h, movable: [{ owner: 'someone', value: amt(1_000) }] as never },
      { ...h, commune: 2829 },
      { ...h, commune: 'Basel' },
      { ...h, cantonal: { childrenOwnIncome: [true] } },
    ];
    for (const x of refused) expect(() => rules.computeReturn(x)).toThrow(BlInputError);
    expect(() => rules.computeReturn({ ...h, taxYear: 2024 })).toThrow(/not supported/);
  });

  it('lists the communes with their Steuerfuss, cited, without BFS numbers', () => {
    for (const year of [2025, 2026] as const) {
      const communes = rules.communes(year);
      const table = communesFor(year);
      expect(communes).toHaveLength(86);
      expect(new Set(communes.map((c) => c.slug)).size).toBe(86);
      expect(communes.every((c) => c.bfs === null)).toBe(true);
      expect(communes.find((c) => c.slug === 'liestal')).toEqual({
        bfs: null,
        slug: 'liestal',
        name: 'Liestal',
        rates: { value: [6_500], source: table.source },
      });
    }
    expect(rules.communes(2026).find((c) => c.slug === 'reinach')?.rates.value).toEqual([5_850]);
    expect(() => rules.communes(2027)).toThrow(/not supported/);
  });

  it('gives the shared keys, its own and what each kind of document gives', () => {
    expect(rules.canton).toBe('BL');
    expect(rules.taxYears).toEqual([2025, 2026]);
    expect(Object.keys(rules.keys(2025))).toEqual(
      expect.arrayContaining([
        'salary.gross',
        'securities.isin',
        'accounts.number',
        'profile.commune',
        'bl.pension_kind',
        'bl.child_income',
        'bl.main_upkeep',
        'bl.church',
        'bl.child_care',
      ]),
    );
    expect(rules.keys(2026)['profile.commune']?.values).toHaveLength(86);
    expect(rules.documents(2026)).toEqual(
      Object.entries({
        salary_certificate: SALARY_CERTIFICATE_FIELDS_2026,
        ...ATTESTATION_FIELDS_2026,
        ...DOCUMENT_FIELDS_WEALTH_2026,
      }).map(([kind, keys]) => ({ kind, keys })),
    );
    expect(rules.sourcesIndex).toBe('docs/sources/bl');
  });
});
