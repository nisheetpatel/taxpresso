// The values to type on the Aargau return, from Aargau's engine (@taxpresso/rules-ag): every line
// it computes, in the return's one column (the federal tax has none: the tax office works it out),
// the totals the guide names (Total der Einkünfte, Reineinkommen, Ziffer 23, 25 and 37), and the
// wealth page when there is wealth to declare. Pure: the copy panel (@taxpresso/filing-ge,
// buildCopyPanel) places them on the form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus } from '@taxpresso/ledger';
import type { Line } from '@taxpresso/rules-ch';
import { INCOME, type AgTaxResult, type Item } from '@taxpresso/rules-ag';

/** How the Aargau return heads its column and its persons (ag-2025-guide-wegleitung p. 8, p. 9). */
export const AG_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: {
      label: 'Kantons- und Gemeindesteuern',
      gloss: { en: 'cantonal tax', fr: 'impôt cantonal' },
    },
    ifd: { label: 'Direkte Bundessteuer', gloss: { en: 'federal tax', fr: 'impôt fédéral' } },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'value on 31 December', fr: 'valeur au 31 décembre' },
    },
    amount: {
      label: 'CHF (ohne Rappen)',
      gloss: { en: 'whole francs', fr: 'francs entiers' },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Person 1', gloss: { en: 'person 1', fr: 'personne 1' } },
    B: { label: 'Person 2', gloss: { en: 'person 2', fr: 'personne 2' } },
    children: { label: 'Kinder', gloss: { en: 'children', fr: 'enfants' } },
  },
};

/** Not final while a value needs the user's OK, or rests on an estimate or a part only. */
function statusOf(l: Line): FactStatus {
  if (l.needsOk) return 'extracted';
  if (l.estimates?.length || l.incomplete) return 'estimate';
  return 'computed';
}

function one(code: string, person: Item['person'], line: Line, column: FormColumn): FormItem {
  return {
    code,
    person,
    column,
    amount: Math.abs(line.amount),
    status: statusOf(line),
    source: {
      ...(line.facts?.length ? { facts: line.facts } : {}),
      rule: line.sources.join('; '),
    },
  };
}

/** Every value Aargau's engine gives for the return, as form items. */
export function aargauFormItems(r: AgTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const out: FormItem[] = [];
  // Income and deductions, in the engine's order (the return's), each in the one column, typed
  // without a sign as the form asks (the Selbstbehalt, 18, is the amount added back).
  const income = icc.items.filter((i) => INCOME.has(i.code));
  const deductions = icc.items.filter((i) => !INCOME.has(i.code));
  for (const i of income) out.push(one(i.code, i.person, i, 'amount'));
  out.push(one('einkuenfte', 'household', icc.grossIncome, 'amount'));
  for (const i of deductions) out.push(one(i.code, i.person, i, 'amount'));
  out.push(
    one('reineinkommen', 'household', icc.netIncome, 'amount'),
    one('23', 'household', icc.afterSocial, 'amount'),
    one('25', 'household', icc.taxableIncome, 'amount'),
  );
  // The wealth page, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const i of icc.wealth.items) out.push(one(i.code, i.person, i, 'wealth'));
    out.push(
      one('vermoegen', 'household', icc.wealth.grossWealth, 'wealth'),
      one('37', 'household', icc.wealth.taxableWealth, 'wealth'),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Aargau return, for this person (final check). */
const LINE_OF_KEY: Record<string, string> = {
  'salary.base': '1.1',
  'salary.gross': '1.1',
  'salary.net': '1.1',
  'salary.social_contributions': '1.1',
  'salary.lpp_ordinary': '1.1',
  'salary.lpp_buyin': '1.1',
  'pillar3a.paid': '13.2',
  'lpp.buyin': '13.1',
  'replacement.amount': '3-taggelder',
  'debt.interest': '11',
  'debt.balance': '34',
  'childcare.costs': '15.0',
  'medical.costs': '17.1',
  'donation.amount': '15.3',
};

/** The same line for both persons: the form has one line per person, with the same code. */
export function aargauLineOf(key: string): string | undefined {
  return LINE_OF_KEY[key];
}
