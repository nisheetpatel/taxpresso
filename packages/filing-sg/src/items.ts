// The values to type on St. Gallen's return, from St. Gallen's engine (@taxpresso/rules-sg): every
// line its cantonal result (`icc`) gives, in the return's one column. Form 4 first: each person's
// lines on their side of the form and their total (438 for Person 1, 488 for Person 2), the same
// value on the form and, carried, on page 3's 10.1 and 10.2. Then page 2's income and its total 168,
// page 3's deductions, the totals 230, 234, 248 and 268, 21.1 as the form lays it out (the costs
// 650 and the excess 238, from `icc.medical`, then the deduction 240), and page 4's wealth with 322,
// 326 and 338, only when there is wealth or a debt to declare. Deductions, debts and tax-free
// amounts as positive amounts, as the form takes them (where it shows a "-", the sign is printed),
// totals with their sign. The federal tax (`ifd`) is typed nowhere: the return has no federal
// column, the tax office derives it (sg-2025-guide-wegleitung p. 49).
//
// Pure, and it computes nothing but Form 4's total of each person, the sum of that person's Form 4
// lines as the form adds them up (6., "Total der Berufskosten"). The copy panel (@taxpresso/filing-ge,
// buildCopyPanel) places the values on the form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  weakestStatus,
  type CopyLabels,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus, Owner } from '@taxpresso/ledger';
import type { Line } from '@taxpresso/rules-ch';
import { ASSETS, DEBTS, INCOME, type Item, type SgTaxResult } from '@taxpresso/rules-sg';
import { FORM_SG_2025, SG_FORM4_TOTAL } from './form-map.js';

/**
 * How St. Gallen's forms head their one column and name the people: page 2 "Einkünfte 2025 für die
 * Dauer der Steuerpflicht", Form 4 and page 3 "Abzüge 2025 (für die Dauer der Steuerpflicht)", page 4
 * "Steuerwert am 31. Dezember 2025" (sg-2025-form-steuererklaerung p. 2 to 4, sg-2025-form-berufskosten
 * p. 1 and 2), without the year: the labels serve 2025 and 2026. "Person 1" and "Person 2" as page 1
 * names them (sg-2025-form-steuererklaerung p. 1).
 */
export const SG_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc_ifd: {
      label: 'Einkünfte für die Dauer der Steuerpflicht',
      gloss: {
        en: 'income for the period of tax liability, one column for the cantonal, communal and federal tax',
        fr: 'revenus pour la durée de l’assujettissement, une seule colonne pour l’impôt cantonal, communal et fédéral',
      },
    },
    amount: {
      label: 'Abzüge für die Dauer der Steuerpflicht',
      gloss: {
        en: 'deductions for the period of tax liability, one column for the cantonal, communal and federal tax',
        fr: 'déductions pour la durée de l’assujettissement, une seule colonne pour l’impôt cantonal, communal et fédéral',
      },
    },
    wealth: {
      label: 'Steuerwert am 31. Dezember',
      gloss: { en: 'tax value on 31 December', fr: 'valeur fiscale au 31 décembre' },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Person 1', gloss: { en: 'person 1', fr: 'personne 1' } },
    B: { label: 'Person 2', gloss: { en: 'person 2', fr: 'personne 2' } },
    children: { label: 'Kinder', gloss: { en: 'children', fr: 'enfants' } },
  },
};

/** The codes of Form 4's lines, both sides, but its totals (6.): what a person's total adds up. */
const FORM4_TOTALS = new Set<string>(Object.values(SG_FORM4_TOTAL));
const FORM4 = new Set(
  FORM_SG_2025.rubrics
    .filter((r) => (r.page === 'F4-1' || r.page === 'F4-2') && !FORM4_TOTALS.has(r.key))
    .map((r) => r.key),
);

/** Not final while a value needs the user's OK, or rests on an estimate or a part only. */
function statusOf(l: Line): FactStatus {
  if (l.needsOk) return 'extracted';
  if (l.estimates?.length || l.incomplete) return 'estimate';
  return 'computed';
}

