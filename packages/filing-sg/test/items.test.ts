// The values to type on St. Gallen's return, from St. Gallen's engine, laid out by the shared copy
// panel: every value finds its line, Form 4's total equals its lines and is carried to 10.1 and
// 10.2, the totals are the engine's, 21.1 is laid out as the form prints it, and the canton's filing
// side answers the generic views. Synthetic households only.
import { buildCopyPanel, roundToFranc, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type StGallenCantonal } from '@taxpresso/rules-sg';
import { describe, expect, it } from 'vitest';
import {
  filing,
  FORM_SG_2026,
  SG_COPY_LABELS,
  stGallenFormItems,
  stGallenLineOf,
} from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/**
 * The Keller family of Rapperswil-Jona: two salaries, the train and a bike to work, two children
 * (the younger in a crèche, the elder at school), illness costs, donations, savings and a loan.
 */
const KELLER: HouseholdInput<StGallenCantonal> = {
  taxYear: 2026,
  commune: 'Rapperswil-Jona',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(98_000), socialContributions: chf(6_272), pensionFund: chf(4_900) },
      ],
      commuteMode: { by: 'public_transport' },
      commuteCost: chf(1_480),
      mealDays: 180,
      pillar3a: chf(7_258),
    },
    {
      id: 'p2',
      employments: [
        { gross: chf(54_000), socialContributions: chf(3_456), pensionFund: chf(2_100) },
      ],
      commuteMode: { by: 'bike' },
      pillar3a: chf(3_000),
      trainingCosts: chf(1_200),
    },
  ],
  children: [
    { custody: 'full', under14: true, childcare: chf(14_000) },
    { custody: 'full', under14: true },
  ],
  household: {
    healthPremiums: chf(10_800),
    medicalCosts: chf(6_500),
    donations: chf(1_500),
    debtInterest: chf(1_200),
    debts: chf(40_000),
  },
  movable: [{ owner: 'household', value: chf(120_000), income: chf(600) }],
  cantonal: {
    children: [{ stage: 'preschool' }, { stage: 'school', minor: true }],
    church: { p1: 'none', p2: 'none' },
  },
};

function panel(input: HouseholdInput<StGallenCantonal>) {
  const result = rules.computeReturn(input);
  const items = stGallenFormItems(result);
  const built = buildCopyPanel({ form: FORM_SG_2026, items, lang: 'en', labels: SG_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string) =>
    rows.filter((r) => r.id.startsWith(`${page}|${code}|`));
  const one = (page: string, code: string) => {
    const found = row(page, code);
    expect(found, `${page} ${code}`).toHaveLength(1);
    return found[0]!;
  };
  return { result, items, built, rows, row, one };
}

const copies = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);
/** As the form takes it: whole francs. */
const typed = (centimes: number) => String(roundToFranc(centimes));

