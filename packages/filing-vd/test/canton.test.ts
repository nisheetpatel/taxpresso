// Vaud's filing side through the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form of the year, the form's order, the line of each ledger value, the values to type and the
// words Claude uses about them. Synthetic only.
import { rules } from '@taxpresso/rules-vd';
import { describe, expect, it } from 'vitest';
import {
  FORM_VD_2025,
  FORM_VD_2026,
  VD_COPY_LABELS,
  VD_FORM_NOTE,
  VD_PAGE_IDS,
  filing,
  vaudFormItems,
  vaudLineOf,
} from '../src/index.js';

const amt = (francs: number) => ({ value: francs * 100 });

/** Every ledger key the final check may name, and its line on the Vaud return. */
const LINES: Record<string, string> = {
  'salary.base': '100',
  'salary.gross': '100',
  'salary.net': '100',
  'salary.social_contributions': '100',
  'salary.lpp_ordinary': '100',
  'salary.lpp_buyin': '100',
  'pillar3a.paid': '310',
  'lpp.buyin': '320',
  'health.premiums': '300',
  'health.subsidy': '300',
  'debt.interest': '610',
  'debt.balance': '610',
  'childcare.costs': '670',
  'vd.child_care': '670',
  'medical.costs': '710',
  'donation.amount': '720',
  'replacement.amount': '210',
  'pension.amount': '240',
  'vd.rent': '660',
  'vd.contents_value': '440',
  'vd.savings_interest': '480',
};

describe('Vaud behind the canton interface', () => {
  it('gives the form of the year and its note', () => {
    expect(filing.canton).toBe('VD');
    expect(filing.formMap(2025)).toBe(FORM_VD_2025);
    expect(filing.formMap(2026)).toBe(FORM_VD_2026);
    expect(() => filing.formMap(2024)).toThrow(/No Vaud form map/);
    // The codes and terms are the 2025 return's: said with a 2026 return only.
    expect(filing.formNote(2025)).toBeUndefined();
    expect(filing.formNote(2026)).toBe(VD_FORM_NOTE);
    expect(filing.labels).toBe(VD_COPY_LABELS);
    expect(filing.checksPdf).toBe(false);
  });

  it('orders the lines as the return does: pages 2 to 4, the annexes, the federal worksheet', () => {
    const at = filing.formOrder(2026);
    const place = (code: string) => {
      const n = at(code);
      expect(n, code).toBeDefined();
      return n!;
    };
    const sequence = ['100', '140', '165', '200', '235', '280', '300', '310', '320', '410'];
    sequence.push('435', '480', '610', '618', '670', '650', '660', '695', '700', '710', '720');
    sequence.push('725', '730', '800', '810', '820');
    for (let i = 1; i < sequence.length; i++) {
      expect(place(sequence[i - 1]!), sequence[i]).toBeLessThan(place(sequence[i]!));
    }
    // A code is where the return prints it, before the annex that carries it.
    const page = (code: string) => FORM_VD_2026.rubrics[place(code)]!.page;
    for (const code of ['140', '410', '435', '610', '710', '720']) {
      expect(['P2', 'P3'], code).toContain(page(code));
    }
    // Lines on the federal worksheet only come last.
    expect(place('820')).toBeLessThan(place('franchise-medicale'));
    expect(place('820')).toBeLessThan(place('deduction-maries'));
    expect(place('820')).toBeLessThan(place('revenu-imposable'));
    expect(at('999')).toBeUndefined();
  });

  it('knows the line of each ledger value, the same for both persons', () => {
    for (const [key, line] of Object.entries(LINES)) {
      expect(vaudLineOf(key, 'p1'), key).toBe(line);
      expect(vaudLineOf(key, 'p2'), key).toBe(line);
      expect(filing.lineOf(key, 'household'), key).toBe(line);
    }
    expect(vaudLineOf('profile.commune', 'household')).toBeUndefined();
    expect(filing.salaryLine('p1')).toBe('100');
    expect(filing.salaryLine('p2')).toBe('100');
    // Every line it names is on the form.
    const order = filing.formOrder(2026);
    for (const key of Object.keys(LINES)) {
      expect(order(vaudLineOf(key, 'p1')!), key).toBeDefined();
    }
  });

  it('gives the values to type from Vaud’s result', () => {
    const result = rules.computeReturn({
      taxYear: 2025,
      commune: 'lausanne',
      civilStatus: 'single',
      people: [
        { id: 'p1', employments: [{ gross: amt(60_000), socialContributions: amt(3_840) }] },
      ],
      cantonal: { rent: amt(12_000) },
    });
    expect(result.icc).not.toBeNull();
    expect(filing.formValues!(result)).toEqual(vaudFormItems(result));
    expect(filing.formValues!(result).length).toBeGreaterThan(0);
  });

  it('tells Claude how to type the values, in plain words', () => {
    const { words } = filing;
    expect(VD_PAGE_IDS as readonly string[]).toContain(words.example);
    expect(words.amounts).toBe(' (sans les centimes)');
    expect(words.guide).toMatch(/VaudTax/);
    expect(words.guide).toContain('https://prestations.vd.ch/pub/101660/');
    expect(words.guide).toMatch(/annexes first/);
    expect(words.guide).toMatch(/IFD page/);
    expect(words.persons).toMatch(/Contribuable 1.*Contribuable 2/);
    for (const text of [words.amounts, words.guide ?? '', words.persons]) {
      expect(text).not.toMatch(/[–—]/);
    }
  });
});
