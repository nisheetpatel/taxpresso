// Lucerne's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form map of the year (./form-map.ts), the values to type from Lucerne's engine and the
// Ergänzungsblatt to check (./items.ts), the column headings, and what Claude says about typing
// them. The check of the official PDF is Geneva's only for now.
//
// Where to type (docs/sources/lu/NOTES.md, Filing channels): online in eSteuern.LU
// (esteuern.lu.ch, the canton's web return, with your own eSteuern account and the PersID and
// Zugangscode eFiling printed on your return, lu-2025-efiling-merkblatt-esteuern), or on the paper
// forms, sent signed to the Scan-Center with the attachments (lu-2025-guide-wegleitung p. 10 and
// 11). Who is who: the return calls the people taxed together Person 1 (Einzelperson, Ehemann,
// Partner) and Person 2 (Ehefrau, Partnerin), lu-2025-guide-wegleitung p. 20.
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { LuTaxResult } from '@taxpresso/rules-lu';
import { LU_FORM_NOTE, lucerneFormMap } from './form-map.js';
import { LU_COPY_LABELS, lucerneFormItems, lucerneLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'LU',
  formMap: lucerneFormMap,
  formOrder(taxYear) {
    // The form's order: form B, the securities list, pages 2 to 4, the Ergänzungsblatt; a line by
    // its key, else by its code as printed.
    const form = lucerneFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: lucerneLineOf,
  salaryLine: (person) => lucerneLineOf('salary.gross', person)!,
  // Tax year 2026 uses the 2025 forms until the 2026 ones are published: flagged provisional.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : LU_FORM_NOTE),
  formValues: (result) => lucerneFormItems(result as LuTaxResult),
  labels: LU_COPY_LABELS,
  words: {
    amounts: ' (CHF ohne Rappen)',
    guide:
      'Lucerne: type them in eSteuern.LU (esteuern.lu.ch, the canton’s web return, with your own eSteuern account and the PersID and Zugangscode eFiling printed on your return), or on the paper forms. Fill the helper forms first, as the guide advises: form B (Berufsauslagen: type the public transport paid on 202, the bike flat on 204 or the kilometres on 208, then check the total 208t), the securities list (Wertschriften- und Guthabenverzeichnis, WV), form V (insurance premiums, which gives 270) and form S (debts, 252 and 462); then pages 2 to 4 of the return, in its one column. Lines the form works out (the totals, the degressive social deduction 340, the child deductions, the tax-free amounts 472 to 474): only check them. The Ergänzungsblatt Direkte Bundessteuer is optional: the tax office derives the federal tax from the return anyway; its lines are there to check.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2). The Lucerne return prints the husband as Person 1 (Einzelperson, Ehemann, Partner) and the wife as Person 2: if your return has you the other way round, swap them. Registered partners file as a married couple.',
    example: 'S3',
  },
  checksPdf: false,
};
