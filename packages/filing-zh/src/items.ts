// The values to type on the Zurich return, from Zurich's engine (@taxpresso/rules-zh): every line
// it computes, in both columns of the deductions page (Staatssteuer, Bundessteuer), the lines of
// the Berufsauslagen and Versicherungsprämien forms that make up 220, 240 and 270, the income
// calculation and the wealth page. A value the two taxes share is one value for both columns, as
// you type it once into each. Pure: the copy panel (@taxpresso/filing-ge, buildCopyPanel) places
// them on the form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus } from '@taxpresso/ledger';
import type { Line } from '@taxpresso/rules-ch';
import { INCOME, VERSICHERUNG, type Item, type ZhTaxResult } from '@taxpresso/rules-zh';

/** How the Zurich return heads its columns (zh-2025-form-steuererklaerung-hauptformular p. 2 to 4). */
export const ZH_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: { label: 'Staatssteuer', gloss: { en: 'cantonal tax', fr: 'impôt cantonal' } },
    ifd: { label: 'Bundessteuer', gloss: { en: 'federal tax', fr: 'impôt fédéral' } },
    wealth: {
      label: 'Steuerwert',
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

/** Part A of the Versicherungsprämien form: one column, the same for both taxes. */
const PAID = new Set<string>([
  VERSICHERUNG.health,
  VERSICHERUNG.accident,
  VERSICHERUNG.life,
  VERSICHERUNG.savings,
  VERSICHERUNG.subtotal,
  VERSICHERUNG.subsidy,
  VERSICHERUNG.paid,
]);

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

/** One value: in the given column, or in the line's only column (income, part A, wealth). */
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
 * line only one tax has (365, federal) stays in its column.
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

const cells = (items: readonly Item[]) =>
  items.map((i) => ({ code: i.code, person: i.person, amount: i.amount, line: i }));

/** The annex lines of the items (Berufsauslagen, Versicherungsprämien), with their item's status. */
const partCells = (items: readonly Item[]) =>
  items.flatMap((i) =>
    (i.parts ?? []).map((p) => ({ code: p.code, person: i.person, amount: p.amount, line: i })),
  );

/** Every value Zurich's engine gives for the return, as form items. */
export function zurichFormItems(r: ZhTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const ifd = r.ifd;
  const out: FormItem[] = [];
  const income = icc.items.filter((i) => INCOME.has(i.code));
  // Income: one column on page 2, for both taxes.
  for (const c of cells(income)) out.push(one(c));
  out.push(
    one({
      code: '199',
      person: 'household',
      amount: icc.grossIncome.amount,
      line: icc.grossIncome,
    }),
  );

  // Deductions, in both columns.
  const deductions = (items: readonly Item[]) => items.filter((i) => !INCOME.has(i.code));
  out.push(...paired(cells(deductions(icc.items)), cells(deductions(ifd?.items ?? []))));

  // The annex lines: part A of the insurance form once, the rest in both columns.
  const iccParts = partCells(icc.items);
  const ifdParts = partCells(ifd?.items ?? []);
  const paid = iccParts.length ? iccParts : ifdParts;
  for (const c of paid.filter((p) => PAID.has(p.code))) out.push(one(c));
  out.push(
    ...paired(
      iccParts.filter((p) => !PAID.has(p.code)),
      ifdParts.filter((p) => !PAID.has(p.code)),
    ),
  );

  // The income calculation (299 to 398).
  const total = (code: string, a: Line | undefined, b: Line | undefined) =>
    columns(
      a && { code, person: 'household', amount: a.amount, line: a },
      b && { code, person: 'household', amount: b.amount, line: b },
    );
  out.push(
    ...total('299', icc.totalDeductions, ifd?.totalDeductions),
    ...total('310', icc.subtotal310, ifd?.subtotal310),
    ...total('350', icc.netIncome, ifd?.netIncome),
    ...total('390', icc.taxableIncome, ifd?.taxableIncome),
    // Nothing taxable in another canton or abroad (not supported): 398 is 390.
    ...total('398', icc.taxableIncome, ifd?.taxableIncome),
  );

  // The wealth page, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const c of cells(icc.wealth.items)) out.push(one(c, 'wealth'));
    const w = (code: string, l: Line): FormItem => ({
      code,
      person: 'household',
      column: 'wealth',
      amount: Math.abs(l.amount),
      status: statusOf(l),
      source: sourceOf(l),
    });
    out.push(
      w('460', icc.wealth.grossWealth),
      w('490', icc.wealth.taxableWealth),
      w('498', icc.wealth.taxableWealth),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Zurich return, for this person (the final check). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '101'],
  'salary.gross': ['100', '101'],
  'salary.net': ['100', '101'],
  'salary.social_contributions': ['100', '101'],
  'salary.lpp_ordinary': ['100', '101'],
  'salary.lpp_buyin': ['100', '101'],
  'pillar3a.paid': ['260', '261'],
  'lpp.buyin': '280',
  'health.premiums': VERSICHERUNG.health,
  'health.subsidy': VERSICHERUNG.subsidy,
  'debt.interest': '250',
  'debt.balance': '470',
  'childcare.costs': '376',
  'medical.costs': '320',
  'donation.amount': '324',
};

export function zurichLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
