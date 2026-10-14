// The values to type on the Vaud return, from Vaud's engine (@taxpresso/rules-vd), and the values
// to check on the guide's worksheet for the federal tax:
// - on the form's pages 2 and 3, each line of the cantonal result in the return's income column
//   ("Revenu", 'icc'), a taxpayer's line in their box (p1 Contribuable 1, p2 Contribuable 2), the
//   household's in the line's one box; deductions as positive amounts, after the "-" the form
//   prints (vd-2025-form-21010 p. 2); wealth in the "Fortune" column, debts without their sign,
//   only when there is wealth to declare; the totals the engine gives (650, 690, 700 and 800, and
//   800's taxable wealth), the parts (810) and the rate-determining income (820), to check. The
//   engine gives no subtotal per taxpayer (230, 398 to 400), no 730 and no net wealth (700): those
//   lines stay without a value;
// - what the form asks next to a line, as declared (VdIccResult.declared): the yearly net rent in
//   the box before 660, the childcare paid ("Montant effectif") before 670, 30 % of the household
//   contents' fire insurance value before 440, and on page 4 (item 10) the premiums before the
//   subsidies and the subsidies;
// - the totals the annexes and page 4 carry to a code, where the engine's amount is the annex's
//   total: 410 (annex 01), the debts of 610 and 435 (annex 02), 140, 150 and 160 per taxpayer
//   (annex 04), 710, 620 and 720 (annex 05), 280 and 630 (page 4). Not 610's interest nor 618:
//   the annexes carry what you paid, the engine gives the deduction after its cap;
// - on the IFD page, the federal result on the worksheet's lines (vd-2025-guide p. 65), each
//   amount as written next to its printed sign, the persons' amounts of a line added up by the copy
//   panel (the worksheet has one column), and its three printed totals.
// In whole francs. Pure, and it computes nothing: every amount is the engine's. The copy panel
// (@taxpresso/filing-ge, buildCopyPanel) places them on the form map (./form-map.ts).
import {
  COLUMN_LABELS,
  PART_LABELS,
  type CopyLabels,
  type FormColumn,
  type FormItem,
} from '@taxpresso/filing-ge';
import type { FactStatus, Owner } from '@taxpresso/ledger';
import type { Line, VdTaxResult } from '@taxpresso/rules-vd';

/**
 * How the Vaud return heads its columns: a box per taxpayer, "Contribuable 1" and "Contribuable 2"
 * (form page 2), "Revenu" and "Fortune au 31.12.2025" (form page 3, vd-2025-form-21010 p. 2), the
 * annexes' and page 4's amounts and their wealth column, and the federal worksheet's one column
 * (vd-2025-guide p. 65, headed by the year).
 */
export const VD_COPY_LABELS: CopyLabels = {
  columns: {
    ...COLUMN_LABELS,
    icc: {
      label: 'Revenu',
      gloss: {
        en: 'income column of the return (cantonal and communal tax)',
        fr: 'colonne du revenu de la déclaration (impôt cantonal et communal)',
      },
    },
    wealth: {
      label: 'Fortune au 31.12.',
      gloss: { en: 'wealth on 31 December', fr: 'fortune au 31 décembre' },
    },
    ifd: {
      label: 'Impôt fédéral direct',
      gloss: {
        en: 'federal tax, the guide’s worksheet: to check',
        fr: 'impôt fédéral direct, feuille de calcul du guide : à vérifier',
      },
    },
    amount: {
      label: 'Montant',
      gloss: { en: 'amount, in whole francs', fr: 'montant, en francs entiers' },
    },
    value: {
      label: 'Au 31.12.',
      gloss: {
        en: 'value or debt on 31 December (the annex’s wealth column)',
        fr: 'valeur ou dette au 31 décembre (colonne de fortune de l’annexe)',
      },
    },
  },
  parts: {
    ...PART_LABELS,
    A: { label: 'Contribuable 1', gloss: { en: 'taxpayer 1', fr: 'contribuable 1' } },
    B: { label: 'Contribuable 2', gloss: { en: 'taxpayer 2', fr: 'contribuable 2' } },
    children: { label: 'Enfants', gloss: { en: 'children', fr: 'enfants' } },
  },
};

/**
 * The annexes' and page 4's totals that carry the engine's amount to a code: the income lines'
 * (in 'amount') and the wealth lines' (in 'value').
 */
const ANNEX_INCOME = new Set(['410', '140', '150', '160', '620', '710', '720', '280', '630']);
const ANNEX_WEALTH = new Set(['410', '435', '610']);

/** Where the parts are printed (810): a digit, a comma, two digits (form page 3). */
const PARTS_SOURCE = 'vd-2025-form-21010 p. 2 (form page 3); vd-2025-guide p. 51';

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

