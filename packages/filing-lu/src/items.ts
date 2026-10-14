// The values to type on the Lucerne return, from Lucerne's engine (@taxpresso/rules-lu): every line
// it computes, in the return's one column ("CHF ohne Rappen"), deductions as positive amounts after
// the printed minus; form B's lines and their total per person (238, 239), carried to page 3; the
// securities list's two summary lines and their difference, Ziffer 150; the totals of pages 2 and 3
// (199, 299, 301, 302, 310, 330, 380, and 250, the training of both persons); the wealth page, only
// when there is wealth to declare; and the Ergänzungsblatt's lines and totals in the federal column,
// to check. In whole francs. Pure: the copy panel (@taxpresso/filing-ge, buildCopyPanel) places them
// on the form map (./form-map.ts).
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
import { INCOME, PERSON_CODES, type Item, type LuTaxResult } from '@taxpresso/rules-lu';

/** How the Lucerne forms head their columns (lu-2025-guide-wegleitung p. 15 to 19). */
export const LU_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: {
      label: 'CHF ohne Rappen',
      gloss: {
        en: 'the return’s column (cantonal, communal and federal tax)',
        fr: 'la colonne de la déclaration (impôts cantonal, communal et fédéral)',
      },
    },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'value on 31 December', fr: 'valeur au 31 décembre' },
    },
    ifd: {
      label: 'Direkte Bundessteuer',
      gloss: {
        en: 'federal tax, the Ergänzungsblatt: to check',
        fr: 'impôt fédéral, l’Ergänzungsblatt : à vérifier',
      },
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

/** Several lines added up into one value (a total the form carries), in its column. */
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

/** Form B's lines of each person (form B: 208t to 237). */
const FORM_B: readonly (readonly [string, string])[] = [
  PERSON_CODES.commute,
  PERSON_CODES.meals,
  PERSON_CODES.mealsReduced,
  PERSON_CODES.otherCosts,
  PERSON_CODES.sideCosts,
];
const FORM_B_CODES = new Set(FORM_B.flat());
const SECURITIES = new Set(['WV4', 'WV6']);
/** The totals of form B, per person, as page 3 takes them. */
const FORM_B_TOTAL = { p1: '238', p2: '239' } as const;

/** Every value Lucerne's engine gives for its return, as form items. */
export function lucerneFormItems(r: LuTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const out: FormItem[] = [];
  const R: FormColumn = 'icc';

  // Form B: each person's lines, then their total (238, 239), which page 3 takes too.
  const formB = icc.items.filter((i) => FORM_B_CODES.has(i.code));
  for (const i of formB) out.push(one(i.code, i.person, i, R));
  for (const id of ['p1', 'p2'] as const) {
    const mine = formB.filter((i) => i.person === id);
    if (mine.length) out.push(sum(FORM_B_TOTAL[id], id, mine, R));
  }

  // The securities list's summary, and its difference on page 2 (150).
  const wv = icc.items.filter((i) => SECURITIES.has(i.code));
  for (const i of wv) out.push(one(i.code, i.person, i, R));
  if (wv.length) out.push(sum('150', 'household', wv, R));

  // Page 2: the income lines and their total.
  const income = icc.items.filter((i) => INCOME.has(i.code) && !SECURITIES.has(i.code));
  for (const i of income) out.push(one(i.code, i.person, i, R));
  out.push(one('199', 'household', icc.grossIncome, R));

  // Page 3: the deductions (form B's as its totals, above), the training of both persons (250),
  // and the totals down to the taxable income.
  const deductions = icc.items.filter((i) => !INCOME.has(i.code) && !FORM_B_CODES.has(i.code));
  const training = deductions.filter((i) =>
    (PERSON_CODES.training as readonly string[]).includes(i.code),
  );
  for (const i of deductions) {
    out.push(one(i.code, i.person, i, R));
    if (i === training.at(-1)) out.push(sum('250', 'household', training, R));
  }
  out.push(
    one('299', 'household', icc.totalDeductions, R),
    one('301', 'household', icc.grossIncome, R),
    one('302', 'household', icc.totalDeductions, R),
    one('310', 'household', icc.incomeAfterDeductions, R),
    one('330', 'household', icc.netIncome, R),
    one('380', 'household', icc.taxableIncome, R),
  );

  // Page 4, only when there is wealth to declare.
  if (icc.wealth.grossWealth.amount > 0) {
    for (const i of icc.wealth.items) out.push(one(i.code, i.person, i, 'wealth'));
    out.push(
      one('450', 'household', icc.wealth.grossWealth, 'wealth'),
      one('470', 'household', icc.wealth.netWealth, 'wealth'),
      one('480', 'household', icc.wealth.taxableWealth, 'wealth'),
    );
  }

  // The Ergänzungsblatt Direkte Bundessteuer, to check.
  const ifd = r.ifd;
  if (ifd) {
    for (const i of ifd.items) out.push(one(i.code, i.person, i, 'ifd'));
    out.push(
      one('E7', 'household', ifd.subtotal, 'ifd'),
      one('E12', 'household', ifd.incomeAfterDeductions, 'ifd'),
      one('E19', 'household', ifd.netIncome, 'ifd'),
      one('E23', 'household', ifd.taxableIncome, 'ifd'),
    );
  }
  return out;
}

/** The line a ledger value goes to on the Lucerne return, for this person (the final check's titles). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': ['100', '101'],
  'salary.gross': ['100', '101'],
  'salary.net': ['100', '101'],
  'salary.social_contributions': ['100', '101'],
  'salary.lpp_ordinary': ['100', '101'],
  'salary.lpp_buyin': ['100', '101'],
  'pillar3a.paid': ['260', '261'],
  'lpp.buyin': ['280', '282'],
  'replacement.amount': ['140', '141'],
  'pension.amount': ['130', '131'],
  'health.premiums': '270',
  'health.subsidy': '270',
  'debt.interest': '252',
  'debt.balance': '462',
  'childcare.costs': '360',
  'medical.costs': '320',
  'donation.amount': '324',
};

export function lucerneLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