const sourceOf = (l: Line) => ({
  ...(l.facts?.length ? { facts: l.facts } : {}),
  rule: l.sources.join('; '),
});

/** A line as typed: a deduction, a debt or a tax-free amount without its sign. */
function one(code: string, person: Owner, l: Line, wealth = false): FormItem {
  return {
    code,
    person,
    ...(wealth ? { column: 'wealth' as const } : {}),
    amount: Math.abs(l.amount),
    status: statusOf(l),
    source: sourceOf(l),
  };
}

/** A total the form adds up, for the household, with its sign (a net wealth can be negative). */
function total(code: string, l: Line, wealth = false): FormItem {
  return {
    code,
    person: 'household',
    ...(wealth ? { column: 'wealth' as const } : {}),
    amount: l.amount,
    status: statusOf(l),
    source: sourceOf(l),
  };
}

/** Form 4's total of a person: the sum of their Form 4 lines (6., Total der Berufskosten). */
function form4Total(person: 'p1' | 'p2', lines: readonly Item[]): FormItem {
  const facts = [...new Set(lines.flatMap((l) => l.facts ?? []))];
  return {
    code: SG_FORM4_TOTAL[person],
    person,
    amount: lines.reduce((s, l) => s + Math.abs(l.amount), 0),
    status: weakestStatus(lines.map(statusOf)),
    source: {
      ...(facts.length ? { facts } : {}),
      rule: [...new Set(lines.flatMap((l) => l.sources))].join('; '),
    },
  };
}

/** Every value St. Gallen's engine gives for the return, as form items, in the form's order. */
export function stGallenFormItems(r: SgTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const out: FormItem[] = [];

  // Form 4, Person 1 then Person 2: each line, and the total that page 3 carries to 10.1 and 10.2.
  for (const person of ['p1', 'p2'] as const) {
    const lines = icc.items.filter((i) => i.person === person && FORM4.has(i.code));
    if (!lines.length) continue;
    for (const i of lines) out.push(one(i.code, i.person, i));
    out.push(form4Total(person, lines));
  }

  // Page 2: the income, and its total 168.
  for (const i of icc.items) if (INCOME.has(i.code)) out.push(one(i.code, i.person, i));
  out.push(total('168', icc.grossIncome));

  // Page 3: the deductions 11 to 17, 21.1 to 21.3 and 23.1 to 23.3, and the totals.
  for (const i of icc.items) {
    if (!INCOME.has(i.code) && !FORM4.has(i.code)) out.push(one(i.code, i.person, i));
  }
  out.push(total('230', icc.totalDeductions), total('234', icc.netIncomeBase));
  if (icc.medical) {
    out.push(
      one('650', 'household', icc.medical.costs),
      one('238', 'household', icc.medical.threshold),
    );
  }
  out.push(total('248', icc.netIncome), total('268', icc.taxableIncome));

  // Page 4, only when there is wealth or a debt to declare.
  const w = icc.wealth;
  if (w.items.some((i) => ASSETS.has(i.code) || DEBTS.has(i.code))) {
    for (const i of w.items) out.push(one(i.code, i.person, i, true));
    out.push(
      total('322', w.grossWealth, true),
      total('326', w.netWealth, true),
      total('338', w.taxableWealth, true),
    );
  }
  return out;
}

/** The line a ledger value goes to on the return, for this person (the final check's titles). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '102'],
  'salary.gross': ['100', '102'],
  'salary.net': ['100', '102'],
  'salary.social_contributions': ['100', '102'],
  'salary.lpp_ordinary': ['100', '102'],
  'salary.lpp_buyin': ['100', '102'],
  'pillar3a.paid': ['208', '210'],
  'lpp.buyin': ['218', '219'],
  'replacement.amount': ['134', '136'],
  'health.premiums': '600',
  'debt.interest': '500',
  'debt.balance': '504',
  'childcare.costs': '258',
  'medical.costs': '650',
  'donation.amount': '244',
};

export function stGallenLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
