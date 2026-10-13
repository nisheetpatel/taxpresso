// Values Claude reads from the documents behind the securities list and the other movable wealth
// (SPEC.md 5.2 and 5.5), one value per document (instance = the document id), each mapped to its
// line of the official form by etat-des-titres.ts:
//   bank_attestation            one account: état des titres, comptes bancaires et postaux (F2)
//   ech0196_statement           a bank's tax statement (relevé fiscal, e-relevé): one total line
//                               per deposit (F4). The eCH-0196 barcode reader, when it lands,
//                               fills the same keys, as "verified".
//   crypto_statement            crypto on 31 December: with the accounts (F2), guide p. 40
//   life_insurance_attestation  surrender value 16.70 and premiums 52.11 (C3)
// Labels and rules: ge-2025-guide-declaration-pp; rubric layout: ge-2025-declaration-specimen.
import type { KeyDef } from '@taxpresso/ledger';

const GUIDE = 'ge-2025-guide-declaration-pp';
const SPECIMEN = 'ge-2025-declaration-specimen';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

const perDocument = { perPerson: false, multiple: true } as const;
const money = (label: KeyDef['label'], official: string, source: string): KeyDef => ({
  ...perDocument,
  type: 'money',
  min: 0,
  max: MAX,
  label,
  official,
  source,
});

