// The values to type on Ticino's forms, from Ticino's engine (@taxpresso/rules-ti): every line its
// cantonal result (`icc`) gives, in the return's one column. Modulo 4 first: each person's lines
// (`icc.professional`, with Modulo 4's field numbers) and their total (438 for the taxpayer, 488
// for the spouse), the same value on the form and, carried, on page 3's 9.1 and 9.2. Modulo 6: the
// premiums and savings interest paid (A), the most that can be deducted (B) and the deduction (3.),
// which goes to 12; the childcare paid for each child and the deduction, which goes to 20; the
// illness costs and the threshold, which go to 22.1 a and b (`icc.medical`). Modulo 5: the private
// debts (33.1) and the interest paid (13.2), the donations (24) and the payments to parties
// (15.2). Then page 2's income and its total 8, page 3's deductions and the subtotals 16 to 28,
// and page 4's wealth with 32, 34 and 36, only when there is wealth or a debt to declare. Amounts
// as positive amounts, as the form takes them, totals with their sign. The federal tax (`ifd`) is
// typed nowhere: the return has no federal column, the authority derives it
// (ti-2025-guide-istruzioni-pf-pdf p. 47).
//
// What the forms ask before a rule applies (what was paid, the maximum) comes from the limits the
// engine applied (`limits`, the final check's). Pure: it computes nothing but Modulo 4's total of
// each person, the sum of that person's lines as the form adds them up (7., "Totale delle spese
// professionali"). The copy panel (@taxpresso/filing-ge, buildCopyPanel) places the values on the
// form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  weakestStatus,
  type CopyLabels,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus, Owner } from '@taxpresso/ledger';
import type { LimitApplied, Line } from '@taxpresso/rules-ch';
import { ASSETS, DEBTS, INCOME, type Item, type TiTaxResult } from '@taxpresso/rules-ti';
import { TI_FORM_KEYS, TI_MODULO4_TOTAL } from './form-map.js';

/**
 * How Ticino's forms head their one column and name the people: page 2 "Redditi 2025", Modulo 4
 * and page 3 "Deduzioni 2025", page 4 "Valore fiscale al 31 dicembre 2025" (ti-2025-form-modulo-1-de
 * p. 2 to 4: "Einkünfte 2025", "Abzüge 2025", "Steuerwert am 31. Dezember 2025"; ti-2025-form-modulo-4
 * p. 1: "Deduzioni 2025"), without the year: the labels serve 2025 and 2026. The taxpayer
 * (contribuente) and the spouse or registered partner (coniuge/partner registrato), as Modulo 4
 * names them (ti-2025-form-modulo-4 p. 1 and 2).
 */
