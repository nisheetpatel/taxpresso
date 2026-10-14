// Vaud's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form map of the year (./form-map.ts), the values to type from Vaud's engine and the federal
// worksheet to check (./items.ts), the column headings, and what Claude says about typing them. The
// check of the official PDF is Geneva's only for now.
//
// Where to type (docs/sources/vd/NOTES.md, Filing channels): online in VaudTax, the canton's online
// service (https://prestations.vd.ch/pub/101660/), with the taxpayer number and the control code of
// the A3 transmission form (vd-2025-vaudtax-prestation), or on paper. VaudTax's rubrics follow the
// return's codes ("Activités salariées (codes 100 à 120)", vd-2025-guide p. 17); on paper, the
// annexes come first, then the return (p. 13). Contribuable 1 and 2 are as preprinted on page 1 of
// the return, and each one's data stays in their column (p. 12); registered partners are taxed as
// spouses (p. 10). The return has no federal form (p. 62): VaudTax works out the federal tax.
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { VdTaxResult } from '@taxpresso/rules-vd';
import { VD_FORM_NOTE, vaudFormMap } from './form-map.js';
import { VD_COPY_LABELS, vaudFormItems, vaudLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'VD',
  formMap: vaudFormMap,
  formOrder(taxYear) {
    // The form's order: pages 2 to 4, the annexes, then the federal worksheet; a line by its key
    // (the code as printed), else by its printed code (a box before its code: 660, 670).
    const form = vaudFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: vaudLineOf,
  salaryLine: (person) => vaudLineOf('salary.gross', person)!,
  // The codes and terms are the 2025 return's until the 2026 return is published.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : VD_FORM_NOTE),
  formValues: (result) => vaudFormItems(result as VdTaxResult),
  labels: VD_COPY_LABELS,
  words: {
    amounts: ' (sans les centimes)',
    guide:
      'Vaud: type them in VaudTax, the canton’s online service (https://prestations.vd.ch/pub/101660/, with the taxpayer number and control code of your A3 transmission form), or on the paper form. VaudTax’s rubrics follow the return’s codes (Activités salariées, codes 100 à 120, and so on). On paper, fill the annexes first (01 securities, 02 debts and life insurance, 03 family and salary certificates, 04 professional costs, 05 medical costs, parties and donations), then carry their totals to the codes of pages 2 and 3. Where an annex adds up lines, Taxpresso gives the total: list the lines from your documents, then check it. Deductions go in as positive amounts after the printed minus. The return has no federal column and no federal form: the IFD page is the guide’s worksheet, only to check what VaudTax works out.',
    persons:
      'The Vaud return has a box per taxpayer on page 2, Contribuable 1 and Contribuable 2, as preprinted on page 1 of your return; keep each one’s amounts in their own column. Taxpresso puts you (p1) under Contribuable 1 and your spouse or registered partner (p2) under Contribuable 2: if your return has you the other way round, swap them.',
    example: 'P2',
  },
  checksPdf: false,
};
