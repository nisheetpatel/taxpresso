// The values to type on the Basel-Landschaft return, from Basel-Landschaft's engine
// (@taxpresso/rules-bl): every line it computes, the income in its one column, the subtotal 399
// carried to both columns, the deductions in both columns of page 3 (Staatssteuer, Bundessteuer),
// the taxable income, and the wealth page. A value the two taxes share is one value for both
// columns, as you type it once into each. Pure: the copy panel (@taxpresso/filing-ge,
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
import { INCOME, type BlTaxResult, type Item } from '@taxpresso/rules-bl';

/** How the Basel-Landschaft return heads its columns (bl-2026-steuererklaerung-form p. 2 to 4). */
export const BL_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: { label: 'Staatssteuer', gloss: { en: 'state tax', fr: 'impôt cantonal' } },
    ifd: { label: 'Bundessteuer', gloss: { en: 'federal tax', fr: 'impôt fédéral' } },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'value on 31 December', fr: 'valeur au 31 décembre' },
    },
    amount: {
      label: 'CHF ohne Rappen',
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

const sourceOf = (l: Line) => ({
  ...(l.facts?.length ? { facts: l.facts } : {}),
  rule: l.sources.join('; '),
});

type Cell = { code: string; person: Item['person']; amount: number; line: Line };

/** One value: in the given column, or in the line's only column (income, wealth). */
function one(c: Cell, column?: FormColumn): FormItem {
  return {
    code: c.code,
    person: c.person,
    ...(column ? { column } : {}),
    amount: Math.abs(c.amount),
    status: statusOf(c.line),
    source: sourceOf(c.line),
  };
}

/**
 * The two columns of a line: one value for both when they agree, else one value per column; a
 * line only one tax has (770 and 771 for the state tax, 750 and 775 for the federal tax) stays in
 * its column.
 */
function columns(icc: Cell | undefined, ifd: Cell | undefined): FormItem[] {
  if (icc && ifd && Math.abs(icc.amount) === Math.abs(ifd.amount)) {
    const both = one(icc);
    return [
      { ...both, status: statusOf(icc.line) === statusOf(ifd.line) ? both.status : 'estimate' },
    ];
  }
  return [...(icc ? [one(icc, 'icc')] : []), ...(ifd ? [one(ifd, 'ifd')] : [])];
}

const key = (c: { code: string; person: string }) => `${c.code}|${c.person}`;

/** Lines in the order first seen, each with its two columns. */
function paired(icc: readonly Cell[], ifd: readonly Cell[]): FormItem[] {
  const order: string[] = [];
  const by = new Map<string, { icc?: Cell; ifd?: Cell }>();
  const put = (c: Cell, tax: 'icc' | 'ifd') => {
    const k = key(c);
    if (!by.has(k)) {
      by.set(k, {});
      order.push(k);
    }
    by.get(k)![tax] = c;
  };
  for (const c of icc) put(c, 'icc');
  for (const c of ifd) put(c, 'ifd');
  return order.flatMap((k) => columns(by.get(k)!.icc, by.get(k)!.ifd));
}

const cells = (items: readonly Item[]): Cell[] =>
  items.map((i) => ({ code: i.code, person: i.person, amount: i.amount, line: i }));

const household = (code: string, line: Line): Cell => ({
  code,
  person: 'household',
  amount: line.amount,
  line,
});

/** Every value Basel-Landschaft's engine gives for the return, as form items. */
export function baselLandFormItems(r: BlTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const ifd = r.ifd;
  const out: FormItem[] = [];
  // Income: one column on page 2; its subtotal 399 (no property: the total) carried to both.
  const income = icc.items.filter((i) => INCOME.has(i.code));
  for (const c of cells(income)) out.push(one(c));
  out.push(one(household('399', icc.grossIncome)));
  out.push(one(household('399-uebertrag', icc.grossIncome)));
  out.push(
    ...columns(
      household('499', icc.grossIncome),
      ifd ? household('499', ifd.grossIncome) : undefined,
    ),
  );

  // Deductions, in both columns.
  const deductions = (items: readonly Item[]) => items.filter((i) => !INCOME.has(i.code));
  out.push(...paired(cells(deductions(icc.items)), cells(deductions(ifd?.items ?? []))));
  out.push(
    ...columns(
      household('789', icc.totalDeductions),
      ifd ? household('789', ifd.totalDeductions) : undefined,
    ),
    ...columns(
      household('790', icc.taxableIncome),
      ifd ? household('790', ifd.taxableIncome) : undefined,
    ),
  );

  // The wealth page, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const c of cells(icc.wealth.items)) out.push(one(c, 'wealth'));
    out.push(
      one(household('885', icc.wealth.grossWealth), 'wealth'),
      one(household('899', icc.wealth.netWealth), 'wealth'),
      one(household('910', icc.wealth.taxableWealth), 'wealth'),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Basel-Landschaft return, for this person (final check). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '105'],
  'salary.gross': ['100', '105'],
  'salary.net': ['100', '105'],
  'salary.social_contributions': ['100', '105'],
  'salary.lpp_ordinary': ['100', '105'],
  'salary.lpp_buyin': ['100', '105'],
  'pillar3a.paid': ['610', '615'],
  'lpp.buyin': ['600', '605'],
  'replacement.amount': ['260', '270'],
  'debt.interest': '555',
  'debt.balance': '891',
  'childcare.costs': '640',
  'medical.costs': '720',
  'donation.amount': '738',
};

export function baselLandLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
