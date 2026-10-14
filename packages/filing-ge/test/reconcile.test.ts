// The check before transmitting (SPEC.md 10.4): the printed declaration against the copy panel,
// rubric by rubric and person by person, in whole francs; totals checked, never counted.
import { describe, expect, it } from 'vitest';
import {
  buildCopyPanel,
  FORM_2026,
  reconcileDeclaration,
  type FormItem,
  type PrintedLine,
} from '../src/index.js';
import { expectCited } from './cite.js';

const item = (
  code: string,
  person: FormItem['person'],
  amount: number,
  extra: Partial<FormItem> = {},
): FormItem => ({ code, person, amount, status: 'stated', ...extra });

const at = (
  form: string,
  code: string,
  person: PrintedLine['person'],
  values: Partial<PrintedLine> = {},
  page = 1,
  occurrence = 1,
): PrintedLine => ({ form, code, person, page, occurrence, ...values });

const chf = (francs: number) => francs * 100;

function check(items: FormItem[], printed: PrintedLine[], lang: 'en' | 'fr' = 'en') {
  const panel = buildCopyPanel({ form: FORM_2026, items, lang });
  return reconcileDeclaration({ form: FORM_2026, panel, printed, lang });
}

const lineOf = (c: ReturnType<typeof check>, page: string, ref: string, part?: string) =>
  c.sections
    .find((s) => s.page === page)
    ?.lines.find((l) => l.ref === ref && (part === undefined || l.part?.id === part));

