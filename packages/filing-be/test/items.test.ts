// The values to type on the Bern return, from Bern's engine, laid out by the shared copy panel:
// every value finds its line, the forms show what you declare (TaxMe's "Ihre Angaben"), TaxMe's
// summaries the engine's "Steuerbar" amounts and totals. Synthetic households only; the first is
// the fictional taxpayer of the official specimen (be-2025-steuererklaerung-formulare-de).
import { buildCopyPanel, type CopyRow, type FormMap } from '@taxpresso/filing-ge';
import { rules, type BernCantonal, type BeTaxResult } from '@taxpresso/rules-be';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { describe, expect, it } from 'vitest';
import { BE_COPY_LABELS, bernFormItems, bernFormMap } from '../src/index.js';

const amt = (francs: number) => ({ value: francs * 100 });

/**
 * The specimen's taxpayer, as rules-be's official example reads it from his facts (test/official-
 * example.test.ts, "the same return from the household's facts"): single, Münchenbuchsee,
 * reformed, no household of his own, a main and a side job, bike and public transport given as one
 * cost of 2,140, two accounts, a car and gold.
 */
const SPECIMEN: HouseholdInput<BernCantonal> = {
  taxYear: 2025,
  commune: 546,
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      employments: [{ gross: amt(50_000) }, { gross: amt(2_700), side: true }],
      hasPensionFund: true,
      commuteCost: amt(2_140),
      mealDays: 220,
      trainingCosts: amt(800),
    },
  ],
  household: {
    healthPremiums: amt(2_640),
    savingsInterest: amt(44),
    donations: amt(100),
    medicalCosts: amt(2_400),
    bankFees: amt(10),
    cash: amt(2_000),
    vehicles: amt(600),
  },
  movable: [
    { owner: 'p1', value: amt(7_753), income: amt(20) },
    { owner: 'p1', value: amt(2_400), income: amt(24) },
  ],
  cantonal: { ownHousehold: false, church: { p1: 'reformed' } },
};

/** The Graf family of Thun, 2026: two salaries (one with a side job), two children, wealth. */
const GRAF: HouseholdInput<BernCantonal> = {
  taxYear: 2026,
  commune: 942,
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
      pensionBuyIn: amt(5_000),
      trainingCosts: amt(15_000),
    },
    {
      id: 'p2',
      employments: [
        { gross: amt(50_000), socialContributions: amt(3_200), pensionFund: amt(2_500) },
        { gross: amt(6_000), side: true },
      ],
      commuteCost: amt(1_100),
      pillar3a: amt(3_000),
      pensionAvs: amt(1_000),
    },
  ],
  children: [
    { custody: 'full', under14: true, childcare: amt(18_000) },
    { custody: 'full', under14: false },
  ],
  household: {
    healthPremiums: amt(13_000),
    healthSubsidy: amt(1_000),
    medicalCosts: amt(9_000),
    donations: amt(1_500),
    debtInterest: amt(3_000),
    debts: amt(90_000),
    childSupportReceived: amt(2_400),
    lifeInsuranceValue: amt(20_000),
  },
  movable: [{ owner: 'household', value: amt(150_000), income: amt(1_500) }],
  cantonal: {
    church: { p1: 'none', p2: 'none' },
    politicalParty: { p1: amt(400) },
    childEducation: [undefined, amt(3_000)],
  },
};

/** Anna, single in Bern, 2026: her own household, pillar 3a, no wealth. */
const ANNA: HouseholdInput<BernCantonal> = {
  taxYear: 2026,
  commune: 351,
  civilStatus: 'single',
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
  cantonal: { ownHousehold: true },
};

