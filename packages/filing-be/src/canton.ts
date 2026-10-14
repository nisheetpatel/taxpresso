// Bern's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling): the
// form map of the year (./form-map.ts), the values to type from Bern's engine and TaxMe's summaries
// to check (./items.ts), the column headings, and what Claude says about typing them. The check of
// the official PDF is Geneva's only for now.
//
// Where to type (be-2025-info-np-jan2026-de p. 3): online in BE-Login (TaxMe-Online, www.taxme.ch)
// or on paper. Pillar 3a and buy-ins paid directly: form 1.1 asks whether you paid any and wants
// the attestations (be-2025-steuererklaerung-formulare-de p. 1); TaxMe-Online takes the amounts
// under "Abzüge / Beiträge 2. Säule / Säule 3a" (be-2025-wegleitung-np-de p. 198, Seite 189). Who
// is who: the guide's words for spouses cover registered partners (be-2025-wegleitung-np-de p. 10,
// Seite 1), who file one return as a married couple (p. 21, Seite 12).
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { BeTaxResult } from '@taxpresso/rules-be';
import type { CantonFiling } from '@taxpresso/rules-ch';
import { BE_FORM_NOTE, bernFormMap } from './form-map.js';
import { BE_COPY_LABELS, bernFormItems, bernLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'BE',
  formMap: bernFormMap,
  formOrder(taxYear) {
    // The form's order: forms 1 to 8, then TaxMe's summaries; a line by its key (the engine's
    // code), else by the section's number as printed (2.22, 2.23).
    const form = bernFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: bernLineOf,
  salaryLine: (person) => bernLineOf('salary.gross', person)!,
  // The form's section numbers and terms are the 2025 return's until the 2026 forms are published.
  formNote: () => BE_FORM_NOTE,
  formValues: (result) => bernFormItems(result as BeTaxResult),
  labels: BE_COPY_LABELS,
  words: {
    amounts: ' (in Franken)',
    guide:
      'Bern: type them in TaxMe-Online (BE-Login, www.taxme.ch) or on the paper form, form by form (F1 to F6). Pillar 3a and pension fund buy-ins you paid yourself: on paper, tick ja on form 1.1 and attach the attestations; in TaxMe-Online, type the amounts under Abzüge. Where a form adds up lines (Total Fahrkosten, Total Versicherungsprämien, the lists of forms 3 to 5), Taxpresso gives the total: type the lines from your documents, then check it. The securities list (Wertschriftenverzeichnis, form 3) is not laid out yet: lines 31 and 32 are its totals. TaxMe works out the limits and two summaries (Zusammenzug): check their Steuerbar column against ZK (cantonal and communal tax) and ZB (federal tax).',
    persons:
      'The Bern form has a column per person, Mann and Frau; for registered partners the guide reads its words for spouses as theirs. Taxpresso puts you (p1) under Mann and your spouse or partner (p2) under Frau: if your form or TaxMe-Online has you the other way round, swap them.',
    example: 'F2',
  },
  checksPdf: false,
};