describe('checking the official PDF against the values to type', () => {
  it('finds what matches, what differs, and what is only on one side', () => {
    const c = check(
      [
        item('11.10', 'p1', chf(98_000), { instance: 'cert' }),
        item('31.10', 'p1', chf(5_880)),
        item('31.40', 'p1', chf(7_258)),
        item('41.30', 'p2', chf(5_000)),
        item('41.40', 'p2', chf(7_258)),
      ],
      [
        at('A1', '11.10', 'A', { icc: chf(98_000), ifd: chf(98_000) }, 5),
        at('A1', '31.10', 'A', { icc: chf(5_880), ifd: chf(5_880) }, 5),
        at('A1', '31.40', 'A', { icc: chf(7_285), ifd: chf(7_285) }, 5),
        at('A1', '31.63', 'A', { icc: chf(150), ifd: chf(150) }, 5),
        at('A2', '41.40', 'B', { icc: chf(7_258), ifd: chf(7_258) }, 6),
      ],
    );
    expect(c.counts).toMatchObject({
      match: 3,
      differs: 1,
      pdfOnly: 1,
      taxpressoOnly: 1,
      toFix: 3,
    });
    expect(c.clear).toBe(false);
    expect(lineOf(c, 'A1', '31.40')).toMatchObject({
      outcome: 'differs',
      label: 'Cotisations au 3ème pilier A',
      person: 'A',
      cells: [
        { column: 'icc', taxpresso: 7_258, pdf: 7_285 },
        { column: 'ifd', taxpresso: 7_258, pdf: 7_285 },
      ],
      pdfPage: 5,
      status: 'stated',
      final: true,
    });
    expect(lineOf(c, 'A1', '31.63')).toMatchObject({
      outcome: 'pdf_only',
      cells: [
        { column: 'icc', pdf: 150 },
        { column: 'ifd', pdf: 150 },
      ],
    });
    expect(lineOf(c, 'A2', '41.30')).toMatchObject({
      outcome: 'taxpresso_only',
      person: 'B',
      cells: [
        { column: 'icc', taxpresso: 5_000 },
        { column: 'ifd', taxpresso: 5_000 },
      ],
    });
    // In the form's order: A1 before A2, rubric by rubric.
    expect(c.sections.map((s) => s.page)).toEqual(['A1', 'A2']);
    expect(c.sections[0]!.lines.map((l) => l.ref)).toEqual(['11.10-1', '31.10', '31.40', '31.63']);
  });

  it('compares in whole francs, as the form takes them', () => {
    const c = check(
      [item('31.40', 'p1', 7_258_40), item('31.10', 'p1', 5_412_60)],
      [
        at('A1', '31.40', 'A', { icc: chf(7_258), ifd: chf(7_258) }),
        at('A1', '31.10', 'A', { icc: chf(5_413), ifd: chf(5_413) }),
      ],
    );
    expect(c.counts).toMatchObject({ match: 2, toFix: 0 });
    expect(c.clear).toBe(true);
  });

  it('pairs the lines of a repeating rubric by amount, whatever order the PDF prints them in', () => {
    const c = check(
      [
        item('11.10', 'p1', chf(80_000), { instance: 'one' }),
        item('11.10', 'p1', chf(30_000), { instance: 'two' }),
      ],
      [
        at('A1', '11.10', 'A', { icc: chf(30_000), ifd: chf(30_000) }, 3, 1),
        at('A1', '11.10', 'A', { icc: chf(80_000), ifd: chf(80_000) }, 3, 2),
      ],
    );
    expect(c.counts).toMatchObject({ match: 2, toFix: 0 });
    const [first, second] = c.sections[0]!.lines;
    expect([first!.ref, first!.cells[0]!.pdf]).toEqual(['11.10-1', 80_000]);
    expect([second!.ref, second!.cells[0]!.pdf]).toEqual(['11.10-2', 30_000]);
  });

  it('compares what each person typed under a household rubric, and leaves the limit to the form', () => {
    const c = check(
      [item('71.00', 'p1', chf(1_200)), item('71.00', 'p2', chf(350))],
      [
        at(
          'PG3',
          '71.00',
          'household',
          { icc: chf(1_525), ifd: 0, parts: { A: chf(1_200), B: chf(300), children: chf(500) } },
          3,
        ),
      ],
    );
    expect(lineOf(c, 'PG3', '71.00', 'A')).toMatchObject({
      outcome: 'match',
      part: { id: 'A', label: 'Contr. A' },
      cells: [{ column: 'amount', taxpresso: 1_200, pdf: 1_200 }],
    });
    expect(lineOf(c, 'PG3', '71.00', 'B')).toMatchObject({
      outcome: 'differs',
      cells: [{ column: 'amount', taxpresso: 350, pdf: 300 }],
    });
    expect(lineOf(c, 'PG3', '71.00', 'children')).toMatchObject({
      outcome: 'pdf_only',
      cells: [{ column: 'amount', pdf: 500 }],
    });
    // The deductible amounts in the ICC and IFD columns are the form's work.
    expect(c.sections[0]!.computed).toMatchObject([
      {
        ref: '71.00',
        check: 'shown',
        cells: [
          { column: 'icc', pdf: 1_525 },
          { column: 'ifd', pdf: 0 },
        ],
      },
    ]);
    expect(c.counts).toMatchObject({ match: 1, differs: 1, pdfOnly: 1, computed: 1 });
  });

  it('reads annex pages column by column, from the rubric’s own columns', () => {
    const c = check(
      [item('59.10', 'household', chf(6_000)), item('59.12', 'household', chf(6_000))],
      [
        at('C4', '59.10', 'household', { amounts: [chf(6_000)] }, 7),
        at('C4', '59.12', 'household', { amounts: [chf(6_100)] }, 7),
        at('C4', '59.00', 'household', { amounts: [chf(6_000), chf(6_100)] }, 7),
      ],
    );
    expect(lineOf(c, 'C4', '59.10')).toMatchObject({
      outcome: 'match',
      cells: [{ column: 'icc', taxpresso: 6_000, pdf: 6_000 }],
    });
    expect(lineOf(c, 'C4', '59.12')).toMatchObject({
      outcome: 'differs',
      cells: [{ column: 'ifd', taxpresso: 6_000, pdf: 6_100 }],
    });
    // The page's total adds up its own lines, column by column.
    expect(c.sections[0]!.computed).toMatchObject([
      {
        ref: '59.00',
        check: 'adds_up',
        cells: [
          { column: 'icc', pdf: 6_000, expected: 6_000 },
          { column: 'ifd', pdf: 6_100, expected: 6_100 },
        ],
      },
    ]);
  });

  it('checks totals and carried totals without counting them as differences', () => {
    const c = check(
      [item('11.10', 'p1', chf(98_000), { instance: 'cert' }), item('31.10', 'p1', chf(5_880))],
      [
        at('PG2', '11.00', 'A', { icc: chf(98_000), ifd: chf(98_000) }, 2),
        at('PG2', '91.00', 'household', { icc: chf(98_000), ifd: chf(98_000) }, 2),
        at('PG3', '91.00', 'household', { icc: chf(98_000), ifd: chf(98_000) }, 3),
        at('PG3', '31.00', 'A', { icc: chf(7_692), ifd: chf(8_497) }, 3),
        at('PG3', '92.20', 'household', { icc: chf(90_308), ifd: chf(89_503) }, 3),
        at('PG3', '71.00', 'household', { icc: chf(100), ifd: 0, parts: { A: chf(500) } }, 3),
        at('PG3', '92.40', 'household', { icc: chf(90_208), ifd: chf(89_000) }, 3),
        at('PG3', '73.10', 'household', { icc: chf(250) }, 3),
        at('PG3', '99.00', 'household', { icc: chf(70_000), ifd: chf(75_000) }, 3),
        at('A1', '11.10', 'A', { icc: chf(98_000), ifd: chf(98_000) }, 5),
        at('A1', '11.00', 'A', { icc: chf(98_000), ifd: chf(98_000) }, 5),
        at('A1', '31.10', 'A', { icc: chf(5_880), ifd: chf(5_880) }, 5),
        at('A1', '31.20', 'A', { ifd: chf(2_617) }, 5),
        at('A1', '31.50', 'A', { icc: chf(1_812) }, 5),
        at('A1', '31.00', 'A', { icc: chf(7_692), ifd: chf(8_500) }, 5),
      ],
    );
    const computed = (page: string, ref: string) =>
      c.sections.find((s) => s.page === page)!.computed.find((l) => l.ref === ref);
    expect(computed('A1', '11.00')).toMatchObject({ check: 'adds_up' });
    // 5'880 + 2'617 = 8'497 in the federal column, not 8'500: shown, but not a difference.
    expect(computed('A1', '31.00')).toMatchObject({
      check: 'off',
      cells: [
        { column: 'icc', pdf: 7_692, expected: 7_692 },
        { column: 'ifd', pdf: 8_500, expected: 8_497 },
      ],
    });
    expect(computed('A1', '31.20')).toMatchObject({ check: 'shown' });
    expect(computed('PG2', '11.00')).toMatchObject({ check: 'adds_up', from: 'A1' });
    expect(computed('PG2', '91.00')).toMatchObject({ check: 'adds_up' });
    expect(computed('PG3', '91.00')).toMatchObject({ check: 'adds_up', from: 'PG2' });
    // The carried 31.00 differs from annex A1's: PG3 has 8'497, A1 8'500.
    expect(computed('PG3', '31.00')).toMatchObject({ check: 'off', from: 'A1' });
    // Sub-totals: gross income less the deductions above, then less medical costs.
    expect(computed('PG3', '92.20')).toMatchObject({
      check: 'adds_up',
      cells: [
        { column: 'icc', pdf: 90_308, expected: 90_308 },
        { column: 'ifd', pdf: 89_503, expected: 89_503 },
      ],
    });
    expect(computed('PG3', '92.40')).toMatchObject({
      check: 'off',
      cells: [
        { column: 'icc', pdf: 90_208, expected: 90_208 },
        { column: 'ifd', pdf: 89_000, expected: 89_503 },
      ],
    });
    // The guide's codes for the deductible donations, cited.
    const donations = computed('PG3', '73.10')!;
    expect(donations).toMatchObject({ check: 'shown', label: 'Dons ICC' });
    expectCited(donations.source!, '73.10');
    expect(computed('PG3', '99.00')).toMatchObject({ check: 'shown' });
    expect(c.counts).toMatchObject({ toFix: 1, computedOff: 3 }); // 71.00 A: 500 only in the PDF
    expect(lineOf(c, 'PG3', '71.00', 'A')).toMatchObject({ outcome: 'pdf_only' });
  });

  it('leaves ticks, text and the securities list to the user, and ignores empty lines', () => {
    const c = check(
      [
        { code: 'CS-G', person: 'p1', tick: true, status: 'stated' },
        { code: 'PG1-COMMUNE', person: 'household', text: '6643', status: 'stated' },
        item('31.40', 'p1', chf(7_258)),
      ],
      [
        at('PG1', '11.00', 'A', { amounts: [chf(1)] }, 1),
        at('A1', '31.40', 'A', { icc: chf(7_258), ifd: chf(7_258) }, 5),
        at('A1', '31.10', 'A', { suffix: 'r', icc: 0, ifd: 0 }, 5),
        at('A1', '11.15', 'A', { icc: 0, ifd: 0 }, 5),
        at('F1', '14.00', 'household', { amounts: [chf(185_400), chf(1_250)] }, 8),
      ],
    );
    expect(c.sections.map((s) => s.page)).toEqual(['PG1', 'A1']);
    expect(c.sections[0]!.byEye).toMatchObject([
      { ref: 'PG1-COMMUNE', reason: 'text', value: '6643' },
    ]);
    expect(c.sections[1]!.byEye).toMatchObject([{ ref: 'CS-G', reason: 'tick' }]);
    expect(c.sections[1]!.lines.map((l) => l.ref)).toEqual(['31.40']);
    expect(c.counts).toMatchObject({ match: 1, toFix: 0, byEye: 2 });
  });

  it('flags values that are not final, and codes it doesn’t know', () => {
    const c = check(
      [item('31.40', 'p1', chf(7_258), { status: 'extracted' })],
      [
        at('A1', '31.40', 'A', { icc: chf(7_258), ifd: chf(7_258) }),
        at('A1', '31.10', 'A', { suffix: 'r', icc: chf(800), ifd: chf(800) }),
        at('other', '88.88', 'household', { amounts: [chf(10)] }),
      ],
      'fr',
    );
    expect(lineOf(c, 'A1', '31.40')).toMatchObject({
      outcome: 'match',
      status: 'extracted',
      final: false,
    });
    expect(c.counts.notFinal).toBe(1);
    expect(lineOf(c, 'A1', '31.10 r')).toMatchObject({ outcome: 'pdf_only', known: false });
    expect(c.sections.at(-1)).toMatchObject({
      page: 'other',
      gloss: 'Autres pages',
      lines: [{ ref: '88.88', outcome: 'pdf_only', cells: [{ column: 'amount', pdf: 10 }] }],
    });
    expect(c.clear).toBe(false);
  });

  it('says when the amounts on a line can’t be told apart', () => {
    const c = check(
      [item('59.40', 'p1', chf(900))],
      [
        at('C4', '59.40', 'household', {
          amounts: [chf(900), chf(1), chf(2), chf(3), chf(4), chf(5)],
        }),
      ],
    );
    expect(c.sections[0]!.byEye).toMatchObject([{ ref: '59.40', reason: 'columns' }]);
    expect(c.counts.toFix).toBe(0);
  });
});

