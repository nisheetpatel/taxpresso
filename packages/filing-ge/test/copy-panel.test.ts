// The copy panel: the form's order, the form's formats, and values that are not final never look final.
import { describe, expect, it } from 'vitest';
import {
  buildCopyPanel,
  enteredValue,
  FORM_2026,
  formText,
  roundToFranc,
  type FormItem,
} from '../src/index.js';

const item = (
  code: string,
  person: FormItem['person'],
  amount: number,
  extra: Partial<FormItem> = {},
): FormItem => ({
  code,
  person,
  amount,
  status: 'stated',
  ...extra,
});

const ITEMS: FormItem[] = [
  // Given out of order on purpose.
  item('52.21', 'p1', 4_800_00, { source: { documents: ['lamal'] } }),
  item('31.40', 'p1', 7_258_00),
  item('11.10', 'p1', 12_000_40, { instance: 'cert2', fields: { employer: 'Café du Coin Sàrl' } }),
  item('11.10', 'p1', 80_000_00, {
    instance: 'cert1',
    fields: { employer: 'Exemple Horlogerie SA' },
  }),
  item('31.10', 'p1', 5_800_00, { status: 'extracted' }),
  item('31.50', 'p1', 1_812_00, { status: 'computed' }),
  item('11.00', 'p1', 92_000_40, { status: 'computed' }),
  { code: 'CS-G', person: 'p1', tick: true, status: 'stated' },
  { code: 'PG1-COMMUNE', person: 'household', text: '6630', status: 'stated' },
  item('73.00', 'household', 250_00, { status: 'estimate' }),
];

const panel = (lang: 'en' | 'fr' = 'en', entered?: (id: string) => string | undefined) =>
  buildCopyPanel({ form: FORM_2026, items: ITEMS, lang, ...(entered ? { entered } : {}) });

