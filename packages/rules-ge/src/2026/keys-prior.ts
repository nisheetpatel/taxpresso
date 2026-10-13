// Last year's figures, read from the prior-year declaration (SPEC.md section 5.4), kept to compare
// with this year: "your pillar 3a was CHF 7'000 last year". They are never this year's values and
// are never filed. One fact per printed line of the official form, the instance naming where it
// is: the form page and the rubric code ("PG2-11.00", "A1-31.40"), with ":2", ":3" for a code
// printed again on the same page (one line per employer). The person is the taxpayer the line
// belongs to: contribuable A is p1, B is p2; everything else is the household's.
//
// Rubric codes and their official terms: the Geneva guide for 2025, ge-2025-guide-declaration-pp
// (page in each `source`). Its p. 13 says the summary pages 2, 3 and 4 (récapitulation) carry the
// totals of annexes A to F. Re-check against the 2026 guide (January 2027).
import type { Fact, KeyDef, KeyRegistry, Owner } from '@taxpresso/ledger';

const GUIDE = 'ge-2025-guide-declaration-pp';
/** CHF 100 million in centimes, either sign: a sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

const amount = (perPerson: boolean, column: 'ICC' | 'IFD'): KeyDef => ({
  type: 'money',
  min: -MAX,
  max: MAX,
  perPerson,
  multiple: true,
  label:
    column === 'ICC'
      ? {
          en: 'Last year, cantonal and communal tax column',
          fr: 'L’an dernier, colonne impôt cantonal et communal',
        }
      : { en: 'Last year, federal tax column', fr: 'L’an dernier, colonne impôt fédéral direct' },
  official: column === 'ICC' ? 'ICC (impôt cantonal et communal)' : 'IFD (impôt fédéral direct)',
  source: `${GUIDE} p. 13`,
});

export const KEYS_PRIOR_2026 = {
  /** A line of one taxpayer (contribuable A = p1, B = p2), ICC column. */
  'prior.person.icc': amount(true, 'ICC'),
  'prior.person.ifd': amount(true, 'IFD'),
  /** A line for the household (both taxpayers together), ICC column. Wealth is ICC only. */
  'prior.household.icc': amount(false, 'ICC'),
  'prior.household.ifd': amount(false, 'IFD'),
} as const satisfies KeyRegistry;

export type PriorKey = keyof typeof KEYS_PRIOR_2026;

/** The form pages whose lines are kept: summary pages 2 to 4, and annex A of each taxpayer. */
export const PRIOR_FORMS = ['PG2', 'PG3', 'PG4', 'A1', 'A2'] as const;
export type PriorForm = (typeof PRIOR_FORMS)[number];

export interface PriorRef {
  form: PriorForm;
  /** Rubric code as printed, e.g. "31.40". */
  code: string;
  /** A lower-case letter printed after the code, e.g. "r" in "31.10 r" (replacement income). */
  suffix?: string;
  /** 1 for the first line with this code on this form, 2 for the second (another employer)... */
  occurrence: number;
}

const INSTANCE = /^(PG2|PG3|PG4|A1|A2)-(\d{2}\.\d{2})([a-z]?)(?::(\d{1,2}))?$/;

/** "A1-11.10:2" for the second 11.10 line of annex A1. */
export function priorInstance(ref: PriorRef): string {
  return `${ref.form}-${ref.code}${ref.suffix ?? ''}${ref.occurrence > 1 ? `:${ref.occurrence}` : ''}`;
}

export function parsePriorInstance(instance: string): PriorRef | undefined {
  const m = INSTANCE.exec(instance);
  if (!m) return undefined;
  return {
    form: m[1] as PriorForm,
    code: m[2]!,
    ...(m[3] ? { suffix: m[3] } : {}),
    occurrence: m[4] ? Number(m[4]) : 1,
  };
}

