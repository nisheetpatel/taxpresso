// The values to type on the Vaud return, from Vaud's engine, laid out by the shared copy panel:
// every value finds its line, a taxpayer's in their box, deductions without their sign, the
// annexes' totals, and the federal worksheet to check. Synthetic households only: those of
// packages/rules-vd/test/households.test.ts (H1 to H4), whose lines are derived by hand there.
import { buildCopyPanel, type FormMap } from '@taxpresso/filing-ge';
import { computeReturn, type VdEngineInput, type VdTaxResult } from '@taxpresso/rules-vd';
import { describe, expect, it } from 'vitest';
import { VD_COPY_LABELS, vaudFormItems, vaudFormMap } from '../src/index.js';

const amt = (francs: number) => ({ value: francs * 100 });
const francs = (centimes: number) => String(centimes / 100);

/** H1: single, Lausanne, 2025, employed, public transport, a savings account. */
const H1: VdEngineInput = {
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
};

/** H2: married, two earners, two children, Nyon, 2025: childcare, medical costs, debts. */
const H2: VdEngineInput = {
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
    savingsInterest: amt(1_500),
    medicalCosts: amt(9_000),
    donations: amt(1_500),
    debtInterest: amt(3_000),
    debts: amt(90_000),
  },
  movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
};

/** H3: single parent, one child, Yverdon-les-Bains, 2026, by car, child support received. */
const H3: VdEngineInput = {
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
  household: {
    healthPremiums: amt(6_200),
    healthSubsidy: amt(1_000),
    childSupportReceived: amt(9_600),
    savingsInterest: amt(5),
  },
  movable: [{ owner: 'p1', value: amt(12_000), income: amt(5) }],
};

/** H4: widowed retiree with wealth, Montreux, 2025: pensions, gold, life insurance, donations. */
const H4: VdEngineInput = {
  taxYear: 2025,
  commune: 'Montreux',
  civilStatus: 'widowed',
  rent: amt(24_000),
  furnitureInsurance: amt(150_000),
  people: [{ id: 'p1', pensionAvs: amt(28_000), pensionOccupational: amt(36_000) }],
  household: {
    healthPremiums: amt(7_200),
    savingsInterest: amt(2_000),
    bankFees: amt(1_800),
    medicalCosts: amt(4_000),
    donations: amt(3_000),
    cash: amt(20_000),
    lifeInsuranceValue: amt(50_000),
  },
  movable: [{ owner: 'p1', value: amt(1_800_000), income: amt(27_000) }],
};