export const DOCUMENT_KEYS_WEALTH_2026 = {
  // One bank or postal account (F2).
  'bank.account_number': {
    ...perDocument,
    type: 'string',
    label: { en: 'Account number (IBAN)', fr: 'Numéro de compte (IBAN)' },
    official: 'numéro de compte (8 dernières positions du code IBAN)',
    source: `${GUIDE} p. 40`,
  },
  'bank.currency': {
    ...perDocument,
    type: 'string',
    label: { en: 'Currency of the account', fr: 'Monnaie du compte' },
    official: 'compte en devise étrangère',
    source: `${GUIDE} p. 40`,
  },
  /** In CHF, as printed (an account in CHF, or the CHF value the bank prints for it). */
  'bank.balance': money(
    { en: 'Balance on 31 December, in CHF', fr: 'Solde au 31 décembre, en CHF' },
    'solde du compte au 31.12',
    `${GUIDE} p. 40`,
  ),
  'bank.interest_gross': money(
    { en: 'Gross interest of the year, in CHF', fr: 'Intérêts bruts de l’année, en CHF' },
    'intérêts bruts',
    `${GUIDE} p. 40`,
  ),
  /**
   * An account in another currency with no CHF amount printed: the amounts in that currency, as
   * printed. Taxpresso converts them at the official rate (exchange-rates.ts), never Claude.
   */
  'bank.balance_in_currency': {
    ...perDocument,
    type: 'string',
    label: {
      en: 'Balance on 31 December, in the account’s currency',
      fr: 'Solde au 31 décembre, dans la monnaie du compte',
    },
    official: 'compte en devise étrangère, converti au cours fiscal',
    source: `${GUIDE} p. 40`,
  },
  'bank.interest_in_currency': {
    ...perDocument,
    type: 'string',
    label: {
      en: 'Gross interest, in the account’s currency',
      fr: 'Intérêts bruts, dans la monnaie du compte',
    },
    official: 'intérêts bruts, convertis au cours fiscal',
    source: `${GUIDE} p. 40`,
  },
  /** Always in CHF. */
  'bank.withholding_swiss': money(
    { en: 'Swiss withholding tax deducted', fr: 'Impôt anticipé retenu' },
    'impôt anticipé (IA)',
    `${GUIDE} p. 39, 40`,
  ),
  'bank.fees': money(
    {
      en: 'Account fees and negative interest',
      fr: 'Frais de tenue de compte et intérêts négatifs',
    },
    'frais bancaires (comptes)',
    `${GUIDE} p. 40`,
  ),
  'bank.abroad': {
    ...perDocument,
    type: 'boolean',
    label: { en: 'Account held abroad', fr: 'Compte déposé à l’étranger' },
    official: 'intérêts de comptes déposés à l’étranger',
    source: `${GUIDE} p. 40`,
  },

  // A bank's tax statement for a whole deposit (F4).
  'tax_statement.deposit_number': {
    ...perDocument,
    type: 'string',
    label: { en: 'Deposit number', fr: 'Numéro du dépôt' },
    official: 'numéro du dépôt (7 dernières positions)',
    source: `${GUIDE} p. 43`,
  },
  'tax_statement.income_subject_ia': money(
    { en: 'Gross income subject to Swiss withholding tax', fr: 'Rendements bruts soumis à l’IA' },
    'rendements bruts soumis à l’impôt anticipé',
    `${GUIDE} p. 43`,
  ),
  'tax_statement.income_not_subject_ia': money(
    {
      en: 'Gross income not subject to Swiss withholding tax',
      fr: 'Rendements bruts non soumis à l’IA',
    },
    'rendements bruts non soumis à l’impôt anticipé',
    `${GUIDE} p. 43`,
  ),
  'tax_statement.taxable_value': money(
    { en: 'Taxable value on 31 December', fr: 'Valeur imposable au 31 décembre' },
    'valeur imposable au 31.12',
    `${GUIDE} p. 43`,
  ),
  'tax_statement.withholding_swiss': money(
    { en: 'Swiss withholding tax (impôt anticipé)', fr: 'Impôt anticipé' },
    'impôt anticipé (IA)',
    `${GUIDE} p. 39`,
  ),
  /** The non-recoverable foreign tax the bank lists for the DA-1 form. */
  'tax_statement.foreign_tax_credit': money(
    { en: 'Foreign tax to credit (form DA-1)', fr: 'Imputation d’impôts étrangers (DA-1)' },
    'imputation d’impôts étrangers prélevés à la source (IES)',
    `${GUIDE} p. 39`,
  ),
  'tax_statement.fees': money(
    { en: 'Deductible custody fees', fr: 'Frais bancaires déductibles' },
    'frais bancaires (titres et relevés fiscaux)',
    `${GUIDE} p. 43`,
  ),

  // Crypto on 31 December (with the accounts, guide p. 40).
  'crypto.value_chf': money(
    { en: 'Value on 31 December, in CHF', fr: 'Valeur au 31 décembre, en CHF' },
    'cours fiscal AFC multiplié par le nombre d’unités',
    `${GUIDE} p. 40`,
  ),
  'crypto.income_chf': money(
    { en: 'Income of the year (staking, interest)', fr: 'Rendements de l’année' },
    'rendements générés par les monnaies virtuelles',
    `${GUIDE} p. 40`,
  ),

  // Life insurance, pillar 3b (C3, 52.11).
  'life_insurance.surrender_value': money(
    { en: 'Surrender value on 31 December', fr: 'Valeur de rachat au 31 décembre' },
    'valeur de rachat',
    `${GUIDE} p. 26, 28; ${SPECIMEN} p. 13`,
  ),
  'life_insurance.premiums': money(
    { en: 'Premiums paid in the year', fr: 'Primes payées dans l’année' },
    'primes et cotisations (assurance-vie)',
    `${GUIDE} p. 28; ${SPECIMEN} p. 13`,
  ),
} as const satisfies Record<string, KeyDef>;

/** Which values each of these kinds of documents gives (merged into DOCUMENT_FIELDS_2026). */
export const DOCUMENT_FIELDS_WEALTH_2026 = {
  bank_attestation: [
    'bank.account_number',
    'bank.currency',
    'bank.balance',
    'bank.interest_gross',
    'bank.balance_in_currency',
    'bank.interest_in_currency',
    'bank.withholding_swiss',
    'bank.fees',
    'bank.abroad',
  ],
  ech0196_statement: [
    'tax_statement.deposit_number',
    'tax_statement.income_subject_ia',
    'tax_statement.income_not_subject_ia',
    'tax_statement.taxable_value',
    'tax_statement.withholding_swiss',
    'tax_statement.foreign_tax_credit',
    'tax_statement.fees',
  ],
  crypto_statement: ['crypto.value_chf', 'crypto.income_chf'],
  life_insurance_attestation: ['life_insurance.surrender_value', 'life_insurance.premiums'],
} as const;
