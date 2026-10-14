// Zug's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form map of the year (./form-map.ts), the values to type from Zug's engine (./items.ts), the
// column headings, and what Claude says about typing them. The check of the official PDF is
// Geneva's only for now.
//
// Where to type (docs/sources/zg/NOTES.md, Filing channels): online in eTax.zug (zg.ch/etax, the
// canton's online return, in the browser with an AGOV login, zg-na-efiling-etax-zug), or on the paper
// forms. Who is who: the forms call the people taxed together "Person 1" and "Person 2"
// (zg-2025-guide-wegleitung p. 13).
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { ZgTaxResult } from '@taxpresso/rules-zg';
import { ZG_FORM_NOTE, zugFormMap } from './form-map.js';
import { ZG_COPY_LABELS, zugFormItems, zugLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'ZG',
  formMap: zugFormMap,
  formOrder(taxYear) {
    // The form's order: page 2, page 3, page 4; a line by its key, else by its code as printed.
    const form = zugFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: zugLineOf,
  salaryLine: (person) => zugLineOf('salary.gross', person)!,
  // Tax year 2026 uses the 2025 form K until the 2026 forms are published: flagged provisional.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : ZG_FORM_NOTE),
  formValues: (result) => zugFormItems(result as ZgTaxResult),
  labels: ZG_COPY_LABELS,
  words: {
    amounts: ' (keine Rappenbeträge)',
    guide:
      'Zug: type them in eTax.zug (zg.ch/etax), the canton’s online return, or on the paper form K, page by page: page 2 the income, page 3 the deductions, each in two columns, Kanton and Bund, page 4 the wealth. Lines 201/202 come from the Berufsauslagen form (BA), 230 from the Versicherungsprämien form (VZ), 253 from the KDBK form and 296 from the Gemeinnützige Zuwendungen form (GZ): type the details there, then check the line. Some lines the tax office works out (230, 260, the social deductions 400 to 407): check them. The securities list (Wertschriften- und Guthabenverzeichnis, WV) is not laid out yet: 160 and 600 are its totals.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2), as on Zug’s form K; registered partners file as a married couple.',
    example: 'K3',
  },
  checksPdf: false,
};
