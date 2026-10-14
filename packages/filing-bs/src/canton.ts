// Basel-Stadt's filing side behind the canton interface (packages/rules-ch, canton.ts,
// CantonFiling): the form map of the year (./form-map.ts), the values to type from Basel-Stadt's
// engine (./items.ts), the column headings, and what Claude says about typing them. The check of the
// official PDF is Geneva's only for now.
//
// Where to type (bs-2025-guide-wegleitung p. 6; bs-2025-efiling-baltax-tipps p. 1): in BalTax
// Online, the canton's official software in the eSteuern.BS portal (with an AGOV login), or on paper
// (forms marked Ansichtsexemplar are not for filing). The guide's order (p. 5): page 1, then the
// auxiliary forms, then pages 2, 3 and 4. Who is who: Person 1 and Person 2 (main form p. 1:
// "Person 1 (Einzelperson / Ehemann / Partner/in)", "Person 2 (Ehefrau / Partner/in)").
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { BsTaxResult } from '@taxpresso/rules-bs';
import type { CantonFiling } from '@taxpresso/rules-ch';
import { BS_FORM_NOTE, baselFormMap } from './form-map.js';
import { BS_COPY_LABELS, baselFormItems, baselLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'BS',
  formMap: baselFormMap,
  formOrder(taxYear) {
    // The form's order: the auxiliary forms, then pages 2 to 4 of the main form; a line by its key
    // (the engine's code), else by its code as printed.
    const form = baselFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: baselLineOf,
  salaryLine: (person) => baselLineOf('salary.gross', person)!,
  // The form's codes and terms are the 2025 forms' until the 2026 ones are published.
  formNote: (taxYear) => (taxYear === 2026 ? BS_FORM_NOTE : undefined),
  formValues: (result) => baselFormItems(result as BsTaxResult),
  labels: BS_COPY_LABELS,
  words: {
    amounts: ' (CHF ohne Rappen)',
    guide:
      'Basel-Stadt: type them in BalTax Online, the canton’s official software in the eSteuern.BS portal, or on the paper form. The auxiliary forms come first (W, B, K, Z, F): their totals carry to pages 2 to 4 of the main form. From 369 down, the main form has two columns, Kanton and Bund: where the limits differ, so do the values. The securities list itself (Wertschriftenverzeichnis, form W) is not laid out yet: its page 4 totals are.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2), as on the Basel-Stadt form.',
    example: 'H3',
  },
  checksPdf: false,
};
