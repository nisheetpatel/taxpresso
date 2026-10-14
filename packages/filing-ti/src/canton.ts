// Ticino's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form map of the year (./form-map.ts), the values to type from Ticino's engine (./items.ts), the
// column headings, and what Claude says about typing them. The check of the official PDF is
// Geneva's only for now.
//
// Where to type (docs/sources/ti/NOTES.md, Filing channels): in eTax PF, the canton's free program
// for Windows, macOS and Linux, signed in with the registry number (numero di registro) and the
// password printed on the first page of Modulo 1, then sent electronically (ti-2025-efiling-etax-pf;
// ti-2025-efiling-guida-etax), or on the paper forms. Which form feeds which line: Modulo 4 for 9.1
// and 9.2 (ti-2025-form-modulo-4 p. 1 and 2), Modulo 6 for 12, 20 and 22.1 (ti-2025-form-modulo-6
// p. 1 and 2), Modulo 5 for 13.2, 33.1, 24 and 15.2 (ti-2025-form-modulo-5 p. 1 and 2). Who is who:
// the taxpayer (contribuente) and the spouse or registered partner (coniuge/partner registrato), as
// Modulo 4 names them.
//
// Amounts: the forms' amount columns are headed "Fr." (ti-2025-form-modulo-4 p. 1,
// ti-2025-form-modulo-6 p. 1), in whole francs; neither the forms nor the instructions state a
// rounding rule in words.
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { TiTaxResult } from '@taxpresso/rules-ti';
import { TI_FORM_NOTE, ticinoFormMap } from './form-map.js';
import { TI_COPY_LABELS, ticinoFormItems, ticinoLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'TI',
  formMap: ticinoFormMap,
  formOrder(taxYear) {
    // The order you fill it in: Modulo 4 (taxpayer, spouse), Moduli 6 and 5, then Modulo 1's pages
    // 2, 3 and 4; a line by its key, else by its number as printed.
    const form = ticinoFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: ticinoLineOf,
  salaryLine: () => '1.1',
  // Tax year 2026 uses the 2025 forms until the 2026 ones are published: flagged provisional.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : TI_FORM_NOTE),
  formValues: (result) => ticinoFormItems(result as TiTaxResult),
  labels: TI_COPY_LABELS,
  words: {
    amounts: ' (Fr., without centimes)',
    guide:
      'Ticino: type them in eTax PF, the canton’s free program installed on the user’s computer (not a web page: you can’t fill it with the browser, so the user types each value from this list), signed in with the registry number (numero di registro) and password printed on the first page of Modulo 1, or on the paper forms. Start with Modulo 4 (spese professionali), one side per person: its total, 438 for the taxpayer and 488 for the spouse, goes to 9.1 and 9.2 on page 3. Modulo 6 is behind 12 (premiums: type each one from its attestation on 1.a to 1.e; Taxpresso gives their total (A), the maximum (B) and the deduction 3.), 20 (childcare, each child) and 22.1 (illness costs and the threshold); Modulo 5 behind 13.2 and 33.1 (debts), 24 (donations) and 15.2 (parties). Then Modulo 1 page by page: page 2 the income, page 3 the deductions down to the taxable income 28, page 4 the wealth. The return has one column: the authority works out the federal tax from it. Some lines eTax PF works out (the totals 8, 16 to 28, 32 to 36, the social deductions 25.1, 35.1 and 35.2, the exemption 27): check them. The securities list (Elenco dei titoli, Modulo 2) is not laid out yet: 4.1 and 29.1 are its totals.',
    persons:
      'The taxpayer (contribuente) is you (p1), the spouse or registered partner (coniuge/partner registrato) is p2, as on Modulo 1 and Modulo 4; registered partners file as a married couple.',
    example: 'M4-1',
  },
  checksPdf: false,
};