describe('the copy panel', () => {
  it('goes page by page in the official order, rubric by rubric', () => {
    const p = panel();
    expect(p.sections.map((s) => s.page)).toEqual(['PG1', 'PG2', 'PG3', 'A1', 'C3']);
    const a1 = p.sections.find((s) => s.page === 'A1')!;
    expect(a1.groups.map((g) => g.section)).toEqual([
      'revenu',
      'autres-renseignements',
      'deductions',
    ]);
    expect(a1.groups.flatMap((g) => g.rows.map((r) => r.ref))).toEqual([
      '11.10-1',
      '11.10-2',
      '11.00',
      'CS-G',
      '31.10',
      '31.50',
      '31.40',
    ]);
    // Lines are numbered in the order the values came.
    expect(a1.groups[0]!.rows[0]).toMatchObject({
      ref: '11.10-1',
      fields: [
        {
          id: 'employer',
          label: 'Nom de l’employeur – Adresse du lieu de travail',
          value: 'Café du Coin Sàrl',
        },
      ],
    });
    expect(p).toMatchObject({ taxYear: 2026, formYear: 2025, provisional: true });
    expect(p.note).toMatch(/2025 form/);
  });

  it('writes amounts as the form asks: whole francs, no separators; imputations with centimes', () => {
    const a1 = panel().sections.find((s) => s.page === 'A1')!;
    const [line1, line2] = a1.groups[0]!.rows;
    expect(line1).toMatchObject({
      ref: '11.10-1',
      centimes: 12_000_40,
      copy: '12000',
      rounded: true,
    });
    expect(line2).toMatchObject({ ref: '11.10-2', copy: '80000', rounded: false });
    expect(roundToFranc(1_50)).toBe(2);
    expect(roundToFranc(1_49)).toBe(1);
    expect(roundToFranc(-1_50)).toBe(-2);
    expect(roundToFranc(0)).toBe(0);
    expect(formText('money', { amount: 7_258_00 })).toBe('7258');
    expect(formText('money_cents', { amount: 1_234_55 })).toBe('1234.55');
    expect(formText('money_cents', { amount: 5 })).toBe('0.05');
    expect(formText('date', { text: '2026-12-31' })).toBe('31.12.2026');
    expect(formText('tick', { tick: true })).toBeUndefined();
  });

  it('shows the official label, the gloss in the page language, and where the value goes', () => {
    const en = panel('en');
    const fr = panel('fr');
    const find = (p: typeof en, ref: string) =>
      p.sections.flatMap((s) => s.groups.flatMap((g) => g.rows)).find((r) => r.ref === ref)!;
    expect(find(en, '31.40')).toMatchObject({
      label: 'Cotisations au 3ème pilier A',
      gloss: 'Payments into pillar 3a',
      columns: [
        { id: 'icc', label: 'ICC' },
        { id: 'ifd', label: 'IFD' },
      ],
      copy: '7258',
    });
    expect(find(en, '31.40').source).toContain('ge-2025-declaration-specimen p. 5');
    expect(find(fr, '31.40').gloss).toBe('Versements au 3e pilier A');
    expect(find(en, '52.21')).toMatchObject({
      part: { id: 'A', label: 'Contr. A', gloss: 'taxpayer A' },
      columns: [{ id: 'icc_ifd', label: 'ICC et IFD' }],
      documents: ['lamal'],
    });
    expect(find(en, 'PG1-COMMUNE')).toMatchObject({ copy: '6630', format: 'text' });
  });

  it('never makes a value that needs an OK, or an estimate, look final', () => {
    const p = panel();
    const rows = p.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
    expect(rows.find((r) => r.ref === '31.10')).toMatchObject({
      status: 'extracted',
      final: false,
      enterable: false,
    });
    expect(rows.find((r) => r.ref === '73.00')).toMatchObject({
      status: 'estimate',
      final: false,
      enterable: false,
    });
    // Worked out by the form (flat deduction, total): shown to check, never ticked.
    expect(rows.find((r) => r.ref === '31.50')).toMatchObject({
      role: 'computed',
      enterable: false,
    });
    const a1 = p.sections.find((x) => x.page === 'A1')!.groups.flatMap((g) => g.rows);
    expect(a1.find((r) => r.ref === '11.00')).toMatchObject({ role: 'total', enterable: false });
    expect(rows.find((r) => r.ref === '11.00')).toMatchObject({ role: 'report', enterable: false });
    expect(p.pending).toBe(2);
  });

  it('counts ticks per page, and a changed value unticks itself', () => {
    const stored: Record<string, string> = {};
    const first = panel('en');
    const rows = first.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
    const r3a = rows.find((r) => r.ref === '31.40')!;
    const line1 = rows.find((r) => r.ref === '11.10-1')!;
    const tick = rows.find((r) => r.ref === 'CS-G')!;
    stored[r3a.id] = enteredValue(r3a)!;
    stored[line1.id] = '11999';
    stored[tick.id] = enteredValue(tick)!;
    const again = panel('en', (id) => stored[id]);
    const a1 = again.sections.find((s) => s.page === 'A1')!;
    // A1 has 5 values to type: two salary lines, box G, 3a, and 31.10 (which needs an OK first).
    expect(a1).toMatchObject({ entered: 2, total: 5, pending: 1 });
    const after = a1.groups.flatMap((g) => g.rows);
    expect(after.find((r) => r.ref === '31.40')!.entered).toBe(true);
    expect(after.find((r) => r.ref === '11.10-1')!.entered).toBe(false);
    expect(after.find((r) => r.ref === 'CS-G')!.entered).toBe(true);
    expect(again.entered).toBe(2);
  });

  it('places a code on the right page by its column, and reports what has no place', () => {
    const p = buildCopyPanel({
      form: FORM_2026,
      lang: 'en',
      items: [
        item('14.00', 'household', 1_000_00, { status: 'computed' }),
        item('14.00', 'household', 50_000_00, { status: 'computed', column: 'wealth' }),
        item('55.10', 'p1', 450_00, { column: 'icc_ifd', instance: 'loan' }),
        item('55.10', 'p1', 15_000_00, { column: 'wealth', instance: 'loan' }),
        item('12.00', 'household', 1_00, { status: 'computed' }),
        item('11.10', 'p2', 1_00),
        item('74.00', 'child1', 1_00),
      ],
    });
    const where = (ref: string) =>
      p.sections
        .flatMap((s) =>
          s.groups.flatMap((g) =>
            g.rows.map((r) => [s.page, r.ref, r.columns.map((c) => c.id).join('+'), r.copy]),
          ),
        )
        .filter((x) => x[1] === ref);
    expect(where('14.00')).toEqual([
      ['PG2', '14.00', 'icc+ifd', '1000'],
      ['PG4', '14.00', 'wealth', '50000'],
    ]);
    expect(where('55.10-1')).toEqual([
      ['E1', '55.10-1', 'icc_ifd', '450'],
      ['E1', '55.10-1', 'wealth', '15000'],
    ]);
    // Self-employment is not supported; 11.10 is taxpayer A's; 74.00 has no children's part.
    expect(p.unplaced).toEqual([
      { code: '12.00', person: 'household' },
      { code: '11.10', person: 'p2' },
      { code: '74.00', person: 'child1' },
    ]);
  });

  it('adds up items for the same box', () => {
    const p = buildCopyPanel({
      form: FORM_2026,
      lang: 'en',
      items: [
        item('41.40', 'p2', 3_000_00),
        item('41.40', 'p2', 4_258_00, { status: 'extracted' }),
      ],
    });
    const row = p.sections[0]!.groups[0]!.rows[0]!;
    expect(p.sections[0]!.page).toBe('A2');
    expect(row).toMatchObject({ ref: '41.40', copy: '7258', status: 'extracted', final: false });
  });
});
