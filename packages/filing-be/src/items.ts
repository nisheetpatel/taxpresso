// The values to type on the Bern return, from Bern's engine (@taxpresso/rules-be), and the values
// to check on TaxMe's two summaries:
// - on the forms (F1 to F6), what you declare on each line: TaxMe's "Ihre Angaben", the amount
//   before any cap or threshold (Item.given, else the amount), the same for both taxes, in whole
//   francs; a person's line in their column (p1 Mann, p2 Frau); a flat amount TaxMe works out from
//   a tick (6.5, form 1.2's own household) as the tick;
// - on ZK and ZB, TaxMe's "Steuerbar" column: the cantonal and the federal amount of each line and
//   the totals, as the summaries print them (be-2025-steuererklaerung-formulare-de p. 9 to 11:
//   deductions without their sign, the costs of the securities taken off the income with theirs).
// Wealth only when there is some to declare. Pure, and it computes nothing: every amount is the
// engine's. The copy panel (@taxpresso/filing-ge, buildCopyPanel) places them on the form map
// (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus } from '@taxpresso/ledger';
import { ASSETS, DEBTS, INCOME, type BeTaxResult, type Item, type Line } from '@taxpresso/rules-be';

/**
 * How the Bern return heads its columns: a column per person, "Mann" and "Frau" (forms 1, 2 and 6,
 * be-2025-steuererklaerung-formulare-de p. 1, 2 and 6), "Betrag" (p. 4 and 5), the tax value on 31
 * December (p. 3 and 4), and TaxMe's summaries' "Steuerbar" (p. 9 to 11).
 */
export const BE_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: {
      label: 'Steuerbar',
      gloss: {
        en: 'taxable, cantonal and communal tax (TaxMe’s summary)',
        fr: 'imposable, impôts cantonal et communal (récapitulatif TaxMe)',
      },
    },
    ifd: {
      label: 'Steuerbar',
      gloss: {
        en: 'taxable, federal tax (TaxMe’s summary)',
        fr: 'imposable, impôt fédéral direct (récapitulatif TaxMe)',
      },
    },
    wealth: {
      label: 'Steuerwert am 31.12.',
      gloss: { en: 'tax value on 31 December', fr: 'valeur fiscale au 31 décembre' },
    },
    amount: {
      label: 'Betrag',
      gloss: { en: 'amount, in whole francs', fr: 'montant, en francs entiers' },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Mann', gloss: { en: 'person 1', fr: 'personne 1' } },
    B: { label: 'Frau', gloss: { en: 'person 2', fr: 'personne 2' } },
    children: { label: 'Kinder', gloss: { en: 'children', fr: 'enfants' } },
  },
};

/**
 * Deductions TaxMe works out on its own and the forms have no line for ("vom System automatisch
 * berücksichtigt"): on the summaries only.
 */
const SUMMARY_ONLY = new Set<string>([
  'allgemein',
  'verheiratet',
  'zweiverdiener',
  '2.1-kinder',
  'bescheiden',
  'vermoegen-verheiratet',
  'vermoegen-kinder',
]);

/** A flat amount TaxMe works out from a tick on the form: the tick is what you enter. */
const TICKED = new Set<string>(['6.5', 'alleinstehend']);

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

const onWealth = (code: string) => ASSETS.has(code) || DEBTS.has(code);

/** What you declare on the form for a line (TaxMe's "Ihre Angaben"). */
function declared(i: Item): FormItem {
  const common = {
    code: i.code,
    person: i.person,
    status: statusOf(i),
    source: sourceOf(i),
  };
  if (TICKED.has(i.code)) return { ...common, column: 'amount', tick: true };
  return {
    ...common,
    column: onWealth(i.code) ? 'wealth' : 'amount',
    amount: Math.abs(i.given ?? i.amount),
  };
}

/**
 * A line of a summary, in its "Steuerbar" column: the income lines with their sign (the costs of
 * the securities are printed negative), the others as the positive amount printed.
 */
