// The shape of an official Geneva declaration form (SPEC.md section 10): its pages in the official
// order, their sections, and every rubric with its code, its French label as printed, whose it is,
// what it is (income, deduction, wealth), the columns it fills and how its value is written.
// The rubrics themselves are data per tax year: ./2025/form-map.ts, ./2026/form-map.ts.
//
// This is the shared language between the tax engine and the filing side: the engine returns
// FormItems keyed by the same rubric code and person, and the copy panel (./copy-panel.ts) places
// them on the form.
import type { FactStatus, Owner } from '@taxpresso/ledger';

/** Pages of the declaration as printed: the main form (PG1 to PG4), then annexes A to G. */
export const FORM_PAGE_IDS = [
  'PG1',
  'PG2',
  'PG3',
  'PG4',
  'A1',
  'A2',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
  'D1',
  'D2',
  'D3',
  'D4',
  'E1',
  'E2',
  'F1',
  'F2',
  'F3',
  'F4',
  'G1',
  'G2',
] as const;
export type FormPageId = (typeof FORM_PAGE_IDS)[number];

/**
 * Whose rubric it is on the form. Contribuable A is the person printed on the left of the form
 * (ge-2025-guide-declaration-pp p. 5); in Taxpresso that is p1 unless the user says otherwise.
 */
export type FormPerson = 'A' | 'B' | 'household';

/** Amounts printed under a household rubric, one per person: "Contr. A", "Contr. B", "Enfant(s)". */
export type FormPart = 'A' | 'B' | 'children';

/**
 * The amount columns a rubric fills, as headed on the form.
 * icc_ifd: "1. et 2. Revenu" (ICC et IFD), one amount for both taxes.
 * icc: "1. Revenu" (ICC). ifd: "2. Revenu" (IFD). wealth: "3. Fortune" (ICC).
 * amount: a plain amount box ("Montant" in the Renseignements, or information from the salary
 * certificate that is not itself taxed).
 * The état des titres (annexe F) has its own five columns.
 */
export type FormColumn =
  | 'icc_ifd'
  | 'icc'
  | 'ifd'
  | 'wealth'
  | 'amount'
  | 'ia_subject'
  | 'ia_free'
  | 'value'
  | 'fees'
  | 'savings_interest';

/** income, deduction, wealth (or a wealth deduction), info (Renseignements: not taxed), identity. */
export type RubricNature = 'income' | 'deduction' | 'wealth' | 'info' | 'identity';

/**
 * input: you type it. total: the form adds up the lines above. report: carried from another page.
 * computed: worked out by a rule (flat deductions, limits); the official software computes it.
 */
export type RubricRole = 'input' | 'total' | 'report' | 'computed';

/**
 * money: whole francs, no centimes (ge-2025-guide-declaration-pp p. 9; ge-2025-declaration-specimen
 * p. 21: "tous les montants doivent être arrondis au franc (donc sans les centimes) sauf les
 * imputations"). money_cents: francs and centimes, for the imputations of annexe F.
 */
export type RubricFormat = 'money' | 'money_cents' | 'count' | 'percent' | 'date' | 'text' | 'tick';

export interface Gloss {
  en: string;
  fr: string;
  /** German, for a canton whose form is in German (Zurich): optional, English otherwise. */
  de?: string;
  /** Italian, for a canton whose form is in Italian (Ticino): optional, English otherwise. */
  it?: string;
}

/** A field written on each line of a repeating rubric (an employer's name, a creditor). */
export interface LineField {
  id: string;
  /** As printed on the form. */
  label: string;
  format: RubricFormat;
  /** How the form wants it written, when the form or the guide says so. */
  hint?: Gloss;
  source?: string;
}

/**
 * A rubric of a form. `Page` is the form's page ids: Geneva's by default; another canton's form
 * (packages/filing-zh) has its own.
 */
export interface FormRubric<Page extends string = FormPageId> {
  /** The rubric code when one is printed (key === code); otherwise a Taxpresso id, e.g. "CS-F". */
  key: string;
  /** The code as printed on the form, e.g. "11.10". Absent for lines the form doesn't number. */
  code?: string;
  page: Page;
  /** The page section it is printed under (FormSection.id). */
  section: string;
  person: FormPerson;
  /** The official French label, as printed (or as the guide names the rubric when the form has none). */
  label: string;
  /** What it is, in plain words, in the UI language. */
  gloss: Gloss;
  nature: RubricNature;
  role: RubricRole;
  format: RubricFormat;
  columns: readonly FormColumn[];
  /** Amounts printed per person under a household rubric. They are what you type; the column is the sum or the limited amount. */
  parts?: readonly FormPart[];
  /** Lines printed for a repeating rubric (11.10-1, 11.10-2); the online form takes more. */
  repeats?: number;
  lineFields?: readonly LineField[];
  /** The salary certificate box the form names ("code 1 du CS"). */
  csBox?: string;
  /** false: outside Taxpresso's scope for now (self-employment, property, inheritances). */
  supported: boolean;
  /** Manifest id plus page: where the code and label are printed and where the guide explains it. */
  source: string;
}

