// Zurich's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling):
// the form map of the year (./form-map.ts), the values to type from Zurich's engine (./items.ts),
// the column headings, and what Claude says about typing them. The check of the official PDF is
// Geneva's only for now.
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import { ZH_FORM_NOTE, type ZhTaxResult } from '@taxpresso/rules-zh';
import { zurichFormMap } from './form-map.js';
import { ZH_COPY_LABELS, zurichFormItems, zurichLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'ZH',
  formMap: zurichFormMap,
  formOrder(taxYear) {
    // The form's order: the main form's lines first (p. 2 to 4), then the annexes' own lines.
    const form = zurichFormMap(taxYear);
    const main = form.rubrics.filter((r) => r.page.startsWith('S'));
    const order = new Map<string, number>();
    [...main, ...form.rubrics.filter((r) => !main.includes(r))].forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    return (code) => order.get(code);
  },
  lineOf: zurichLineOf,
  salaryLine: (person) => zurichLineOf('salary.gross', person)!,
  // The form's codes and terms are the 2025 form's until the 2026 one is published.
  formNote: () => ZH_FORM_NOTE,
  formValues: (result) => zurichFormItems(result as ZhTaxResult),
  labels: ZH_COPY_LABELS,
  words: {
    amounts: ' (CHF ohne Rappen)',
    guide:
      'Zurich: type them in ZHprivateTax, the canton’s free software, or on the paper form. The Berufsauslagen and Versicherungsprämien forms come first: their totals carry to page 3. The securities list (Wertschriftenverzeichnis) is not laid out yet: 150 and 400 are its totals.',
    persons: 'Person 1 is you (p1), Person 2 your spouse or partner (p2), as on the Zurich form.',
    example: 'S2',
  },
  checksPdf: false,
};
