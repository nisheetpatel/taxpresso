// Aargau's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling):
// the form map of the year (./form-map.ts, the guide's sections, provisional), the values to type
// from Aargau's engine (./items.ts), the column headings, and what Claude says about typing them.
// The check of the official PDF is Geneva's only for now.
//
// Where to type (docs/sources/ag/NOTES.md, Filing channels): online in eTAX AARGAU (etax.ag.ch,
// the canton's browser application, which replaced EasyTax from tax period 2025), or on the paper
// form: the sheets first, then the main form 101.01 (ag-2025-guide-wegleitung p. 9). Who is who: the
// forms call the spouses or partners "Person 1" and "Person 2" (p. 8).
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { AgTaxResult } from '@taxpresso/rules-ag';
import type { CantonFiling } from '@taxpresso/rules-ch';
import { AG_FORM_NOTE, aargauFormMap } from './form-map.js';
import { AG_COPY_LABELS, aargauFormItems, aargauLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'AG',
  formMap: aargauFormMap,
  formOrder(taxYear) {
    // The guide's order: income, deductions, social deductions, wealth; a line by its key, else by
    // its code.
    const form = aargauFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: aargauLineOf,
  salaryLine: () => '1.1',
  // The main form isn't published: the codes are the guide's sections, for both years.
  formNote: () => AG_FORM_NOTE,
  formValues: (result) => aargauFormItems(result as AgTaxResult),
  labels: AG_COPY_LABELS,
  words: {
    amounts: ' (nur ganze Franken, ohne Rappen)',
    guide:
      'Aargau: type them in eTAX AARGAU (etax.ag.ch), the canton’s online return, or on the paper form, the sheets first (101.02 Berufskosten and Hilfsblatt für weitere Abzüge, 101.04 Schuldenverzeichnis and Renten, 101.05 Wertschriften- und Guthabenverzeichnis, 101.06 Krankheitskosten), then the main form 101.01. The main form isn’t published: the codes are the 2025 guide’s section numbers, so check each against the form or eTAX AARGAU (the guide itself calls the child deduction Ziffer 22.1, and eTAX’s list of receipts puts the securities at Ziffer 30.1). The return has no federal column: the tax office works out the federal tax. Some lines the canton works out (14, 18, 24, the tax-free amounts): check them. The securities list is not laid out yet: 4 and 20.1 are its totals.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2), as the Aargau forms name them; registered partners file as a married couple.',
    example: 'AB',
  },
  checksPdf: false,
};