function panel(input: HouseholdInput<BernCantonal>) {
  const result = rules.computeReturn(input);
  const form: FormMap<string> = bernFormMap(input.taxYear);
  const items = bernFormItems(result);
  const built = buildCopyPanel({ form, items, lang: 'en', labels: BE_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  /** The rows of a line on a page, for one person's part (A, B) or the household's (-). */
  const row = (page: string, key: string, part?: 'A' | 'B' | '-') =>
    rows.filter(
      (r) =>
        r.id.startsWith(`${page}|${key}|`) && (part === undefined || (r.part?.id ?? '-') === part),
    );
  /** The value typed on a line, or undefined when it has none. */
  const value = (page: string, key: string, part?: 'A' | 'B' | '-') => {
    const found = row(page, key, part);
    expect(found.length, `${page} ${key} ${part ?? ''}`).toBeLessThanOrEqual(1);
    return found[0]?.copy;
  };
  return { result, items, built, rows, row, value };
}

const francs = (centimes: number) => String(centimes / 100);
const pages = (rows: readonly CopyRow[]) => [...new Set(rows.map((r) => r.id.split('|')[0]))];

describe('the specimen return (be-2025-steuererklaerung-formulare-de)', () => {
  const p = panel(SPECIMEN);

  it('places every value, in the order of the return', () => {
    expect(p.built.unplaced).toEqual([]);
    // No pillar 3a, no own household: nothing on form 1. No federal tax: no ZB (below).
    expect(p.built.sections.map((s) => s.page)).toEqual(['F2', 'F3', 'F4', 'F5', 'F6', 'ZK']);
    expect(p.built.provisional).toBe(false);
  });

  it('shows on ZK the "Steuerbar" column of TaxMe’s cantonal summary (p. 9)', () => {
    const zk = (key: string, part?: 'A' | 'B' | '-') => p.value('ZK', key, part);
    expect(zk('2.21-haupt', 'A')).toBe('50000');
    expect(zk('2.21-neben', 'A')).toBe('2700');
    expect(zk('3.0-ertrag')).toBe('44');
    expect(zk('3.0-kosten')).toBe('-10');
    expect(zk('total-einkuenfte')).toBe('52734');
    expect(zk('4.2')).toBe('2450');
    expect(zk('6.1', 'A')).toBe('2140');
    expect(zk('6.2', 'A')).toBe('3200');
    expect(zk('6.4', 'A')).toBe('2000');
    expect(zk('6.5', 'A')).toBe('800');
    expect(zk('6.6', 'A')).toBe('800');
    expect(zk('total-aufwendungen')).toBe('11390');
    expect(zk('reineinkommen')).toBe('41344');
    expect(zk('allgemein')).toBe('5300');
    expect(zk('5.3')).toBe('100');
    expect(zk('5.4')).toBe('333');
    expect(zk('total-sozialabzuege')).toBe('5733');
    expect(zk('steuerbares-einkommen')).toBe('35611');
    expect(zk('3.0-vermoegen')).toBe('10153');
    expect(zk('4.1')).toBe('2600');
    expect(zk('total-vermoegen')).toBe('12753');
    expect(zk('steuerbares-vermoegen')).toBe('12753');
    // Every line of the summary is TaxMe's to work out: you check it.
    expect(p.row('ZK', '4.2')[0]!.columns.map((c) => c.label)).toEqual(['Steuerbar']);
    expect(p.rows.filter((r) => r.id.startsWith('ZK|')).every((r) => !r.enterable)).toBe(true);
  });

  it('shows on the forms what you declare, TaxMe’s "Ihre Angaben" (p. 2 to 6, p. 9)', () => {
    expect(p.value('F2', '2.21-haupt', 'A')).toBe('50000');
    expect(p.value('F2', '2.21-neben', 'A')).toBe('2700');
    expect(p.value('F3', '3.0-ertrag')).toBe('44');
    expect(p.value('F3', '3.0-vermoegen')).toBe('10153');
    expect(p.value('F3', '3.0-kosten')).toBe('10');
    expect(p.value('F4', '4.1')).toBe('2600');
    // 2,640 premiums and 44 savings interest, before TaxMe cuts them to 2,450.
    expect(p.value('F4', '4.2')).toBe('2684');
    expect(p.value('F5', '5.3')).toBe('100');
    // Before the threshold of 5 % of the Reineinkommen: 2,400, of which 333 count.
    expect(p.value('F5', '5.4')).toBe('2400');
    expect(p.value('F6', '6.1', 'A')).toBe('2140');
    expect(p.value('F6', '6.2', 'A')).toBe('3200');
    expect(p.value('F6', '6.4', 'A')).toBe('2000');
    expect(p.value('F6', '6.6', 'A')).toBe('800');
    // The side job's flat amount: a tick on the form ("X ja", p. 6), the amount on ZK.
    const side = p.row('F6', '6.5', 'A');
    expect(side).toHaveLength(1);
    expect(side[0]).toMatchObject({ format: 'tick', tick: true, enterable: true });
    expect(side[0]!.part?.label).toBe('Mann');
  });

  it('has no federal summary: the federal tax is not computed in 2025 with a side job', () => {
    expect(p.result.ifd).toBeNull();
    expect(p.items.filter((i) => i.column === 'ifd')).toEqual([]);
    expect(pages(p.rows)).not.toContain('ZB');
  });
});

describe('the values to type on the Bern return', () => {
  it('puts each person’s amounts in their column, Mann for p1 and Frau for p2', () => {
    const { built, value, row } = panel(GRAF);
    expect(built.unplaced).toEqual([]);
    expect(built.sections.map((s) => s.page)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'ZK',
      'ZB',
    ]);
    expect(built.provisional).toBe(true);
    expect(value('F2', '2.21-haupt', 'A')).toBe('95260');
    expect(value('F2', '2.21-haupt', 'B')).toBe('44300');
    expect(value('F2', '2.21-neben', 'B')).toBe('6000');
    expect(value('F2', '2.21-neben', 'A')).toBeUndefined();
    expect(value('F2', '2.22-ahv', 'B')).toBe('1000');
    expect(row('F2', '2.21-haupt', 'B')[0]!.part).toMatchObject({ label: 'Frau' });
    // A household amount on a line with a column per person: split it between them.
    const support = row('F2', '2.24');
    expect(support).toHaveLength(1);
    expect(support[0]!.splitInto?.map((s) => s.label)).toEqual(['Mann', 'Frau']);
  });

  it('declares pillar 3a and buy-ins on form 1.1, per person', () => {
    const { value } = panel(GRAF);
    expect(value('F1', 'saeule-3a', 'A')).toBe('7258');
    expect(value('F1', 'saeule-3a', 'B')).toBe('3000');
    expect(value('F1', 'einkauf-bv', 'A')).toBe('5000');
    expect(value('ZK', 'saeule-3a', 'A')).toBe('7258');
    expect(value('ZB', 'einkauf-bv', 'A')).toBe('5000');
  });

  it('declares the amount before a cap, and shows each tax’s on its summary', () => {
    const { value, result } = panel(GRAF);
    const icc = (code: string) => result.icc!.items.find((i) => i.code === code)!;
    const ifd = (code: string) => result.ifd!.items.find((i) => i.code === code)!;
    // Childcare: 18,000 paid; the cantonal deduction is capped, the federal one is not.
    expect(value('F2', '2.1-betreuung')).toBe('18000');
    expect(value('ZK', '2.1-betreuung')).toBe(francs(-icc('2.1-betreuung').amount));
    expect(value('ZB', '2.1-betreuung')).toBe(francs(-ifd('2.1-betreuung').amount));
    expect(Number(value('ZK', '2.1-betreuung'))).toBeLessThan(18_000);
    // Insurance: premiums less the subsidy declared; each tax its own deduction.
    expect(value('F4', '4.2')).toBe('12000');
    expect(value('ZK', '4.2')).toBe(francs(-icc('4.2').amount));
    expect(value('ZB', '4.2')).toBe(francs(-ifd('4.2').amount));
    // Training: 15,000 paid, each tax's cap on its summary.
    expect(value('F6', '6.6', 'A')).toBe('15000');
    expect(value('ZK', '6.6', 'A')).toBe(francs(-icc('6.6').amount));
    expect(value('ZB', '6.6', 'A')).toBe(francs(-ifd('6.6').amount));
    // Deductions TaxMe works out on its own are on the summaries only.
    expect(value('ZK', 'zweiverdiener')).toBeDefined();
    expect(value('ZB', 'verheiratet')).toBeDefined();
    expect(value('ZK', 'verheiratet')).toBeUndefined();
    expect(value('ZK', '2.1-kinder')).toBeDefined();
  });

  it('gives each summary the engine’s totals', () => {
    const { value, result } = panel(GRAF);
    const icc = result.icc!;
    const ifd = result.ifd!;
    const abs = (n: number) => francs(Math.abs(n));
    expect(value('ZK', 'total-einkuenfte')).toBe(francs(icc.grossIncome.amount));
    expect(value('ZK', 'total-aufwendungen')).toBe(abs(icc.totalDeductions.amount));
    expect(value('ZK', 'reineinkommen')).toBe(francs(icc.netIncome.amount));
    expect(value('ZK', 'total-sozialabzuege')).toBe(abs(icc.personalDeductions.amount));
    expect(value('ZK', 'steuerbares-einkommen')).toBe(francs(icc.taxableIncome.amount));
    expect(value('ZK', 'total-vermoegen')).toBe(francs(icc.wealth.grossWealth.amount));
    expect(value('ZK', 'steuerbares-vermoegen')).toBe(francs(icc.wealth.taxableWealth.amount));
    expect(value('ZB', 'total-einkuenfte')).toBe(francs(ifd.grossIncome.amount));
    expect(value('ZB', 'total-aufwendungen')).toBe(abs(ifd.totalDeductions.amount));
    expect(value('ZB', 'reineinkommen')).toBe(francs(ifd.netIncome.amount));
    expect(value('ZB', 'total-sozialabzuege')).toBe(abs(ifd.personalDeductions.amount));
    expect(value('ZB', 'steuerbares-einkommen')).toBe(francs(ifd.taxableIncome.amount));
    // Every line of the engine on its summary, with the amount TaxMe prints.
    for (const [page, items] of [
      ['ZK', icc.items],
      ['ZB', ifd.items],
    ] as const) {
      for (const i of items) {
        const part = i.person === 'p1' ? 'A' : i.person === 'p2' ? 'B' : '-';
        expect(value(page, i.code, part), `${page} ${i.code} ${i.person}`).toBe(
          francs(i.code === '3.0-kosten' ? i.amount : Math.abs(i.amount)),
        );
      }
    }
  });

  it('declares wealth only when there is some', () => {
    const graf = panel(GRAF);
    expect(graf.value('F3', '3.0-vermoegen')).toBe('150000');
    expect(graf.value('F4', '4.2-wert')).toBe('20000');
    expect(graf.value('F4', '4.3-schulden')).toBe('90000');
    expect(graf.value('F4', '4.3')).toBe('3000');
    expect(graf.value('ZK', 'vermoegen-verheiratet')).toBeDefined();
    expect(graf.value('ZK', '4.3-schulden')).toBe('90000');

    const { household } = GRAF;
    const poor = panel({
      ...GRAF,
      movable: [],
      household: { ...household, debts: undefined, lifeInsuranceValue: undefined },
    });
    expect(poor.built.unplaced).toEqual([]);
    const wealthRows = poor.rows.filter((r) => r.columns.some((c) => c.id === 'wealth'));
    expect(wealthRows).toEqual([]);
    for (const key of ['vermoegen-verheiratet', 'vermoegen-kinder', 'total-vermoegen']) {
      expect(poor.value('ZK', key), key).toBeUndefined();
    }
  });

  it('ticks your own household on form 1.2, and gives the federal summary when computed', () => {
    const { built, value, row, result } = panel(ANNA);
    expect(built.unplaced).toEqual([]);
    expect(row('F1', 'alleinstehend')[0]).toMatchObject({ format: 'tick', tick: true });
    expect(value('ZK', 'alleinstehend')).toBe(
      francs(-result.icc!.items.find((i) => i.code === 'alleinstehend')!.amount),
    );
    expect(value('F1', 'saeule-3a', 'A')).toBe('7258');
    // A single person: the part is Mann (A); get_form_values doesn't name it for one person.
    expect(row('F1', 'saeule-3a', 'A')[0]!.part?.id).toBe('A');
    expect(value('ZB', 'steuerbares-einkommen')).toBe(francs(result.ifd!.taxableIncome.amount));
    expect(built.sections.map((s) => s.page)).not.toContain('F3');
  });

  it('gives each value the status of its line', () => {
    const result = rules.computeReturn(ANNA);
    const icc = result.icc!;
    const withOk: BeTaxResult = {
      ...result,
      icc: {
        ...icc,
        items: icc.items.map((i) => (i.code === '2.21-haupt' ? { ...i, needsOk: true } : i)),
      },
    };
    // The form and ZK (the cantonal line); ZB has the federal line, unchanged here.
    const items = bernFormItems(withOk).filter(
      (i) => i.code === '2.21-haupt' && i.column !== 'ifd',
    );
    expect(items.map((i) => [i.column, i.status])).toEqual([
      ['amount', 'extracted'],
      ['icc', 'extracted'],
    ]);
    const estimated: BeTaxResult = {
      ...result,
      icc: {
        ...icc,
        items: icc.items.map((i) =>
          i.code === '6.1' ? { ...i, estimates: ['input-estimate'] } : i,
        ),
      },
    };
    expect(
      bernFormItems(estimated)
        .filter((i) => i.code === '6.1' && i.column !== 'ifd')
        .map((i) => i.status),
    ).toEqual(['estimate', 'estimate']);
    expect(bernFormItems(result).find((i) => i.code === '6.1')!.status).toBe('computed');
  });

  it('gives nothing to type before the tax can be computed', () => {
    expect(bernFormItems({ ...rules.computeReturn(ANNA), icc: null, ifd: null })).toEqual([]);
  });
});