/** A line as written on the form: a deduction or a debt without its sign (the "-" is printed). */
function written(code: string, person: Owner, l: Line, column: FormColumn): FormItem {
  return {
    code,
    person,
    column,
    amount: Math.abs(l.amount),
    status: statusOf(l),
    source: sourceOf(l),
  };
}

/** A total the form adds up, with its sign, for the household. */
function total(code: string, l: Line, column: FormColumn): FormItem {
  return {
    code,
    person: 'household',
    column,
    amount: l.amount,
    status: statusOf(l),
    source: sourceOf(l),
  };
}

/** The parts in hundredths (280) as the form's boxes take them: "2,80". */
const partsOnForm = (parts: number) =>
  `${Math.trunc(parts / 100)},${String(parts % 100).padStart(2, '0')}`;

/** Every value Vaud's engine gives for the return, as form items. */
export function vaudFormItems(r: VdTaxResult): FormItem[] {
  const icc = r.icc;
  if (!icc) return [];
  const wealthItems = icc.wealth.items;
  const hasWealth = wealthItems.length > 0;
  const out: FormItem[] = [];

  // Form pages 2 and 3: each line, in its box; then the annexes' totals that carry it.
  for (const i of icc.items) out.push(written(i.code, i.person, i, 'icc'));
  if (hasWealth) for (const i of wealthItems) out.push(written(i.code, i.person, i, 'wealth'));
  out.push(
    total('650', icc.netIncome, 'icc'),
    total('690', icc.incomeBeforeModest, 'icc'),
    total('700', icc.intermediateIncome, 'icc'),
    total('800', icc.taxableIncome, 'icc'),
    {
      code: '810',
      person: 'household',
      column: 'icc',
      text: partsOnForm(icc.parts),
      status: 'computed',
      source: { rule: PARTS_SOURCE },
    },
    total('820', icc.rateIncome, 'icc'),
  );
  if (hasWealth) out.push(total('800', icc.wealth.taxableWealth, 'wealth'));

  // The boxes next to a line and page 4's item 10, as declared.
  const d = icc.declared;
  const box = (key: string, l: Line | undefined) => {
    if (l) out.push(written(key, 'household', l, 'amount'));
  };
  box('660-loyer', d.rent);
  box('670-effectif', d.childcarePaid);
  box('440-assurance', d.contentsShare);
  box('p4-primes', d.premiums);
  box('p4-subsides', d.subsidy);

  for (const i of icc.items) {
    if (ANNEX_INCOME.has(i.code)) out.push(written(i.code, i.person, i, 'amount'));
  }
  if (hasWealth) {
    for (const i of wealthItems) {
      if (ANNEX_WEALTH.has(i.code)) out.push(written(i.code, i.person, i, 'value'));
    }
  }

  // The federal worksheet, when the federal tax is computed.
  const ifd = r.ifd;
  if (ifd) {
    for (const i of ifd.items) out.push(written(i.code, i.person, i, 'ifd'));
    out.push(
      total('revenu-intermediaire-1', ifd.intermediateIncome1, 'ifd'),
      total('730', ifd.intermediateIncome2, 'ifd'),
      total('revenu-imposable', ifd.taxableIncome, 'ifd'),
    );
  }
  return out;
}

/**
 * The line a ledger value goes to on the Vaud return (the final check), by its code: the same for
 * both persons, each in their box. A benefit goes to 200 (unemployment) or 210 (the others, as the
 * engine reads them), a pension to 240, 250 or 270 by its kind, which the key alone doesn't say:
 * 210 for a benefit, 240 (the first line of "Rentes et pensions") for a pension. A debt's balance is
 * 610's wealth column, its interest 610's income column: the same code.
 */
const LINE_OF_KEY: Record<string, string> = {
  'salary.base': '100',
  'salary.gross': '100',
  'salary.net': '100',
  'salary.social_contributions': '100',
  'salary.lpp_ordinary': '100',
  'salary.lpp_buyin': '100',
  'pillar3a.paid': '310',
  'lpp.buyin': '320',
  'health.premiums': '300',
  'health.subsidy': '300',
  'debt.interest': '610',
  'debt.balance': '610',
  'childcare.costs': '670',
  'vd.child_care': '670',
  'medical.costs': '710',
  'donation.amount': '720',
  'replacement.amount': '210',
  'pension.amount': '240',
  'vd.rent': '660',
  'vd.contents_value': '440',
  'vd.savings_interest': '480',
};

/** The line of a ledger value, for this person: on the Vaud form, the same code for both. */
export const vaudLineOf: (key: string, person: string) => string | undefined = (key) =>
  LINE_OF_KEY[key];