function taxable(code: string, person: Item['person'], l: Line, column: FormColumn): FormItem {
  return {
    code,
    person,
    column,
    amount: INCOME.has(code) ? l.amount : Math.abs(l.amount),
    status: statusOf(l),
    source: sourceOf(l),
  };
}

/** Every value Bern's engine gives for the return, as form items. */
export function bernFormItems(r: BeTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const ifd = r.ifd;
  const wealthItems = icc.wealth.items;
  const hasWealth = wealthItems.some((i) => onWealth(i.code));
  const out: FormItem[] = [];

  // The forms: each line as declared, once for both taxes. A line only the federal tax counts
  // (its threshold or minimum met there only) is still declared.
  const key = (i: Item) => `${i.code}|${i.person}`;
  const cantonal = new Set(icc.items.map(key));
  const lines = [...icc.items, ...(ifd?.items ?? []).filter((i) => !cantonal.has(key(i)))];
  for (const i of lines) if (!SUMMARY_ONLY.has(i.code)) out.push(declared(i));
  if (hasWealth) {
    for (const i of wealthItems) if (!SUMMARY_ONLY.has(i.code)) out.push(declared(i));
  }

  // TaxMe's summary of the cantonal and communal tax (ZK).
  for (const i of icc.items) out.push(taxable(i.code, i.person, i, 'icc'));
  const zk = (code: string, l: Line) => taxable(code, 'household', l, 'icc');
  out.push(
    zk('total-einkuenfte', icc.grossIncome),
    zk('total-aufwendungen', icc.totalDeductions),
    zk('reineinkommen', icc.netIncome),
    zk('total-sozialabzuege', icc.personalDeductions),
    zk('steuerbares-einkommen', icc.taxableIncome),
  );
  if (hasWealth) {
    for (const i of wealthItems) out.push(taxable(i.code, i.person, i, 'icc'));
    out.push(
      zk('total-vermoegen', icc.wealth.grossWealth),
      zk('steuerbares-vermoegen', icc.wealth.taxableWealth),
    );
  }

  // TaxMe's summary of the federal tax (ZB), when the federal tax is computed.
  if (ifd) {
    for (const i of ifd.items) out.push(taxable(i.code, i.person, i, 'ifd'));
    const zb = (code: string, l: Line) => taxable(code, 'household', l, 'ifd');
    out.push(
      zb('total-einkuenfte', ifd.grossIncome),
      zb('total-aufwendungen', ifd.totalDeductions),
      zb('reineinkommen', ifd.netIncome),
      zb('total-sozialabzuege', ifd.personalDeductions),
      zb('steuerbares-einkommen', ifd.taxableIncome),
    );
  }
  return out;
}

/**
 * The line a ledger value goes to on the Bern return (the final check), by the engine's code: the
 * same for both persons, each in their column. A pension or a benefit goes to a line of 2.22 or 2.23
 * by its kind, which this key alone doesn't say: the section's number, as printed.
 */
const LINE_OF_KEY: Record<string, string> = {
  'salary.base': '2.21-haupt',
  'salary.gross': '2.21-haupt',
  'salary.net': '2.21-haupt',
  'salary.social_contributions': '2.21-haupt',
  'salary.lpp_ordinary': '2.21-haupt',
  'salary.lpp_buyin': '2.21-haupt',
  'pillar3a.paid': 'saeule-3a',
  'lpp.buyin': 'einkauf-bv',
  'health.premiums': '4.2',
  'health.subsidy': '4.2',
  'debt.interest': '4.3',
  'debt.balance': '4.3-schulden',
  'childcare.costs': '2.1-betreuung',
  'medical.costs': '5.4',
  'donation.amount': '5.3',
  'replacement.amount': '2.23',
  'pension.amount': '2.22',
  'be.party': '4.4',
  'be.child_education': '2.1-ausbildung',
};

/** The line of a ledger value, for this person: on the Bern form, the same code for both. */
export const bernLineOf: (key: string, person: string) => string | undefined = (key) =>
  LINE_OF_KEY[key];
