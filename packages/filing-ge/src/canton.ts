// Geneva's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling):
// the form map of the year, where each ledger value goes on it, and what Claude says about typing
// it. Geneva's values to type come from the ledger's routes and its engine together (the
// extension's copy panel), and its declaration's PDF is checked (./reconcile.ts).
import type { CantonFiling } from '@taxpresso/rules-ch';
import { FORM_2025 } from './2025/form-map.js';
import { FORM_2026 } from './2026/form-map.js';
import { LEDGER_ROUTES_2026 } from './2026/ledger-map.js';
import type { CopyLabels } from './copy-panel.js';
import type { FormItem, FormMap } from './form.js';

/**
 * The form map of each tax year (docs/design/tax-years.md): adding a year adds its map here. Any
 * other year fails closed, never another year's form.
 */
export const FORMS: Readonly<Record<number, FormMap>> = { 2025: FORM_2025, 2026: FORM_2026 };

const formOf = (taxYear: number): FormMap => {
  const form = FORMS[taxYear];
  if (!form) throw new RangeError(`There is no Geneva form map for ${taxYear}.`);
  return form;
};

export const filing: CantonFiling<FormMap, FormItem, CopyLabels> = {
  canton: 'GE',
  formMap: formOf,
  formOrder(taxYear) {
    // The place of each rubric code on the official form, page by page.
    const order = new Map<string, number>();
    formOf(taxYear).rubrics.forEach((r, i) => {
      const code = r.code ?? r.key;
      if (!order.has(code)) order.set(code, i);
    });
    return (code) => order.get(code);
  },
  lineOf(key, person) {
    // The rubric a ledger value goes to, for this person (./2026/ledger-map.ts).
    const route = LEDGER_ROUTES_2026.find((r) => r.key === key);
    if (!route) return undefined;
    if (typeof route.to === 'string') return /^\d{2}\.\d{2}$/.test(route.to) ? route.to : undefined;
    return person === 'p2' ? route.to.B : route.to.A;
  },
  salaryLine: (person) => (person === 'p2' ? '21.10' : '11.10'),
  formNote(taxYear) {
    const form = formOf(taxYear);
    return form.provisional && form.note ? form.note : undefined;
  },
  words: {
    amounts: '; imputations with centimes',
    persons:
      'Contribuable A is you (p1), B your partner (p2). If the form prints them the other way round, swap A and B.',
    example: 'A1',
  },
  checksPdf: true,
};
