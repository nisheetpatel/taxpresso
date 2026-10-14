// St. Gallen's filing side behind the canton interface (packages/rules-ch, canton.ts, CantonFiling):
// the form map of the year (./form-map.ts), the values to type from St. Gallen's engine
// (./items.ts), the column headings, and what Claude says about typing them. The check of the
// official PDF is Geneva's only for now.
//
// Where to type (docs/sources/sg/NOTES.md, Filing channels): online in E-Tax SG (started at
// steuern.sg.ch/etaxnp), the canton's web app, signed in with the cantonal E-Login on AGOV
// (sg-2025-guide-wegleitung p. 5 and 9; sg-2025-efiling-faltblatt-etax), or on the paper forms,
// Formular 1 with Formular 2 always and the other forms when needed (sg-2025-guide-wegleitung p. 6).
// Which form feeds which line: sg-2025-guide-wegleitung p. 22 (Form 4 for 10, Form 5 for 11, 16.3
// and 21.3, Form 6 for 14 and 21.1, Form 10 for 16.2 and 23.3); page 4 prints Form 5 next to 34.1
// too. Who is who: the return calls the people taxed together "Person 1" (Ehemann, Einzelperson,
// Partner/Partnerin) and "Person 2" (Ehefrau, Partner/Partnerin) (sg-2025-form-steuererklaerung p. 1).
//
// Amounts: the forms' amount columns are headed "Fr." (sg-2025-form-berufskosten p. 1 and 2), and
// the guide's filled-in securities list writes them in whole francs, only the withholding tax claim
// in "Fr./Rp." (sg-2025-guide-wegleitung p. 39). Neither the return nor the guide states a rounding
// rule in words.
import type { CopyLabels, FormItem, FormMap } from '@taxpresso/filing-ge';
import type { CantonFiling } from '@taxpresso/rules-ch';
import type { SgTaxResult } from '@taxpresso/rules-sg';
import { SG_FORM_NOTE, stGallenFormMap } from './form-map.js';
import { SG_COPY_LABELS, stGallenFormItems, stGallenLineOf } from './items.js';

export const filing: CantonFiling<FormMap<string>, FormItem, CopyLabels> = {
  canton: 'SG',
  formMap: stGallenFormMap,
  formOrder(taxYear) {
    // The order you fill it in: Form 4 (Person 1, Person 2), then the return's pages 2, 3 and 4; a
    // line by its key, else by its code as printed.
    const form = stGallenFormMap(taxYear);
    const order = new Map<string, number>();
    form.rubrics.forEach((r, i) => {
      if (!order.has(r.key)) order.set(r.key, i);
    });
    form.rubrics.forEach((r, i) => {
      if (r.code && !order.has(r.code)) order.set(r.code, i);
    });
    return (code) => order.get(code);
  },
  lineOf: stGallenLineOf,
  salaryLine: (person) => stGallenLineOf('salary.gross', person)!,
  // Tax year 2026 uses the 2025 return until the 2026 one is published: flagged provisional.
  formNote: (taxYear) => (taxYear === 2025 ? undefined : SG_FORM_NOTE),
  formValues: (result) => stGallenFormItems(result as SgTaxResult),
  labels: SG_COPY_LABELS,
  words: {
    amounts: ' (Fr., ohne Rappen)',
    guide:
      'St. Gallen: type them in E-Tax SG (steuern.sg.ch/etaxnp), the canton’s online return, signed in with the cantonal E-Login (AGOV), or on the paper Formular 1. Start with Form 4 (Berufskosten), one side per person: its total, 438 for Person 1 and 488 for Person 2, goes to 10.1 and 10.2 on page 3. On Form 4 the travel goes on 1.1 (public transport, 400), 1.2 (bike, 402) or 1.3 (car, 404); Taxpresso gives their subtotal 406, at most the yearly maximum. Then Formular 1 page by page: page 2 the income, page 3 the deductions down to the taxable income 268, page 4 the wealth. The return has one column: the tax office works out the federal tax from it. Form 6 (Versicherungsprämien, Krankheitskosten) is behind 14 and 21.1, Form 5 (Schulden, Zuwendungen) behind 11, 16.3, 21.3 and 34.1, Form 10 behind 16.2 and 23.3: type the details there, then check the line. Some lines the form or E-Tax SG works out (the flat amounts 3.1 and 5.1 of Form 4, 14, 17, the excess 238, the social deductions 23 and 36): check them. The securities list (Wertschriften- und Guthabenverzeichnis, Formular 2) is not laid out yet: 146 and 300 are its totals.',
    persons:
      'Person 1 is you (p1), Person 2 your spouse or partner (p2), as on St. Gallen’s Formular 1 and Form 4; registered partners file as a married couple.',
    example: 'F4-1',
  },
  checksPdf: false,
};
