// Basel-Landschaft's filing side behind the canton interface (packages/rules-ch, canton.ts,
// CantonFiling): the form map of the year (./form-map.ts), the values to type from Basel-Landschaft's
// engine (./items.ts), the column headings, and what Claude says about typing them. The check of
// the official PDF is Geneva's only for now.
//
// Where to type (docs/sources/bl/NOTES.md, Filing channels): online in E-Tax BL (etax.bl.ch, the
// canton's online return, bl-na-efiling-verordnung-331-21 § 1), or on the paper form. Who is who:
// the guide calls the single taxpayer and the first spouse or partner "Person 1 (P1)", the other
// "Person 2 (P2)" (bl-2026-wegleitung p. 3).
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { BlTaxResult } from '@taxpresso/rules-bl';
import type { CantonFiling } from '@taxpresso/rules-ch';
import { BL_FORM_NOTE, baselLandFormMap } from './form-map.js';
import { BL_COPY_LABELS, baselLandFormItems, baselLandLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'BL',
  formMap: baselLandFormMap,
  formOrder(taxYear) {
    // The form's order: page 2, page 3, page 4; a line by its key, else by its code as printed.
    const form = baselLandFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: baselLandLineOf,
  salaryLine: (person) => baselLandLineOf('salary.gross', person)!,
  // The 2026 codes and terms come from the edition of 20 March 2026: flagged provisional.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : BL_FORM_NOTE),
  formValues: (result) => baselLandFormItems(result as BlTaxResult),
  labels: BL_COPY_LABELS,
  words: {
    amounts: ' (CHF ohne Rappen)',
    guide:
      'Basel-Landschaft: type them in E-Tax BL (etax.bl.ch), the canton’s online return, or on the paper form, page by page: page 2 the income, page 3 the deductions in two columns (Staatssteuer, Bundessteuer), page 4 the wealth. Lines 500 to 535 come from the Berufsauslagen form and 720 from the Krankheitskosten form: type the details there, then check the line. Some lines the tax office works out (the federal threshold on 720, the child reduction of the state tax): check them. The securities list (Wertschriften- und Guthabenverzeichnis) is not laid out yet: 300 and 800 are its totals.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2), as on the Basel-Landschaft return; registered partners file as a married couple.',
    example: 'S3',
  },
  checksPdf: false,
};
