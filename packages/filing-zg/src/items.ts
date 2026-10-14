// The values to type on Zug's form K, from Zug's engine (@taxpresso/rules-zg): every line it
// computes, the income in both columns (one amount for both, as the sample return shows), the
// deductions in both columns (Kanton, Bund), the totals 190 to 490, and the wealth page. A value the
// two taxes share is one value for both columns, as you type it once into each. Pure: the copy panel
// (@taxpresso/filing-ge, buildCopyPanel) places them on the form map (./form-map.ts).
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
import { DEBTS, INCOME, type Item, type ZgTaxResult } from '@taxpresso/rules-zg';

/** How form K heads its columns (zg-2025-guide-wegleitung p. 17 to 19). */
export const ZG_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: { label: 'Kanton', gloss: { en: 'cantonal tax', fr: 'impôt cantonal' } },
    ifd: { label: 'Bund', gloss: { en: 'federal tax', fr: 'impôt fédéral' } },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'value on 31 December', fr: 'valeur au 31 décembre' },
    },
    amount: { label: 'Betrag', gloss: { en: 'amount', fr: 'montant' } },
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

/** One value: in the given column, or in the line's columns (both, or its only one). */
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
 * line only one tax has (400, 402, 403a, 404, 406, 407 for the cantonal tax, 401 for the federal
 * tax) stays in its column.
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

/** Every value Zug's engine gives for form K, as form items. */
export function zugFormItems(r: ZgTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const ifd = r.ifd;
  const out: FormItem[] = [];
  // Income: the same amount in both columns of page 2, and its total 190.
  const income = icc.items.filter((i) => INCOME.has(i.code));
  for (const c of cells(income)) out.push(one(c));
  out.push(one(household('190', icc.grossIncome)));

  // Deductions, in both columns, then the totals of page 3.
  const deductions = (items: readonly Item[]) => items.filter((i) => !INCOME.has(i.code));
  const totals = (code: string, a: Line, b: Line | undefined) =>
    columns(household(code, a), b ? household(code, b) : undefined);
  const ordered = [
    ...paired(cells(deductions(icc.items)), cells(deductions(ifd?.items ?? []))),
    ...totals('280', icc.totalDeductions, ifd?.totalDeductions),
    one(household('285', icc.grossIncome)),
    ...totals('286', icc.totalDeductions, ifd?.totalDeductions),
    ...totals('287', icc.subtotal, ifd?.subtotal),
    ...totals('299', icc.netIncome, ifd?.netIncome),
    ...totals('490', icc.taxableIncome, ifd?.taxableIncome),
  ];
  out.push(...ordered);

  // The wealth page, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const c of cells(icc.wealth.items)) out.push(one(c, 'wealth'));
    const debts = icc.wealth.items.filter((i) => DEBTS.has(i.code));
    const debtsTotal = debts.reduce((s, i) => s + i.amount, 0);
    out.push(
      one(household('630', icc.wealth.grossWealth), 'wealth'),
      ...(debts.length
        ? [
            {
              code: '650',
              person: 'household' as const,
              column: 'wealth' as const,
              amount: Math.abs(debtsTotal),
              status: weakestStatus(debts.map(statusOf)),
              source: { rule: debts.flatMap((d) => d.sources).join('; ') },
            },
          ]
        : []),
      one(household('660', icc.wealth.netWealth), 'wealth'),
      one(household('690', icc.wealth.taxableWealth), 'wealth'),
    );
  }
  return out;
}

/** The line a ledger value goes to on form K, for this person (the final check's titles). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '101'],
  'salary.gross': ['100', '101'],
  'salary.net': ['100', '101'],
  'salary.social_contributions': ['100', '101'],
  'salary.lpp_ordinary': ['100', '101'],
  'salary.lpp_buyin': ['100', '101'],
  'pillar3a.paid': ['220', '221'],
  'lpp.buyin': ['250', '251'],
  'replacement.amount': ['145', '146'],
  'health.premiums': '230',
  'debt.interest': '205',
  'debt.balance': '640',
  'childcare.costs': '253',
  'medical.costs': '295',
  'donation.amount': '296',
};

export function zugLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