describe('annexe B in the PDF: one sheet per self-employed taxpayer, the same codes for both', () => {
  // The reader can't tell whose a sheet is (its codes are the same for A and B, and the ticked box
  // is not kept): it gives the lines to the household. Taxpresso gives them to the person whose
  // sheet the copy panel has, or, with two, by the order and the amounts that match.
  const sheet = (person: 'p1' | 'p2', turnover: number, avs: number) => [
    item('12.08', person, chf(turnover)),
    item('32.10', person, chf(avs)),
    item('12.17', person, chf(turnover), { status: 'computed' }),
  ];
  const printedSheet = (turnover: number, avs: number, occurrence: number, page = 8) => [
    at('B2', '12.08', 'household', { amounts: [chf(turnover), chf(turnover)] }, page, occurrence),
    at('B2', '12.17', 'household', { amounts: [chf(turnover), chf(turnover)] }, page, occurrence),
    at('B4', '32.10', 'household', { amounts: [chf(avs), chf(avs)] }, page + 2, occurrence),
  ];

  it('gives the sheet to the only self-employed taxpayer, here B', () => {
    const c = check(sheet('p2', 48_000, 4_000), printedSheet(48_000, 4_000, 1));
    expect(c.counts).toMatchObject({ match: 2, toFix: 0, computedOff: 0 });
    expect(lineOf(c, 'B2', '12.08')).toMatchObject({ person: 'B', outcome: 'match' });
    expect(lineOf(c, 'B4', '32.10')).toMatchObject({ person: 'B', outcome: 'match' });
    expect(c.sections.find((s) => s.page === 'B2')!.computed).toMatchObject([
      { ref: '12.17', check: 'adds_up' },
    ]);
  });

  it('with two sheets, finds whose is whose by the amounts, whatever their order', () => {
    const items = [...sheet('p1', 95_000, 9_000), ...sheet('p2', 48_000, 4_000)];
    // B's sheet printed first.
    const c = check(items, [
      ...printedSheet(48_000, 4_000, 1),
      ...printedSheet(95_000, 9_000, 2, 12),
    ]);
    expect(c.counts).toMatchObject({ match: 4, toFix: 0 });
    const b2 = c.sections.find((s) => s.page === 'B2')!.lines;
    expect(b2.map((l) => [l.person, l.cells[0]!.pdf])).toEqual([
      ['A', 95_000],
      ['B', 48_000],
    ]);
  });

  it('still shows a real difference on a sheet', () => {
    const c = check(sheet('p1', 95_000, 9_000), printedSheet(95_000, 9_500, 1));
    expect(lineOf(c, 'B4', '32.10')).toMatchObject({
      person: 'A',
      outcome: 'differs',
      cells: [
        { column: 'icc', taxpresso: 9_000, pdf: 9_500 },
        { column: 'ifd', taxpresso: 9_000, pdf: 9_500 },
      ],
    });
    expect(c.counts.toFix).toBe(1);
  });
});