/** One printed line of last year's declaration, as the ledger has it. */
export interface PriorLine extends PriorRef {
  person: Owner;
  icc?: number;
  ifd?: number;
  page?: number;
  docId?: string;
  /** The weakest status of its values ("extracted": read by Taxpresso, not checked by the user). */
  status: Fact['status'];
}

/**
 * Last year's lines from facts (pass the facts of one declaration: the current view filtered to
 * that document). Ordered by form, code and occurrence. Amounts in centimes.
 */
export function priorLines(facts: readonly Fact[]): PriorLine[] {
  const lines = new Map<string, PriorLine>();
  for (const f of facts) {
    if (!(f.key in KEYS_PRIOR_2026) || !f.instance || typeof f.value !== 'number') continue;
    const ref = parsePriorInstance(f.instance);
    if (!ref) continue;
    const id = `${f.instance}|${f.person}`;
    const line = lines.get(id) ?? {
      ...ref,
      person: f.person,
      status: f.status,
      ...(f.source.page ? { page: f.source.page } : {}),
      ...(f.source.docId ? { docId: f.source.docId } : {}),
    };
    if (f.key.endsWith('.icc')) line.icc = f.value;
    else line.ifd = f.value;
    if (f.status === 'extracted') line.status = 'extracted';
    lines.set(id, line);
  }
  const order = (l: PriorLine) => PRIOR_FORMS.indexOf(l.form);
  return [...lines.values()].sort(
    (a, b) =>
      order(a) - order(b) ||
      a.code.localeCompare(b.code) ||
      (a.suffix ?? '').localeCompare(b.suffix ?? '') ||
      a.occurrence - b.occurrence ||
      a.person.localeCompare(b.person),
  );
}

export type PriorSection = 'income' | 'deductions' | 'wealth';

/** A main line shown in the "Last year" card and by get_last_year. */
export interface PriorMainLine {
  section: PriorSection;
  form: PriorForm;
  code: string;
  /** Contribuable A or B, or the household. */
  person: 'A' | 'B' | 'household';
  label: { en: string; fr: string };
  /** The official French term (the guide's), shown next to the gloss. */
  official: string;
  source: string;
}

const line = (
  section: PriorSection,
  form: PriorForm,
  code: string,
  person: PriorMainLine['person'],
  en: string,
  fr: string,
  official: string,
  page: number,
): PriorMainLine => ({
  section,
  form,
  code,
  person,
  label: { en, fr },
  official,
  source: `${GUIDE} p. ${page}`,
});

