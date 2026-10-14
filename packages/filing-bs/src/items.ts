// The values to type on the Basel-Stadt return, from Basel-Stadt's engine (@taxpresso/rules-bs):
// every line it computes, in both columns where the form has two (Kanton, Bund), a value the two
// taxes share being one value for both, as you type it once into each; the lines of the auxiliary
// forms that make up the main form's lines (form W's totals, form B's lines, form K's calculation,
// form Z's and F's totals), the income calculation and the wealth page. Pure: the copy panel
// (@taxpresso/filing-ge, buildCopyPanel) places them on the form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus } from '@taxpresso/ledger';
import { DEDUCTIONS, INCOME, type BsTaxResult, type Item, type Line } from '@taxpresso/rules-bs';
import type { LimitApplied } from '@taxpresso/rules-ch';

/** How the Basel-Stadt return heads its columns (bs-2025-form-hauptformular p. 2 to 4). */
export const BS_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: { label: 'Kanton', gloss: { en: 'cantonal tax', fr: 'impôt cantonal' } },
    ifd: { label: 'Bund', gloss: { en: 'federal tax', fr: 'impôt fédéral' } },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'tax value on 31 December', fr: 'valeur fiscale au 31 décembre' },
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

/** One value: in the given column, or in the line's only (or both income) columns. */
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
 * line only one tax has (500 and 765, Kanton; 516 and 632, Bund) stays in its column.
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

const cells = (items: readonly Item[], code?: (i: Item) => string) =>
  items.map((i) => ({ code: code?.(i) ?? i.code, person: i.person, amount: i.amount, line: i }));

/** The annex lines of the items, with their item's status (form B, form W). */
const partCells = (items: readonly Item[]) =>
  items.flatMap((i) =>
    (i.parts ?? []).map((p) => ({ code: p.code, person: i.person, amount: p.amount, line: i })),
  );

/** A total of the household as a cell, when the line is there. */
const total = (code: string, l: Line | undefined): Cell | undefined =>
  l && { code, person: 'household', amount: l.amount, line: l };

/** The line of a code in a column's items, as a cell under another key (the annexes' totals). */
function at(items: readonly Item[], code: string, as: string): Cell | undefined {
  const i = items.find((x) => x.code === code);
  return i && { code: as, person: 'household', amount: i.amount, line: i };
}

/** A limit a rule applied, in one tax (or both), as a cell of the line it explains. */
function limitCell(
  limits: readonly LimitApplied[],
  rule: string,
  kind: LimitApplied['kind'],
  tax: 'icc' | 'ifd',
  as: string,
  value: (l: LimitApplied) => number,
  line: Line | undefined,
): Cell | undefined {
  const l = limits.find(
    (x) => x.rule === rule && x.kind === kind && (x.tax === tax || x.tax === 'both'),
  );
  return l && line && { code: as, person: 'household', amount: value(l), line };
}