export const TI_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc_ifd: {
      label: 'Redditi',
      gloss: {
        en: 'income, one column for the cantonal, communal and federal tax',
        fr: 'revenus, une seule colonne pour l’impôt cantonal, communal et fédéral',
      },
    },
    amount: {
      label: 'Deduzioni',
      gloss: {
        en: 'deductions, one column for the cantonal, communal and federal tax',
        fr: 'déductions, une seule colonne pour l’impôt cantonal, communal et fédéral',
      },
    },
    wealth: {
      label: 'Valore fiscale al 31 dicembre',
      gloss: { en: 'tax value on 31 December', fr: 'valeur fiscale au 31 décembre' },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Contribuente', gloss: { en: 'taxpayer', fr: 'contribuable' } },
    B: { label: 'Coniuge/partner registrato', gloss: { en: 'spouse', fr: 'conjoint' } },
    children: { label: 'Figli', gloss: { en: 'children', fr: 'enfants' } },
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

/** A sum of lines, as one item: Modulo 4's total of a person, the deduction of several children. */
function sumOf(code: string, person: Owner, lines: readonly Line[]): FormItem {
  const facts = [...new Set(lines.flatMap((l) => l.facts ?? []))];
  return {
    code,
    person,
    amount: lines.reduce((s, l) => s + Math.abs(l.amount), 0),
    status: weakestStatus(lines.map(statusOf)),
    source: {
      ...(facts.length ? { facts } : {}),
      rule: [...new Set(lines.flatMap((l) => l.sources))].join('; '),
    },
  };
}

/** An amount a rule started from or stopped at (what was paid, the maximum), from its limit. */
function fromLimit(
  code: string,
  person: Owner,
  l: LimitApplied,
  amount: number,
  like: Line,
  instance?: string,
): FormItem {
  return {
    code,
    person,
    ...(instance ? { instance } : {}),
    amount,
    status: statusOf(like),
    source: { ...(like.facts?.length ? { facts: like.facts } : {}), rule: l.source },
  };
}

/** Every value Ticino's engine gives for the return, as form items, in the form's order. */
export function ticinoFormItems(r: TiTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const out: FormItem[] = [];
  const K = TI_FORM_KEYS;
  const item = (code: string) => icc.items.find((i) => i.code === code);
  const cantonal = (rule: string) => r.limits.filter((l) => l.rule === rule && l.tax !== 'ifd');

  // Modulo 4, the taxpayer then the spouse: each line, and the total that page 3 carries to 9.1 and
  // 9.2.
  for (const person of ['p1', 'p2'] as const) {
    const lines = icc.professional.filter((i) => i.person === person);
    if (!lines.length) continue;
    for (const i of lines) out.push(one(i.code, i.person, i));
    out.push(sumOf(TI_MODULO4_TOTAL[person], person, lines));
  }

  // Modulo 6: premiums (A), the maximum (B) and the deduction (3.), which goes to 12.
  const ins = item('12');
  const insLimit = cantonal('insurance')[0];
  if (ins && insLimit) {
    out.push(
      fromLimit(K.premiums, 'household', insLimit, insLimit.given, ins),
      fromLimit(K.premiumsMax, 'household', insLimit, insLimit.limit, ins),
      one(K.premiumsAllowed, 'household', ins),
    );
  }
  // The childcare paid for each child, and the deduction, which goes to 20.
  const care = item('20');
  if (care) {
    for (const l of cantonal('childcare')) {
      out.push(fromLimit(K.childcarePaid, 'household', l, l.given, care, String(l.person)));
    }
    out.push(one(K.childcareTotal, 'household', care));
  }
  // The illness costs and the threshold, which go to 22.1 a and b.
  if (icc.medical) {
    out.push(
      one(K.medicalCosts, 'household', icc.medical.costs),
      one(K.medicalThreshold, 'household', icc.medical.threshold),
    );
  }

  // Modulo 5: the private debts (33.1) and the interest paid (13.2), the donations (24) and the
  // payments to parties (15.2).
  const debts = icc.wealth.items.find((i) => i.code === '33.1');
  if (debts) out.push(one(K.debts, 'household', debts, true));
  const interest = item('13.2');
  const interestLimit = cantonal('debt_interest')[0];
  if (interest && interestLimit) {
    out.push(fromLimit(K.interest, 'household', interestLimit, interestLimit.given, interest));
  }
  const gifts = item('24');
  if (gifts) out.push(one(K.donations, 'household', gifts));
  const parties = item('15.2');
  if (parties) out.push(one(K.parties, 'household', parties));

  // Page 2: the income, and its total 8.
  for (const i of icc.items) if (INCOME.has(i.code)) out.push(one(i.code, i.person, i));
  out.push(total('8', icc.grossIncome));

  // Page 3: the deductions 9 to 15.5, their total 16, and the computation of the taxable income.
  const page3 = (codes: readonly string[]) => {
    for (const i of icc.items) if (codes.includes(i.code)) out.push(one(i.code, i.person, i));
  };
  page3([
    '9.1',
    '9.2',
    '10.3',
    '11.1',
    '11.2',
    '12',
    '13.1',
    '13.2',
    '14.1',
    '14.2',
    '15.2',
    '15.3',
    '15.4',
    '15.5',
  ]);
  out.push(
    total('16', { ...icc.totalDeductions, amount: Math.abs(icc.totalDeductions.amount) }),
    total('17', icc.grossIncome),
    total('18', { ...icc.totalDeductions, amount: Math.abs(icc.totalDeductions.amount) }),
    total('19', icc.netIncome),
  );
  page3(['20']);
  out.push(total('21', icc.netIncome2));
  if (icc.medical) {
    out.push(
      one('22.1a', 'household', icc.medical.costs),
      one('22.1b', 'household', icc.medical.threshold),
    );
  }
  page3(['22.1']);
  out.push(total('23', icc.netIncome3));
  page3(['24', '25.1']);
  out.push(total('26', icc.netIncome4));
  page3(['27']);
  out.push(total('28', icc.taxableIncome));

  // Page 4, only when there is wealth or a debt to declare.
  const w = icc.wealth;
  if (w.items.some((i: Item) => ASSETS.has(i.code) || DEBTS.has(i.code))) {
    for (const i of w.items) out.push(one(i.code, i.person, i, true));
    out.push(
      total('32', w.grossWealth, true),
      total('34', w.netWealth, true),
      total('36', w.taxableWealth, true),
    );
  }
  return out;
}

/** The line a ledger value goes to on the return, for this person (the final check's titles). */
const LINE_OF_KEY: Record<string, string | readonly [string, string]> = {
  'salary.base': '1.1',
  'salary.gross': '1.1',
  'salary.net': '1.1',
  'salary.social_contributions': '1.1',
  'salary.lpp_ordinary': '1.1',
  'salary.lpp_buyin': '10.3',
  'pillar3a.paid': ['11.1', '11.2'],
  'lpp.buyin': '10.3',
  'replacement.amount': '3.5',
  'pension.amount': '3.1',
  'health.premiums': '12',
  'debt.interest': '13.2',
  'debt.balance': '33.1',
  'childcare.costs': '20',
  'medical.costs': '22.1',
  'donation.amount': '24',
};

export function ticinoLineOf(key: string, person: string): string | undefined {
  const to = LINE_OF_KEY[key];
  if (to === undefined) return undefined;
  return typeof to === 'string' ? to : person === 'p2' ? to[1] : to[0];
}