describe('the values to type on St. Gallen’s return', () => {
  it('places every value the engine gives, Form 4 first, then pages 2 to 4', () => {
    const { result, built, rows } = panel(KELLER);
    expect(result.icc).toBeTruthy();
    expect(built.unplaced).toEqual([]);
    expect(built.sections.map((s) => s.page)).toEqual(['F4-1', 'F4-2', 'S2', 'S3', 'S4']);
    expect(built.sections.map((s) => s.title)).toEqual([
      'Berufskosten Person 1, Formular 4 2026',
      'Berufskosten Person 2, Formular 4 2026',
      'Einkünfte im In- und Ausland 2026',
      'Abzüge 2026',
      'Vermögen im In- und Ausland, Steuerwert am 31. Dezember 2026',
    ]);
    expect(built.provisional).toBe(true);
    expect(built.note).toMatch(/2025 return/);
    // Every line of the engine has its row, by its code and person.
    for (const i of [...result.icc!.items, ...result.icc!.wealth.items]) {
      const person = i.person === 'p1' ? 'A' : i.person === 'p2' ? 'B' : 'household';
      expect(
        rows.some((r) => r.key === i.code && (r.person === person || r.person === 'household')),
        `${i.code} ${i.person}`,
      ).toBe(true);
    }
  });

  it('types the income and the deductions in the return’s one column', () => {
    const { result, one } = panel(KELLER);
    const icc = result.icc!;
    // Net salaries: box 8 less boxes 9 and 10 (98,000 - 6,272 - 4,900; 54,000 - 3,456 - 2,100).
    expect(one('S2', '100').copy).toBe('86828');
    expect(one('S2', '102').copy).toBe('48444');
    expect(one('S2', '146').copy).toBe('600');
    expect(one('S2', '100').columns.map((c) => c.label)).toEqual([
      'Einkünfte für die Dauer der Steuerpflicht',
    ]);
    // Deductions as positive amounts, in the column headed "Abzüge".
    expect(one('S3', '208').copy).toBe('7258');
    expect(one('S3', '210').copy).toBe('3000');
    expect(one('S3', '208').columns.map((c) => c.label)).toEqual([
      'Abzüge für die Dauer der Steuerpflicht',
    ]);
    expect(one('S3', '500').copy).toBe('1200');
    const childcare = icc.items.find((i) => i.code === '258')!;
    expect(one('S3', '258').copy).toBe(typed(-childcare.amount));
    expect(one('S3', '252').role).toBe('computed');
    expect(one('S3', '254').role).toBe('computed');
    // No federal column anywhere: the tax office derives the federal tax from the return.
    expect(stGallenFormItems(result).some((i) => i.column === 'ifd')).toBe(false);
  });

  it('adds up each person’s Form 4 and carries the total to 10.1 and 10.2', () => {
    const { result, row, one } = panel(KELLER);
    for (const [page, total, person, carried] of [
      ['F4-1', '438', 'p1', '10.1'],
      ['F4-2', '488', 'p2', '10.2'],
    ] as const) {
      const lines = result.icc!.items.filter(
        (i) => i.person === person && Number(i.code) >= 400 && Number(i.code) < 500,
      );
      expect(lines.length, person).toBeGreaterThanOrEqual(2);
      const sum = lines.reduce((s, i) => s - i.amount, 0);
      // Each line on the person's side of Form 4, and its total.
      for (const i of lines) expect(copies(row(page, i.code)), i.code).toEqual([typed(-i.amount)]);
      expect(one(page, total).centimes).toBe(sum);
      expect(one(page, total).role).toBe('total');
      // The same total, carried to page 3.
      expect(one('S3', total).centimes).toBe(sum);
      expect(one('S3', total).role).toBe('report');
      expect(one('S3', total).label.startsWith(carried)).toBe(true);
    }
    // Travel: the train's cost (1.1) as the subtotal 406, the bike's flat amount as Person 2's 456.
    expect(one('F4-1', '406').copy).toBe('1480');
    expect(one('F4-2', '456').role).toBe('total');
  });

  it('gives the engine’s totals, and 21.1 as the form lays it out', () => {
    const { result, one } = panel(KELLER);
    const icc = result.icc!;
    expect(one('S2', '168').copy).toBe(typed(icc.grossIncome.amount));
    expect(one('S3', '230').copy).toBe(typed(icc.totalDeductions.amount));
    expect(one('S3', '234').copy).toBe(typed(icc.netIncomeBase.amount));
    expect(one('S3', '248').copy).toBe(typed(icc.netIncome.amount));
    expect(one('S3', '268').copy).toBe(typed(icc.taxableIncome.amount));
    // 168 less 230 is 234, as the form says (Ziffer 7 abzüglich Ziffer 18).
    expect(one('S2', '168').centimes! - one('S3', '230').centimes!).toBe(one('S3', '234').centimes);
    // 21.1: the costs you bore (650) less the excess (238) is the deduction (240).
    expect(icc.medical).not.toBeNull();
    expect(one('S3', '650').centimes).toBe(650_000);
    expect(one('S3', '650').centimes! - one('S3', '238').centimes!).toBe(one('S3', '240').centimes);
    expect(one('S3', '238').role).toBe('computed');
    expect(one('S3', '240').role).toBe('total');
    expect(one('S3', '244').copy).toBe('1500');
  });

  it('types the wealth page, with its totals, when there is wealth', () => {
    const { result, one } = panel(KELLER);
    const w = result.icc!.wealth;
    expect(one('S4', '300').copy).toBe('120000');
    expect(one('S4', '504').copy).toBe('40000');
    expect(one('S4', '332').copy).toBe(typed(-w.items.find((i) => i.code === '332')!.amount));
    expect(one('S4', '322').copy).toBe(typed(w.grossWealth.amount));
    expect(one('S4', '326').copy).toBe(typed(w.netWealth.amount));
    expect(one('S4', '338').copy).toBe(typed(w.taxableWealth.amount));
    expect(one('S4', '322').centimes! - one('S4', '504').centimes!).toBe(one('S4', '326').centimes);
    expect(one('S4', '300').columns.map((c) => c.label)).toEqual(['Steuerwert am 31. Dezember']);
  });

  it('leaves out the wealth page without wealth, and 21.1’s lines without illness costs', () => {
    const { result, built, rows } = panel({
      ...KELLER,
      household: { healthPremiums: chf(10_800) },
      movable: [],
    });
    expect(result.icc).toBeTruthy();
    expect(result.icc!.medical).toBeNull();
    expect(built.unplaced).toEqual([]);
    expect(built.sections.map((s) => s.page)).toEqual(['F4-1', 'F4-2', 'S2', 'S3']);
    expect(rows.filter((r) => ['650', '238', '240'].includes(r.key))).toEqual([]);
  });

  it('gives nothing to type when the cantonal tax is not computed', () => {
    const r = rules.computeReturn({
      ...KELLER,
      people: [{ ...KELLER.people[0]!, selfEmploymentProfit: chf(20_000) }, KELLER.people[1]!],
    });
    expect(r.icc).toBeNull();
    expect(stGallenFormItems(r)).toEqual([]);
  });

  it('answers the generic views: lines, order, the 2026 note, the words for Claude', () => {
    expect(filing.canton).toBe('SG');
    expect(stGallenLineOf('salary.gross', 'p1')).toBe('100');
    expect(stGallenLineOf('salary.gross', 'p2')).toBe('102');
    expect(stGallenLineOf('pillar3a.paid', 'p2')).toBe('210');
    expect(stGallenLineOf('lpp.buyin', 'p2')).toBe('219');
    expect(stGallenLineOf('replacement.amount', 'p1')).toBe('134');
    expect(stGallenLineOf('health.premiums', 'p1')).toBe('600');
    expect(stGallenLineOf('debt.interest', 'p1')).toBe('500');
    expect(stGallenLineOf('debt.balance', 'p1')).toBe('504');
    expect(stGallenLineOf('childcare.costs', 'p1')).toBe('258');
    expect(stGallenLineOf('medical.costs', 'p1')).toBe('650');
    expect(stGallenLineOf('donation.amount', 'p1')).toBe('244');
    expect(stGallenLineOf('unknown.key', 'p1')).toBeUndefined();
    expect(filing.salaryLine('p2')).toBe('102');
    // Every line a ledger value goes to is on the form.
    const keys = new Set(FORM_SG_2026.rubrics.filter((r) => r.supported).map((r) => r.key));
    for (const k of ['salary.gross', 'pillar3a.paid', 'lpp.buyin', 'replacement.amount']) {
      for (const p of ['p1', 'p2']) expect(keys).toContain(stGallenLineOf(k, p));
    }
    const order = filing.formOrder(2026);
    expect(order('406')! < order('456')!).toBe(true);
    expect(order('456')! < order('100')!).toBe(true);
    expect(order('100')! < order('168')!).toBe(true);
    expect(order('168')! < order('500')!).toBe(true);
    expect(order('500')! < order('268')!).toBe(true);
    expect(order('268')! < order('300')!).toBe(true);
    expect(order('999')).toBeUndefined();
    expect(filing.formMap(2025).taxYear).toBe(2025);
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)?.en).toMatch(/2025 return/);
    expect(filing.words.guide).toMatch(/E-Tax SG/);
    expect(filing.words.guide).toMatch(/438 for Person 1 and 488 for Person 2/);
    expect(filing.words.example).toBe('F4-1');
    expect(FORM_SG_2026.pages.map((p) => p.id)).toContain(filing.words.example);
    expect(filing.labels).toBe(SG_COPY_LABELS);
    expect(filing.checksPdf).toBe(false);
    expect(filing.formValues!(rules.computeReturn(KELLER)).length).toBeGreaterThan(20);
  });
});