export interface FormSection {
  id: string;
  /** As printed, e.g. "Déductions liées aux revenus ci-dessus". */
  title: string;
  gloss: Gloss;
}

export interface FormPage<Page extends string = FormPageId> {
  id: Page;
  /** As printed, e.g. "Activité dépendante 2025". */
  title: string;
  gloss: Gloss;
  /** The page is for this person only (A1 for contribuable A). */
  person?: FormPerson;
  /** Page of the official specimen PDF. */
  pdfPage: number;
  supported: boolean;
  sections: readonly FormSection[];
  source: string;
}

export interface FormMap<Page extends string = FormPageId> {
  /** The tax year the declaration is for. */
  taxYear: number;
  /** The year of the official form the map was read from. */
  formYear: number;
  /** true while the map reuses an older form because the year's own is not published yet. */
  provisional: boolean;
  note?: Gloss;
  pages: readonly FormPage<Page>[];
  rubrics: readonly FormRubric<Page>[];
}

// ---------------------------------------------------------------------------------------------
// What the engine (or, until it lands, the ledger) gives for a rubric.

export interface ItemSource {
  /** Ledger facts the value comes from. */
  facts?: readonly string[];
  /** Vault documents the value was read from. */
  documents?: readonly string[];
  /** The rule that computed it (rules engine), with its citation. */
  rule?: string;
}

/**
 * One value for one rubric: the tax engine's output format.
 * - code: the rubric key (the official code, e.g. "31.40").
 * - person: p1 is contribuable A, p2 is B, a child goes in "Enfant(s)", household for the household.
 * - column: which column, when the rubric has several and the value is for one of them only.
 *   Without it, the value fills the rubric's income columns (or its only column).
 * - instance: one line of a repeating rubric (e.g. one salary certificate on 11.10).
 * Exactly one of amount (centimes), text or tick.
 */
export interface FormItem {
  code: string;
  person: Owner;
  column?: FormColumn;
  instance?: string;
  amount?: number;
  text?: string;
  tick?: boolean;
  /** Values for the line's fields (LineField.id), e.g. { employer: 'Exemple SA' }. */
  fields?: Readonly<Record<string, string>>;
  status: FactStatus;
  source?: ItemSource;
}

/** Values that are not final: they still need the user's OK, or they are estimates (SPEC.md 9). */
export function isFinal(status: FactStatus): boolean {
  return status !== 'extracted' && status !== 'estimate';
}

/** Of several statuses, the one that says most about what is still to do. */
export function weakestStatus(statuses: readonly FactStatus[]): FactStatus {
  const order: FactStatus[] = ['extracted', 'estimate', 'computed', 'stated', 'verified'];
  return order.find((s) => statuses.includes(s)) ?? 'stated';
}

/** Whole francs from centimes, rounded to the nearest franc (halves away from zero), no floats. */
export function roundToFranc(centimes: number): number {
  const abs = Math.abs(centimes);
  const francs = (abs - (abs % 100)) / 100 + (abs % 100 >= 50 ? 1 : 0);
  return centimes < 0 && francs !== 0 ? -francs : francs;
}

/**
 * The value as written on the official form: plain digits, no thousands separator.
 * Money in whole francs ("85000"), imputations with their centimes ("1234.55"),
 * dates as on Swiss forms ("31.12.2026"). Undefined when there is nothing to type (a tick box).
 */
export function formText(
  format: RubricFormat,
  value: { amount?: number; text?: string; tick?: boolean },
): string | undefined {
  switch (format) {
    case 'money':
      return value.amount === undefined ? undefined : String(roundToFranc(value.amount));
    case 'money_cents': {
      if (value.amount === undefined) return undefined;
      const abs = Math.abs(value.amount);
      const sign = value.amount < 0 ? '-' : '';
      return `${sign}${(abs - (abs % 100)) / 100}.${String(abs % 100).padStart(2, '0')}`;
    }
    case 'count':
    case 'percent':
      return value.amount !== undefined ? String(value.amount) : value.text?.trim();
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.text ?? '');
      return m ? `${m[3]}.${m[2]}.${m[1]}` : value.text?.trim();
    }
    case 'text':
      return value.text?.trim() || undefined;
    case 'tick':
      return undefined;
  }
}

/** "11.10", or "11.10-2" for the second line of a repeating rubric; the key for an uncoded line. */
export function rubricRef(rubric: FormRubric<string>, line?: number): string {
  const base = rubric.code ?? rubric.key;
  return line !== undefined && rubric.repeats ? `${base}-${line}` : base;
}
