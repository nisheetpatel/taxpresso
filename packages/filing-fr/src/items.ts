// The values to type on the Fribourg return, from Fribourg's engine (@taxpresso/rules-fr): every line
// of the return it computes, deductions as positive amounts, each person's on their part; the totals
// of annex 01 and annex 02, which carry to 3.210 and 4.210; the net income (4.910), the income after
// the social deductions and the net wealth (6.910), and the taxable income and wealth (7.910). From
// the return's lines (`form`), so also in 2026, whose taxes wait for the communal coefficients. In
// whole francs. The return has no federal part: the tax office derives the federal tax, so no value
// of it is typed. Pure: the copy panel (@taxpresso/filing-ge, buildCopyPanel) places them on the form
// map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  weakestStatus,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus } from '@taxpresso/ledger';
import type { Line } from '@taxpresso/rules-ch';
import type { FrTaxResult, Item } from '@taxpresso/rules-fr';

/** How the Fribourg return heads its columns and its persons (fr-2025-guide-instructions-generales). */
export const FR_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: {
      label: 'Revenu',
      gloss: {
        en: 'income column (the tax office derives the federal tax from it)',
        fr: 'colonne du revenu (l’administration en tire l’impôt fédéral)',
      },
    },
    wealth: {
      label: 'Fortune',
      gloss: {
        en: 'wealth column, value on 31 December',
        fr: 'colonne de la fortune, au 31 décembre',
      },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Personne 1', gloss: { en: 'person 1', fr: 'personne 1' } },
    B: { label: 'Personne 2', gloss: { en: 'person 2', fr: 'personne 2' } },
    children: { label: 'Enfants', gloss: { en: 'children', fr: 'enfants' } },
  },
};

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

/** One value, in its column. */
function one(code: string, person: Item['person'], line: Line, column: FormColumn): FormItem {
  return {
    code,
    person,
    column,
    amount: Math.abs(line.amount),
    status: statusOf(line),
    source: sourceOf(line),
  };
}

/** Several lines added up into one value, in its column. */
function sum(
  code: string,
  person: Item['person'],
  lines: readonly Line[],
  column: FormColumn,
): FormItem {
  return {
    code,
    person,
    column,
    amount: Math.abs(lines.reduce((s, l) => s + l.amount, 0)),
    status: weakestStatus(lines.map(statusOf)),
    source: { rule: [...new Set(lines.flatMap((l) => l.sources))].join('; ') },
  };
}

/** Every value Fribourg's engine gives for its return, as form items. */
export function fribourgFormItems(r: FrTaxResult): FormItem[] {
  const f = r.icc ?? r.form;
  if (!f) return [];
  const out: FormItem[] = [];
  const R: FormColumn = 'icc';
  const W: FormColumn = 'wealth';

  // Annex 01 and annex 02: their totals, which carry to 3.210 and 4.210.
  const titles = f.items.filter((i) => i.code === '3.210');
  const titlesValue = f.wealth.items.filter((i) => i.code === '3.210');
  if (titles.length) out.push(sum('A01-R', 'household', titles, R));
  if (titlesValue.length) out.push(sum('A01-F', 'household', titlesValue, W));
  const interest = f.items.filter((i) => i.code === '4.210');
  const debts = f.wealth.items.filter((i) => i.code === '4.210');
  if (interest.length) out.push(sum('A02-I', 'household', interest, R));
  if (debts.length) out.push(sum('A02-D', 'household', debts, W));

  // The lines of the return, income and deductions, each person's on their part.
  for (const i of f.items) out.push(one(i.code, i.person, i, R));
  out.push(one('4.910', 'household', f.netIncome, R), one('6.910', 'household', f.socialIncome, R));
  out.push(one('7.910', 'household', f.taxableIncome, R));

  // The wealth column, only when there is wealth to declare.
  if (f.wealth.grossWealth.amount > 0) {
    for (const i of f.wealth.items) out.push(one(i.code, i.person, i, W));
    out.push(
      one('6.910', 'household', f.wealth.netWealth, W),
      one('7.910', 'household', f.wealth.taxableWealth, W),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Fribourg return (the final check's titles). */
const LINE_OF_KEY: Record<string, string> = {
  'salary.base': '1.110',
  'salary.gross': '1.110',
  'salary.net': '1.110',
  'salary.social_contributions': '1.110',
  'salary.lpp_ordinary': '1.110',
  'salary.lpp_buyin': '1.110',
  'pillar3a.paid': '4.130',
  'lpp.buyin': '4.140',
  'replacement.amount': '1.510',
  'pension.amount': '3.110',
  'health.premiums': '4.110',
  'health.subsidy': '4.110',
  'debt.interest': '4.210',
  'debt.balance': '4.210',
  'childcare.costs': '4.380',
  'medical.costs': '5.110',
  'donation.amount': '5.120',
};

export function fribourgLineOf(key: string): string | undefined {
  return LINE_OF_KEY[key];
}