/** Every value Basel-Stadt's engine gives for the return, as form items. */
export function baselFormItems(r: BsTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const ifd = r.ifd;
  const fed = ifd?.items ?? [];
  const out: FormItem[] = [];
  const incomeLines = icc.items.filter((i) => INCOME.has(i.code));
  const deductions = (items: readonly Item[]) => items.filter((i) => !INCOME.has(i.code));

  // Form W, page 4: the income from the accounts and securities (lines 1, 6 and 10, both
  // columns) and their value (lines 11, 14 and 16).
  const yieldLine = incomeLines.find((i) => i.code === '369');
  for (const c of partCells(yieldLine ? [yieldLine] : [])) out.push(one(c));
  if (yieldLine) out.push(one({ ...cells([yieldLine])[0]!, code: 'W-10' }));
  const securities = icc.wealth.items.find((i) => i.code === '800');
  for (const c of partCells(securities ? [securities] : [])) out.push(one(c, 'wealth'));

  // Form B, each person: the lines of each column, and the total carried to 519/539.
  const professional = (items: readonly Item[]) =>
    items.filter((i) => i.code === '519' || i.code === '539');
  out.push(...paired(partCells(professional(icc.items)), partCells(professional(fed))));
  out.push(
    ...paired(
      cells(professional(icc.items), (i) => `B-${i.code}`),
      cells(professional(fed), (i) => `B-${i.code}`),
    ),
  );

  // Form K: the net income it starts from, the costs, the share you bear and what is deducted.
  const medical = (tax: 'icc' | 'ifd') => (tax === 'icc' ? icc.items : fed);
  const kLine = (tax: 'icc' | 'ifd') =>
    tax === 'icc' ? icc.netIncome : (ifd?.subtotal709 ?? undefined);
  const hasMedical = r.limits.some((l) => l.rule === 'medical');
  if (hasMedical) {
    out.push(
      ...columns(total('K-709', icc.netIncome), total('K-709', ifd?.subtotal709)),
      ...columns(
        limitCell(r.limits, 'medical', 'threshold', 'icc', 'K-720', (l) => l.given, kLine('icc')),
        limitCell(r.limits, 'medical', 'threshold', 'ifd', 'K-720', (l) => l.given, kLine('ifd')),
      ),
      ...columns(
        limitCell(r.limits, 'medical', 'threshold', 'icc', 'K-722', (l) => l.limit, kLine('icc')),
        limitCell(r.limits, 'medical', 'threshold', 'ifd', 'K-722', (l) => l.limit, kLine('ifd')),
      ),
      ...columns(at(medical('icc'), '725', 'K-725'), at(medical('ifd'), '725', 'K-725')),
    );
  }

  // Form Z: party payments (680) and donations (732), what was given and what is deducted.
  out.push(...columns(at(icc.items, '680', 'Z-parteien'), at(fed, '680', 'Z-parteien')));
  const gifts = r.limits.find((l) => l.rule === 'donations' && l.kind === 'minimum');
  if (gifts) {
    const deducted = icc.items.find((i) => i.code === '732');
    out.push(
      one({
        code: 'Z-zuwendungen',
        person: 'household',
        amount: gifts.given,
        line: deducted ?? icc.netIncome,
      }),
      ...columns(at(icc.items, '732', 'Z-732'), at(fed, '732', 'Z-732')),
    );
  }

  // Form F: the childcare deducted (670), each child at most the limit of each tax.
  out.push(...columns(at(icc.items, '670', 'F-670'), at(fed, '670', 'F-670')));

  // Page 2: the income lines, one column (369 in both, the same).
  for (const c of cells(incomeLines)) out.push(one(c));
  const s299 = incomeLines.filter((i) => i.code !== '369' && i.code !== '479');
  if (s299.length) {
    const amount = s299.reduce((s, i) => s + i.amount, 0);
    out.push(one({ code: '299', person: 'household', amount, line: icc.grossIncome }));
  }
  out.push(...columns(total('499', icc.grossIncome), total('499', ifd?.grossIncome)));

  // Page 3: the deductions, in both columns, then the income calculation.
  out.push(...paired(cells(deductions(icc.items)), cells(deductions(fed))));
  const cantonal699 = icc.items
    .filter((i) => DEDUCTIONS.has(i.code))
    .reduce((s, i) => s + i.amount, 0);
  const ded699 = (code: string): Cell => ({
    code,
    person: 'household',
    amount: cantonal699,
    line: icc.netIncome,
  });
  out.push(
    ...columns(ded699('699'), total('699', ifd?.totalDeductions)),
    ...columns(total('700', icc.grossIncome), total('700', ifd?.grossIncome)),
    ...columns(ded699('701'), total('701', ifd?.totalDeductions)),
    ...columns(total('709', icc.netIncome), total('709', ifd?.subtotal709)),
    ...columns(total('739', icc.pureIncome), total('739', ifd?.netIncome)),
    ...columns(total('799', icc.taxableIncome), total('799', ifd?.taxableIncome)),
  );

  // Page 4, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const c of cells(icc.wealth.items)) out.push(one(c, 'wealth'));
    const w = (code: string, l: Line): FormItem => one(total(code, l)!, 'wealth');
    out.push(
      w('869', icc.wealth.grossWealth),
      w('889', icc.wealth.netWealth),
      w('899', icc.wealth.taxableWealth),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Basel-Stadt return, for this person (the final check). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '105'],
  'salary.gross': ['100', '105'],
  'salary.net': ['100', '105'],
  'salary.social_contributions': ['100', '105'],
  'salary.lpp_ordinary': ['100', '105'],
  'salary.lpp_buyin': ['100', '105'],
  'pillar3a.paid': ['620', '625'],
  'lpp.buyin': ['610', '615'],
  'replacement.amount': ['260', '265'],
  'debt.interest': '550',
  'debt.balance': '870',
  'childcare.costs': '670',
  'medical.costs': '725',
  'donation.amount': '732',
  'bs.child_care': '670',
  'bs.party': '680',
};

export function baselLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