/** The main lines, in the form's order. A line shows only when last year's declaration has it. */
// prettier-ignore
export const PRIOR_MAIN_LINES_2026: readonly PriorMainLine[] = [
  // Page 2, income (revenus).
  line('income', 'PG2', '11.00', 'A', 'Salaries, gross', 'Salaires bruts', 'Activité dépendante (annexe A)', 19),
  line('income', 'PG2', '21.00', 'B', 'Salaries, gross', 'Salaires bruts', 'Activité dépendante (annexe A)', 19),
  line('income', 'PG2', '12.00', 'household', 'Self-employment', 'Activité indépendante', 'Activité indépendante (annexe B)', 23),
  line('income', 'PG2', '13.00', 'household', 'Pensions and annuities', 'Rentes et pensions', 'Rentes, pensions et autres prestations (annexe C1)', 25),
  line('income', 'PG2', '17.00', 'household', 'AVS and AI pensions', 'Rentes AVS et AI', 'Rentes AVS / AI', 25),
  line('income', 'PG2', '14.00', 'household', 'Income from accounts and securities', 'Revenus des comptes et des titres', 'État des titres (annexe F)', 38),
  line('income', 'PG2', '15.00', 'household', 'Real estate', 'Immeubles', 'Immeubles (annexe D)', 32),
  line('income', 'PG2', '16.00', 'household', 'Other income', 'Autres revenus', 'Autres revenus (annexe C2)', 26),
  line('income', 'PG2', '91.00', 'household', 'Total gross income', 'Revenu brut total', 'Revenus bruts totaux', 51),
  // Annex A and page 3, deductions (déductions).
  line('deductions', 'A1', '31.10', 'A', 'Social insurance contributions', 'Cotisations AVS, AI, APG, chômage', 'Cotisations AVS / AI / APG / Chômage / AANP / AMat', 18),
  line('deductions', 'A2', '41.10', 'B', 'Social insurance contributions', 'Cotisations AVS, AI, APG, chômage', 'Cotisations AVS / AI / APG / Chômage / AANP / AMat', 18),
  line('deductions', 'A1', '31.12', 'A', 'Pension fund contributions', 'Cotisations 2e pilier', 'Cotisations 2e pilier', 18),
  line('deductions', 'A2', '41.12', 'B', 'Pension fund contributions', 'Cotisations 2e pilier', 'Cotisations 2e pilier', 18),
  line('deductions', 'A1', '31.30', 'A', 'Pension fund buy-ins', 'Rachats 2e pilier', 'Rachats de la prévoyance professionnelle', 18),
  line('deductions', 'A2', '41.30', 'B', 'Pension fund buy-ins', 'Rachats 2e pilier', 'Rachats de la prévoyance professionnelle', 18),
  line('deductions', 'A1', '31.40', 'A', 'Pillar 3a', '3e pilier A', 'Cotisations 3e pilier A', 18),
  line('deductions', 'A2', '41.40', 'B', 'Pillar 3a', '3e pilier A', 'Cotisations 3e pilier A', 18),
  line('deductions', 'PG3', '31.00', 'A', 'All salary deductions', 'Total des déductions sur le salaire', 'Déductions de l’activité dépendante (annexe A)', 19),
  line('deductions', 'PG3', '41.00', 'B', 'All salary deductions', 'Total des déductions sur le salaire', 'Déductions de l’activité dépendante (annexe A)', 19),
  line('deductions', 'PG3', '52.00', 'household', 'Insurance premiums', 'Primes d’assurances', 'Primes d’assurances (annexe C3)', 29),
  line('deductions', 'PG3', '53.00', 'household', 'Alimony paid', 'Pensions alimentaires versées', 'Pensions, contributions d’entretien versées', 29),
  line('deductions', 'PG3', '55.00', 'household', 'Interest on debts', 'Intérêts de dettes', 'Intérêts de dettes privées (annexe E)', 37),
  line('deductions', 'PG3', '59.00', 'household', 'Other deductions (childcare and more)', 'Autres déductions (frais de garde, etc.)', 'Autres déductions (annexe C4)', 28),
  line('deductions', 'PG3', '71.00', 'household', 'Medical costs', 'Frais médicaux', 'Frais médicaux', 14),
  line('deductions', 'PG3', '73.10', 'household', 'Donations', 'Dons', 'Dons ICC', 15),
  line('deductions', 'PG3', '73.20', 'household', 'Donations', 'Dons', 'Dons IFD', 15),
  line('deductions', 'PG3', '74.00', 'household', 'Political party contributions', 'Versements aux partis politiques', 'Versements aux partis politiques', 15),
  // Page 4, wealth (fortune): cantonal tax only.
  line('wealth', 'PG4', '14.00', 'household', 'Accounts and securities', 'Comptes et titres', 'État des titres (annexe F)', 38),
  line('wealth', 'PG4', '15.00', 'household', 'Real estate', 'Immeubles', 'Immeubles (annexe D)', 32),
  line('wealth', 'PG4', '16.00', 'household', 'Other assets', 'Autres éléments de fortune', 'Autres éléments de fortune (annexe C2)', 27),
  line('wealth', 'PG4', '91.00', 'household', 'Total gross wealth', 'Fortune brute totale', 'Fortune brute', 16),
  line('wealth', 'PG4', '55.00', 'household', 'Debts', 'Dettes', 'Dettes chirographaires et hypothécaires (annexe E)', 37),
  line('wealth', 'PG4', '99.00', 'household', 'Taxable wealth', 'Fortune imposable', 'Fortune imposable', 52),
];
