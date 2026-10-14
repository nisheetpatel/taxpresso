// Bern's filing side through the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form of the year, the form's order, the line of each ledger value, the values to type and the
// words Claude uses about them. Synthetic only.
import { rules } from '@taxpresso/rules-be';
import { describe, expect, it } from 'vitest';
import {
  BE_COPY_LABELS,
  BE_FORM_NOTE,
  BE_PAGE_IDS,
  bernFormItems,
  bernLineOf,
  filing,
  FORM_BE_2025,
  FORM_BE_2026,
} from '../src/index.js';

const amt = (francs: number) => ({ value: francs * 100 });

describe('Bern behind the canton interface', () => {
  it('gives the form of the year and its note', () => {
    expect(filing.canton).toBe('BE');
    expect(filing.formMap(2025)).toBe(FORM_BE_2025);
    expect(filing.formMap(2026)).toBe(FORM_BE_2026);
    expect(() => filing.formMap(2024)).toThrow(/No Bern form map/);
    // The section numbers and terms are the 2025 return's: said with every Bern return.
    expect(filing.formNote(2025)).toBe(BE_FORM_NOTE);
    expect(filing.formNote(2026)).toBe(BE_FORM_NOTE);
    expect(filing.labels).toBe(BE_COPY_LABELS);
    expect(filing.checksPdf).toBe(false);
  });

  it('orders the lines as the return does: the forms, then TaxMe’s summaries', () => {
    const at = filing.formOrder(2026);
    const place = (code: string) => {
      const n = at(code);
      expect(n, code).toBeDefined();
      return n!;
    };
    expect(place('saeule-3a')).toBeLessThan(place('2.21-haupt'));
    expect(place('2.21-haupt')).toBeLessThan(place('3.0-ertrag'));
    expect(place('3.0-ertrag')).toBeLessThan(place('4.2'));
    expect(place('4.2')).toBeLessThan(place('5.4'));
    expect(place('5.4')).toBeLessThan(place('6.1'));
    // Lines on the summaries only come after the forms.
    expect(place('6.6')).toBeLessThan(place('allgemein'));
    expect(place('6.6')).toBeLessThan(place('zweiverdiener'));
    // A section's number, as printed, for a value whose line depends on its kind.
    expect(place('2.22')).toBeLessThan(place('2.23'));
    expect(place('2.21-haupt')).toBeLessThan(place('2.22'));
    expect(at('9.9')).toBeUndefined();
  });

  it('knows the line of each ledger value, the same for both persons', () => {
    expect(bernLineOf('salary.gross', 'p2')).toBe('2.21-haupt');
    expect(bernLineOf('pillar3a.paid', 'p1')).toBe('saeule-3a');
    expect(bernLineOf('lpp.buyin', 'p2')).toBe('einkauf-bv');
    expect(bernLineOf('health.premiums', 'household')).toBe('4.2');
    expect(bernLineOf('health.subsidy', 'household')).toBe('4.2');
    expect(bernLineOf('debt.interest', 'household')).toBe('4.3');
    expect(bernLineOf('debt.balance', 'household')).toBe('4.3-schulden');
    expect(bernLineOf('childcare.costs', 'household')).toBe('2.1-betreuung');
    expect(bernLineOf('medical.costs', 'household')).toBe('5.4');
    expect(bernLineOf('donation.amount', 'household')).toBe('5.3');
    expect(bernLineOf('pension.amount', 'p1')).toBe('2.22');
    expect(bernLineOf('replacement.amount', 'p1')).toBe('2.23');
    expect(bernLineOf('profile.commune', 'household')).toBeUndefined();
    expect(filing.lineOf('medical.costs', 'p2')).toBe('5.4');
    expect(filing.salaryLine('p1')).toBe('2.21-haupt');
    expect(filing.salaryLine('p2')).toBe('2.21-haupt');
    // Every line it names is on the form.
    const order = filing.formOrder(2026);
    for (const key of [
      'salary.gross',
      'pillar3a.paid',
      'lpp.buyin',
      'health.premiums',
      'debt.balance',
      'childcare.costs',
      'medical.costs',
      'donation.amount',
      'pension.amount',
      'replacement.amount',
      'be.party',
      'be.child_education',
    ]) {
      expect(order(bernLineOf(key, 'p1')!), key).toBeDefined();
    }
  });

  it('gives the values to type from Bern’s result', () => {
    const result = rules.computeReturn({
      taxYear: 2026,
      commune: 351,
      civilStatus: 'single',
      people: [
        { id: 'p1', employments: [{ gross: amt(60_000), socialContributions: amt(3_840) }] },
      ],
      cantonal: { ownHousehold: false },
    });
    expect(filing.formValues!(result)).toEqual(bernFormItems(result));
  });

  it('tells Claude how to type the values, in plain words', () => {
    const { words } = filing;
    expect(BE_PAGE_IDS as readonly string[]).toContain(words.example);
    expect(words.amounts).toBe(' (in Franken)');
    expect(words.guide).toMatch(/TaxMe-Online/);
    expect(words.guide).toMatch(/ZK.*ZB/);
    expect(words.persons).toMatch(/Mann.*Frau/);
    for (const text of [words.amounts, words.guide ?? '', words.persons]) {
      expect(text).not.toMatch(/—/);
    }
  });
});
