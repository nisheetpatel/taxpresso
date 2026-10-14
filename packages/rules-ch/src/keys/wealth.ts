// Movable wealth the user tells Taxpresso about without a document (or before it arrives): bank
// and postal accounts, crypto, loans to others, life insurance (pillar 3b), cash and valuables,
// private debts. One instance per item, a stable id the user or Claude chooses ("ubs-savings").
// Values from documents use the document keys instead (./wealth-documents.ts).
// The same in every canton: each canton puts them on its own form. The terms and their sources
// below are those of the first canton, Geneva (its état des titres: packages/rules-ge,
// 2026/etat-des-titres.ts).
//
// Where each kind goes on the Geneva form (ge-2025-declaration-specimen, 2025 form, the latest
// published; ge-2025-guide-declaration-pp for the rules):
//   bank_account    état des titres, comptes bancaires et postaux (F2, p. 22; guide p. 40)
//   crypto          état des titres; the guide says "sous Compte bancaire ou postal" (guide p. 40),
//                   the F3 heading lists crypto-monnaies too (see docs/sources/ge/NOTES.md)
//   loan_given      état des titres, titres suisses et étrangers: créances (F3, p. 23)
//   life_insurance  valeur de rachat 16.70 and primes 52.11 (C3, p. 13; guide p. 26 and 28)
//   valuables       16.40 numéraires, métaux précieux, autos, bateaux (C2, p. 12; guide p. 27)
//   debt            55.10 intérêts et dettes chirographaires (E1, p. 19; guide p. 37)
import type { KeyDef, KeyRegistry } from '@taxpresso/ledger';

/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;
const SPECIMEN = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';

export const WEALTH_KINDS = [
  'bank_account',
  'crypto',
  'loan_given',
  'life_insurance',
  'valuables',
  'debt',
] as const;
export type WealthKind = (typeof WEALTH_KINDS)[number];

/** Whose a line is: civilité A, B, A and B (joint), E (children) (guide p. 41). */
export const OWNERS = ['p1', 'p2', 'joint', 'children'] as const;
export type LineOwner = (typeof OWNERS)[number];

const item = { perPerson: false, multiple: true } as const;
const money = (label: KeyDef['label'], official: string, source: string): KeyDef => ({
  ...item,
  type: 'money',
  min: 0,
  max: MAX,
  label,
  official,
  source,
});

export const KEYS_WEALTH_2026 = {
  'wealth.kind': {
    ...item,
    type: 'enum',
    values: WEALTH_KINDS,
    label: { en: 'What it is', fr: 'De quoi il s’agit' },
    official: 'état des titres, autres éléments de fortune, assurances-vie, dettes',
    source: `${SPECIMEN} p. 12, 13, 19, 21 to 23`,
  },
  'wealth.name': {
    ...item,
    type: 'string',
    label: {
      en: 'Bank, insurer, creditor or description',
      fr: 'Établissement, assureur, créancier ou nature',
    },
    official: 'nom de l’établissement, nature',
    source: `${GUIDE} p. 37, 40`,
  },
  'wealth.owner': {
    ...item,
    type: 'enum',
    values: OWNERS,
    label: { en: 'Whose it is', fr: 'À qui il appartient' },
    official: 'civilité (A, B, E)',
    source: `${GUIDE} p. 37, 41`,
  },
  /** Account balance, value or surrender value on 31 December, or the debt owed, in CHF. */
  'wealth.value_chf': money(
    { en: 'Value on 31 December, in CHF', fr: 'Valeur au 31 décembre, en CHF' },
    'solde au 31.12, valeur imposable, valeur de rachat, dette',
    `${GUIDE} p. 26, 27, 37, 40`,
  ),
  /** Gross interest or other income of the year, in CHF. */
  'wealth.income_chf': money(
    { en: 'Gross interest or income of the year', fr: 'Intérêts ou rendement bruts de l’année' },
    'intérêts bruts, rendement brut',
    `${GUIDE} p. 40, 41`,
  ),
  'wealth.withholding_swiss_chf': money(
    { en: 'Swiss withholding tax deducted', fr: 'Impôt anticipé retenu' },
    'impôt anticipé (IA)',
    `${GUIDE} p. 39, 40`,
  ),
  'wealth.fees_chf': money(
    { en: 'Deductible account fees', fr: 'Frais bancaires déductibles' },
    'frais bancaires',
    `${GUIDE} p. 40`,
  ),
  'wealth.premiums_chf': money(
    { en: 'Life insurance premiums paid', fr: 'Primes d’assurance-vie payées' },
    'primes (assurance-vie, 52.11)',
    `${GUIDE} p. 28; ${SPECIMEN} p. 13`,
  ),
  'wealth.interest_paid_chf': money(
    { en: 'Interest paid on the debt', fr: 'Intérêts payés sur la dette' },
    'intérêts des dettes chirographaires (55.10)',
    `${GUIDE} p. 37; ${SPECIMEN} p. 19`,
  ),
  /** The account is held abroad, or the borrower lives abroad: no Swiss withholding tax. */
  'wealth.abroad': {
    ...item,
    type: 'boolean',
    label: { en: 'Held abroad', fr: 'Détenu à l’étranger' },
    official: 'comptes déposés à l’étranger',
    source: `${GUIDE} p. 40`,
  },
} as const satisfies KeyRegistry;

export type WealthKey = keyof typeof KEYS_WEALTH_2026;
