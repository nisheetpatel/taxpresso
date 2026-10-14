// Fribourg's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling):
// the form map of the year (./form-map.ts), the values to type from Fribourg's engine (./items.ts),
// the column headings, and what Claude says about typing them. The check of the official PDF is
// Geneva's only for now.
//
// Where to type (docs/sources/fr/NOTES.md, Filing channels): FriTax, the SCC's free program
// installed on the computer (Windows, macOS, Ubuntu), which sends the return with the FriTax code
// printed on the folder; or the paper return. FriTax is a desktop program, not a web page: Claude's
// browser can't fill it, so the copy panel is the way, the user typing each value. Who is who: the
// return calls the people taxed together person 1 and person 2
// (fr-2025-guide-instructions-generales p. 8).
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { FrTaxResult } from '@taxpresso/rules-fr';
import { FR_FORM_NOTE, FR_FORM_NOTE_2025, fribourgFormMap } from './form-map.js';
import { FR_COPY_LABELS, fribourgFormItems, fribourgLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'FR',
  formMap: fribourgFormMap,
  formOrder(taxYear) {
    // The form's order: the annexes that carry to the return, then the codes; a line by its key,
    // else by its code as printed.
    const form = fribourgFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: (key) => fribourgLineOf(key),
  salaryLine: () => '1.110',
  // The codes are the 2025 guide's, the return itself not in the sources library: always flagged.
  formNote: (taxYear) => (taxYear === 2025 ? FR_FORM_NOTE_2025 : FR_FORM_NOTE),
  formValues: (result) => fribourgFormItems(result as FrTaxResult),
  labels: FR_COPY_LABELS,
  words: {
    amounts: ' (en francs entiers)',
    guide:
      'Fribourg: type them in FriTax, the canton’s free program installed on the user’s computer (it sends the return with the FriTax code printed on the folder), or on the paper return. FriTax is not a web page: you can’t fill it with the browser, so the user types each value from this list, code by code; Taxpresso never sends anything. Fill annex 01 (the securities list) and annex 02 (the debts) first: their totals carry to 3.210 and 4.210. Lines FriTax works out (the flat amounts 4.110, the totals 4.910, 6.910, 7.110, 7.910, the child deduction 6.110): only check them. The return has no federal part: the tax office derives the federal tax.',
    persons:
      'Person 1 is you (p1), person 2 your spouse or partner (p2), as the return calls the people taxed together. If your return has you the other way round, swap them. Registered partners file as a married couple.',
    example: 'VI',
  },
  checksPdf: false,
};
