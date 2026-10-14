// Keys for what a bank's e-tax statement (relevé fiscal électronique, eCH-0196) gives, read from its
// barcode (SPEC.md section 5.2): bank accounts and liabilities, one instance per account (the IBAN,
// or the account number), and whether a security's tax value comes from the ESTV price list. The
// securities themselves use ./securities.ts (instance = ISIN). Household values: whose each
// account is (civilité A, B or E on the form) is not in the statement.
//
// Official terms, Geneva guide for 2025 (the latest published), ge-2025-guide-declaration-pp:
//   p. 37  dettes chirographaires et hypothécaires; intérêts de dettes privées
//   p. 38  the état des titres has three parts: comptes, titres, relevés fiscaux; it is the form to
//          reclaim the impôt anticipé (IA)
//   p. 40  comptes bancaires et postaux: numéro de compte (the last 8 positions of the IBAN), nom
//          de l'établissement, compte ouvert ou fermé, intérêts bruts soumis / non soumis à
//          l'impôt anticipé (rounded to the franc), solde du compte au 31.12 (in CHF at the
//          official rate)
//   p. 41  valeur imposable: the official year-end price (liste des cours, ICTax)
// Re-check against the 2026 guide when it is published (January 2027). Never add these accounts
// and the statement totals (statement.* in document-keys.ts): they are the same money.
import type { KeyRegistry } from '@taxpresso/ledger';

const GE_GUIDE = 'ge-2025-guide-declaration-pp';
const account = { perPerson: false, multiple: true } as const;

export const KEYS_ECH0196_2026 = {
  'accounts.number': {
    ...account,
    type: 'string',
    label: {
      en: 'Account number (last 8 of the IBAN)',
      fr: 'Numéro de compte (8 derniers de l’IBAN)',
    },
    official: 'Numéro de compte',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.bank': {
    ...account,
    type: 'string',
    label: { en: 'Bank', fr: 'Établissement' },
    official: 'Nom de l’établissement',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.name': {
    ...account,
    type: 'string',
    label: { en: 'Account', fr: 'Intitulé du compte' },
  },
  'accounts.currency': {
    ...account,
    type: 'string',
    label: { en: 'Currency', fr: 'Monnaie' },
  },
  'accounts.opened': {
    ...account,
    type: 'date',
    label: { en: 'Opened on', fr: 'Ouvert le' },
    official: 'Compte ouvert ou fermé',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.closed': {
    ...account,
    type: 'date',
    label: { en: 'Closed on', fr: 'Fermé le' },
    official: 'Compte ouvert ou fermé',
    source: `${GE_GUIDE} p. 40`,
  },
  /** The balance in the account's currency, a decimal string. */
  'accounts.balance_original': {
    ...account,
    type: 'string',
    label: {
      en: 'Balance on 31 December, in its currency',
      fr: 'Solde au 31 décembre, dans sa monnaie',
    },
  },
  'accounts.value_chf': {
    ...account,
    type: 'money',
    label: { en: 'Balance on 31 December, in CHF', fr: 'Solde au 31 décembre, en CHF' },
    official: 'Solde du compte au 31.12',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.income_a_chf': {
    ...account,
    type: 'money',
    label: {
      en: 'Gross interest with Swiss withholding tax',
      fr: 'Intérêts bruts soumis à l’impôt anticipé',
    },
    official: 'Intérêts bruts soumis à l’impôt anticipé',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.income_b_chf': {
    ...account,
    type: 'money',
    label: {
      en: 'Gross interest without Swiss withholding tax',
      fr: 'Intérêts bruts non soumis à l’impôt anticipé',
    },
    official: 'Intérêts bruts non soumis à l’impôt anticipé',
    source: `${GE_GUIDE} p. 40`,
  },
  'accounts.withholding_swiss_chf': {
    ...account,
    type: 'money',
    label: { en: 'Swiss withholding tax', fr: 'Impôt anticipé' },
    official: 'impôt anticipé (IA)',
    source: `${GE_GUIDE} p. 38`,
  },

  'liabilities.creditor': {
    ...account,
    type: 'string',
    label: { en: 'Creditor', fr: 'Créancier' },
    official: 'nom, prénom, raison sociale et domicile du créancier',
    source: `${GE_GUIDE} p. 37`,
  },
  'liabilities.name': {
    ...account,
    type: 'string',
    label: { en: 'Loan', fr: 'Intitulé de la dette' },
  },
  'liabilities.balance_chf': {
    ...account,
    type: 'money',
    min: 0,
    label: { en: 'Debt on 31 December', fr: 'Dette au 31 décembre' },
    official: 'Dettes chirographaires et hypothécaires',
    source: `${GE_GUIDE} p. 37`,
  },
  'liabilities.interest_chf': {
    ...account,
    type: 'money',
    min: 0,
    label: { en: 'Interest paid', fr: 'Intérêts payés' },
    official: 'Intérêts de dettes privées',
    source: `${GE_GUIDE} p. 37`,
  },

  /** The bank's tax value of a security is the ESTV price list's (eCH-0196 "kursliste" flag). */
  'securities.value_kursliste': {
    perPerson: false,
    multiple: true,
    type: 'boolean',
    label: {
      en: 'Tax value from the official price list (ESTV)',
      fr: 'Valeur fiscale selon la liste officielle des cours (AFC)',
    },
    official: 'liste des cours',
    source: `${GE_GUIDE} p. 41`,
  },
} as const satisfies KeyRegistry;

export type Ech0196Key = keyof typeof KEYS_ECH0196_2026;