function panel(input: VdEngineInput) {
  const result = computeReturn(input);
  expect(result.unsupported).toEqual([]);
  const form: FormMap<string> = vaudFormMap(input.taxYear);
  const items = vaudFormItems(result);
  const built = buildCopyPanel({ form, items, lang: 'en', labels: VD_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  /** The rows of a line on a page, in one column, for one part (A, B) or the household's (-). */
  const row = (page: string, key: string, column?: string, part?: 'A' | 'B' | '-') =>
    rows.filter(
      (r) =>
        r.id.startsWith(`${page}|${key}|`) &&
        (column === undefined || r.columns.some((c) => c.id === column)) &&
        (part === undefined || (r.part?.id ?? '-') === part),
    );
  /** The value typed on a line, or undefined when it has none. */
  const value = (page: string, key: string, column?: string, part?: 'A' | 'B' | '-') => {
    const found = row(page, key, column, part);
    expect(found.length, `${page} ${key} ${column ?? ''} ${part ?? ''}`).toBeLessThanOrEqual(1);
    return found[0]?.copy;
  };
  return { result, items, built, rows, row, value };
}

describe('H1, single in Lausanne, 2025', () => {
  const p = panel(H1);

  it('places every value, in the order of the return', () => {
    expect(p.built.unplaced).toEqual([]);
    // No debts, medical costs or donations: no annex 02 or 05; on page 4, the premiums (item 10).
    expect(p.built.sections.map((s) => s.page)).toEqual(['P2', 'P3', 'P4', 'A01', 'A04', 'IFD']);
    expect(p.value('P4', 'p4-primes', 'amount')).toBe('4800');
    expect(p.built.provisional).toBe(false);
  });

  it('types each line of pages 2 and 3, deductions without their sign', () => {
    const p2 = (key: string, part?: 'A' | 'B' | '-') => p.value('P2', key, 'icc', part);
    expect(p2('100', 'A')).toBe('74460');
    expect(p2('140', 'A')).toBe('2531');
    expect(p2('150', 'A')).toBe('2933');
    expect(p2('160', 'A')).toBe('2234');
    expect(p2('310', 'A')).toBe('7258');
    expect(p2('300', '-')).toBe('4800');
    expect(p.row('P2', '100')[0]!.part?.label).toBe('Contribuable 1');
    expect(p.row('P2', '100')[0]!.columns.map((c) => c.label)).toEqual(['Revenu']);
    const p3 = (key: string, column = 'icc') => p.value('P3', key, column);
    expect(p3('410')).toBe('60');
    expect(p3('410', 'wealth')).toBe('30000');
    expect(p3('480')).toBe('60');
    expect(p3('660')).toBe('159');
    // The modest taxpayer deduction is nil here: no line.
    expect(p3('695')).toBeUndefined();
    expect(p.row('P3', '410', 'wealth')[0]!.columns.map((c) => c.label)).toEqual([
      'Fortune au 31.12.',
    ]);
  });

  it('gives the totals, the parts and the rate-determining income to check', () => {
    const p3 = (key: string, column = 'icc') => p.value('P3', key, column);
    expect(p3('650')).toBe('54704');
    expect(p3('690')).toBe('54545');
    expect(p3('700')).toBe('54545');
    expect(p3('800')).toBe('54500');
    expect(p3('800', 'wealth')).toBe('30000');
    expect(p3('810')).toBe('1,00');
    expect(p3('820')).toBe('54500');
    for (const key of ['650', '690', '700', '800', '810', '820']) {
      expect(
        p.row('P3', key).every((r) => !r.enterable),
        key,
      ).toBe(true);
    }
    // The engine gives no subtotal per taxpayer, no 730 and no net wealth: no value there.
    for (const key of ['230', '398', '399', '400']) expect(p.row('P2', key), key).toEqual([]);
    expect(p.row('P3', '730')).toEqual([]);
    expect(p.row('P3', '700', 'wealth')).toEqual([]);
  });

  it('gives the annexes’ totals carried to a code', () => {
    expect(p.value('A01', '410', 'amount')).toBe('60');
    expect(p.value('A01', '410', 'value')).toBe('30000');
    expect(p.value('A04', '140', 'amount', 'A')).toBe('2531');
    expect(p.value('A04', '150', 'amount', 'A')).toBe('2933');
    expect(p.value('A04', '160', 'amount', 'A')).toBe('2234');
    // A total of the annex is to check against the lines you list; the code is what you type.
    expect(p.row('A04', '140').every((r) => !r.enterable)).toBe(true);
    expect(p.row('P2', '140').every((r) => r.enterable)).toBe(true);
  });
});

describe('H2, a married couple with two children in Nyon, 2025', () => {
  const p = panel(H2);

  it('puts each taxpayer’s amounts in their box, Contribuable 1 for p1 and 2 for p2', () => {
    expect(p.built.unplaced).toEqual([]);
    expect(p.built.sections.map((s) => s.page)).toEqual([
      'P2',
      'P3',
      'P4',
      'A01',
      'A02',
      'A04',
      'A05',
      'IFD',
    ]);
    const p2 = (key: string, part: 'A' | 'B' | '-') => p.value('P2', key, 'icc', part);
    expect(p2('100', 'A')).toBe('95260');
    expect(p2('100', 'B')).toBe('44300');
    expect(p2('140', 'A')).toBe('5544');
    expect(p2('140', 'B')).toBe('2094');
    expect(p2('160', 'B')).toBe('2000');
    expect(p2('310', 'B')).toBe('3000');
    expect(p.row('P2', '100', 'icc', 'B')[0]!.part?.label).toBe('Contribuable 2');
    // 235 and 300: the line's one box, no part.
    expect(p2('235', '-')).toBe('1700');
    expect(p2('300', '-')).toBe('12500');
    expect(p.row('P2', '235')[0]!.splitInto).toBeUndefined();
  });

  it('types page 3 and its wealth column, debts without their sign', () => {
    const p3 = (key: string, column = 'icc') => p.value('P3', key, column);
    expect(p3('410')).toBe('1500');
    expect(p3('410', 'wealth')).toBe('150000');
    expect(p3('480')).toBe('1500');
    expect(p3('610')).toBe('3000');
    expect(p3('610', 'wealth')).toBe('90000');
    expect(p3('670')).toBe('12000');
    expect(p3('650')).toBe('86139');
    expect(p3('660')).toBe('3872');
    expect(p3('695')).toBe('3400');
    expect(p3('700')).toBe('78867');
    expect(p3('710')).toBe('5057');
    expect(p3('720')).toBe('1500');
    expect(p3('725')).toBe('3300');
    expect(p3('800')).toBe('69000');
    expect(p3('800', 'wealth')).toBe('60000');
    expect(p3('810')).toBe('2,80');
    expect(p3('820')).toBe('24600');
  });

  it('gives the annexes’ totals, and not where the annex carries what you paid', () => {
    expect(p.value('A02', '610', 'value')).toBe('90000');
    // The interest of annex 02 is what you paid; the return's 610 the deduction after its cap.
    expect(p.row('A02', '610', 'amount')).toEqual([]);
    expect(p.value('A04', '140', 'amount', 'B')).toBe('2094');
    expect(p.value('A05', '710', 'amount')).toBe('5057');
    expect(p.value('A05', '720', 'amount')).toBe('1500');
  });

  it('gives the federal worksheet, each line for the household, to check', () => {
    const ifd = p.result.ifd!;
    expect(ifd).not.toBeNull();
    // One column: the persons' amounts of a line together, each as written next to its sign.
    const codes = [...new Set(ifd.items.map((i) => i.code))];
    for (const code of codes) {
      const sum = ifd.items
        .filter((i) => i.code === code)
        .reduce((s, i) => s + Math.abs(i.amount), 0);
      expect(p.value('IFD', code, 'ifd'), code).toBe(francs(sum));
    }
    expect(p.value('IFD', '100', 'ifd')).toBe('139560');
    expect(p.value('IFD', '140', 'ifd')).toBe('3300');
    expect(p.value('IFD', 'franchise-medicale', 'ifd')).toBe(
      francs(ifd.items.find((i) => i.code === 'franchise-medicale')!.amount),
    );
    expect(p.value('IFD', 'revenu-intermediaire-1', 'ifd')).toBe(
      francs(ifd.intermediateIncome1.amount),
    );
    expect(p.value('IFD', '730', 'ifd')).toBe(francs(ifd.intermediateIncome2.amount));
    expect(p.value('IFD', 'revenu-imposable', 'ifd')).toBe(francs(ifd.taxableIncome.amount));
    // The federal page is to check only: VaudTax works it out.
    const federal = p.rows.filter((r) => r.id.startsWith('IFD|'));
    expect(federal.every((r) => !r.enterable)).toBe(true);
    expect(
      federal.every((r) => r.columns.map((c) => c.label).join() === 'Impôt fédéral direct'),
    ).toBe(true);
    // The cantonal 730 has no value: the engine gives none.
    expect(p.row('P3', '730')).toEqual([]);
  });

  it('writes every amount as a positive figure but the totals', () => {
    const totals = new Set(['650', '690', '700', '800', '820', 'revenu-intermediaire-1', '730']);
    for (const i of p.items) {
      if (i.amount !== undefined && !totals.has(i.code) && i.code !== 'revenu-imposable') {
        expect(i.amount, i.code).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the values to type on the Vaud return', () => {
  it('splits a household amount on a line with a box per taxpayer (H3, 2026)', () => {
    const p = panel(H3);
    expect(p.built.unplaced).toEqual([]);
    expect(p.built.provisional).toBe(true);
    expect(p.built.sections.map((s) => s.page)).toEqual(['P2', 'P3', 'P4', 'A01', 'A04', 'IFD']);
    // Child support received: the household's, on 280 of page 2 and table 1A of page 4.
    for (const [page, column] of [
      ['P2', 'icc'],
      ['P4', 'amount'],
    ] as const) {
      const support = p.row(page, '280', column);
      expect(support, page).toHaveLength(1);
      expect(support[0]!.copy, page).toBe('9600');
      expect(
        support[0]!.splitInto?.map((s) => s.label),
        page,
      ).toEqual(['Contribuable 1', 'Contribuable 2']);
    }
    expect(p.value('P3', '810', 'icc')).toBe('1,80');
    expect(p.value('P3', '695', 'icc')).toBe('15700');
  });

  it('declares pensions, other assets and life insurance (H4)', () => {
    const p = panel(H4);
    expect(p.built.unplaced).toEqual([]);
    expect(p.value('P2', '240', 'icc', 'A')).toBe('28000');
    expect(p.value('P2', '250', 'icc', 'A')).toBe('36000');
    expect(p.value('P3', '420', 'wealth')).toBe('20000');
    expect(p.value('P3', '435', 'wealth')).toBe('50000');
    expect(p.value('A02', '435', 'value')).toBe('50000');
    expect(p.value('P3', '490', 'icc')).toBe('1800');
    expect(p.value('P3', '720', 'icc')).toBe('3000');
    expect(p.value('A05', '720', 'amount')).toBe('3000');
    // Medical costs under the threshold: nothing to deduct, no line.
    expect(p.row('P3', '710')).toEqual([]);
    expect(p.row('A05', '710')).toEqual([]);
    expect(p.value('P3', '800', 'wealth')).toBe('1870000');
  });

  it('carries alimony paid and party payments to page 4 and annex 05', () => {
    const p = panel({
      ...H1,
      household: { ...H1.household, alimonyPaid: amt(6_000), politicalParty: amt(300) },
    });
    expect(p.built.unplaced).toEqual([]);
    expect(p.value('P3', '630', 'icc')).toBe('6000');
    expect(p.value('P4', '630', 'amount')).toBe('6000');
    expect(p.value('P3', '620', 'icc')).toBe('300');
    expect(p.value('A05', '620', 'amount')).toBe('300');
    expect(p.built.sections.map((s) => s.page)).toContain('P4');
  });

  it('declares wealth only when there is some', () => {
    const poor = panel({ ...H1, movable: [], household: { healthPremiums: amt(4_800) } });
    expect(poor.built.unplaced).toEqual([]);
    const wealthRows = poor.rows.filter((r) =>
      r.columns.some((c) => c.id === 'wealth' || c.id === 'value'),
    );
    expect(wealthRows).toEqual([]);
    expect(poor.built.sections.map((s) => s.page)).not.toContain('A01');
    expect(poor.value('P3', '800', 'icc')).toBeDefined();
  });

  it('gives each value the status of its line', () => {
    const result = computeReturn(H1);
    const icc = result.icc!;
    const withOk: VdTaxResult = {
      ...result,
      icc: {
        ...icc,
        items: icc.items.map((i) => (i.code === '100' ? { ...i, needsOk: true } : i)),
      },
    };
    // The return's line; the federal worksheet has its own copy of the line, unchanged here.
    const items = vaudFormItems(withOk).filter((i) => i.code === '100' && i.column !== 'ifd');
    expect(items.map((i) => [i.column, i.status])).toEqual([['icc', 'extracted']]);
    const estimated: VdTaxResult = {
      ...result,
      icc: {
        ...icc,
        items: icc.items.map((i) =>
          i.code === '140' ? { ...i, estimates: ['input-estimate'] } : i,
        ),
      },
    };
    expect(
      vaudFormItems(estimated)
        .filter((i) => i.code === '140' && i.column !== 'ifd')
        .map((i) => [i.column, i.status]),
    ).toEqual([
      ['icc', 'estimate'],
      ['amount', 'estimate'],
    ]);
    expect(vaudFormItems(result).find((i) => i.code === '140')!.status).toBe('computed');
    expect(vaudFormItems(result).find((i) => i.code === '810')).toMatchObject({
      status: 'computed',
      text: '1,00',
    });
  });

  it('gives nothing to type before the tax can be computed', () => {
    expect(vaudFormItems({ ...computeReturn(H1), icc: null, ifd: null })).toEqual([]);
  });

  it('fills the boxes next to 660, 670 and 440, and page 4’s premiums and subsidies', () => {
    const h: VdEngineInput = {
      ...H2,
      furnitureInsurance: amt(500_000),
      household: { ...H2.household, healthSubsidy: amt(1_200) },
    };
    const q = panel(h);
    expect(q.built.unplaced).toEqual([]);
    // As declared: the yearly net rent, the childcare paid, 30 % of the insured value (vd-2025-guide
    // p. 39, p. 44), the premiums before the subsidies and the subsidies (p. 29).
    expect(q.value('P3', '660-loyer', 'amount')).toBe('30000');
    expect(q.value('P3', '670-effectif', 'amount')).toBe('12000');
    expect(q.value('P3', '440-assurance', 'amount')).toBe('150000');
    expect(q.value('P4', 'p4-primes', 'amount')).toBe('13000');
    expect(q.value('P4', 'p4-subsides', 'amount')).toBe('1200');
  });

  it('leaves the federal worksheet out when the federal tax is not computed', () => {
    const result = computeReturn(H1);
    const items = vaudFormItems({ ...result, ifd: null });
    expect(items.filter((i) => i.column === 'ifd')).toEqual([]);
    expect(items.length).toBeGreaterThan(0);
  });
});
