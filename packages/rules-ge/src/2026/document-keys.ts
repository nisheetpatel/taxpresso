// Keys for values read from documents (SPEC.md sections 5.3, 5.5 and 10.8). They repeat, one value
// per document: the instance is the document id. Box numbers and labels come from the official
// documents, never from memory:
// - salary certificate (Formulaire 11): its boxes are the same in every canton, so they are in
//   packages/rules-ch (keys/salary-certificate.ts); std-lohnausweis-wegleitung-2026-fr here too;
// - Geneva terms: ge-2025-guide-declaration-pp (the 2025 guide; the 2026 guide is published in
//   January 2027 and re-opens every label that cites it);
// - the assessment and the objection: ge-na-law-lpfisc and ch-na-law-lifd.
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';
import {
  ATTESTATION_FIELDS_2026,
  DOCUMENT_FIELDS_WEALTH_2026,
  DOCUMENT_KEYS_WEALTH_2026,
  KEY_CHECK_NOTE_2026,
  KEYS_ATTESTATIONS_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  SALARY_CERTIFICATE_FIELDS_2026,
} from '@taxpresso/rules-ch';
import { BUSINESS_FIELDS_2026, KEYS_BUSINESS_DOCUMENTS_2026 } from './business-keys.js';

const GE_GUIDE = 'ge-2025-guide-declaration-pp';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

const money = (
  perPerson: boolean,
  label: KeyDef['label'],
  official: string,
  source: string,
): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson,
  multiple: true,
  label,
  official,
  source,
});

export const DOCUMENT_KEYS_2026 = {
  // Salary certificate, federal form 11 (certificat de salaire): packages/rules-ch.
  ...KEYS_SALARY_CERTIFICATE_2026,

  // The attestations every canton asks for: packages/rules-ch (keys/attestations.ts).
  ...KEYS_ATTESTATIONS_2026,

  // The tax office's assessment: bordereaux ICC and IFD and the avis de taxation
  // (ge-2025-guide-declaration-pp p. 53). Household figures, one set per assessment document.
  'assessment.tax': {
    type: 'enum',
    values: ['icc', 'ifd', 'icc_ifd'],
    perPerson: false,
    multiple: true,
    label: { en: 'Which tax it is for', fr: 'Impôt concerné' },
    official: 'ICC (impôt cantonal et communal), IFD (impôt fédéral direct)',
    source: `${GE_GUIDE} p. 53`,
  },
  'assessment.notification_date': {
    type: 'date',
    perPerson: false,
    multiple: true,
    label: { en: 'Date of the assessment', fr: 'Date de la taxation' },
    official: 'notification de la décision de taxation',
    source: 'ge-na-law-lpfisc art. 39 al. 1; ch-na-law-lifd art. 132 al. 1 (p. 71)',
  },
  'assessment.taxable_income': money(
    false,
    { en: 'Taxable income', fr: 'Revenu imposable' },
    'Revenu imposable',
    'ch-na-law-lifd art. 131 al. 1 (p. 70)',
  ),
  'assessment.taxable_wealth': money(
    false,
    { en: 'Taxable wealth', fr: 'Fortune imposable' },
    'Fortune imposable',
    `${GE_GUIDE} p. 52`,
  ),
  'assessment.tax_amount': money(
    false,
    { en: 'Tax amount', fr: 'Montant de l’impôt' },
    'Montant de l’impôt',
    'ch-na-law-lifd art. 131 al. 1 (p. 70)',
  ),
  'assessment.salary_gross': money(
    false,
    { en: 'Gross salaries, as assessed', fr: 'Salaires bruts retenus' },
    'Salaires bruts',
    `${GE_GUIDE} p. 17`,
  ),
  'assessment.social_contributions': money(
    false,
    { en: 'Social insurance contributions, as assessed', fr: 'Cotisations AVS/AI retenues' },
    'Cotisations AVS / AI / APG / Chômage',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.lpp_contributions': money(
    false,
    { en: 'Pension fund contributions, as assessed', fr: 'Cotisations 2e pilier retenues' },
    'Cotisations 2e pilier',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.lpp_buyin': money(
    false,
    { en: 'Pension fund buy-ins, as assessed', fr: 'Rachats 2e pilier retenus' },
    'Rachats de la prévoyance professionnelle',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.pillar3a': money(
    false,
    { en: 'Pillar 3a, as assessed', fr: '3e pilier A retenu' },
    'Cotisations 3e pilier A',
    `${GE_GUIDE} p. 18`,
  ),
  'assessment.replacement_income': money(
    false,
    { en: 'Benefits (unemployment, APG...), as assessed', fr: 'Indemnités retenues' },
    'Perte de salaire, chômage, maladie, accident, militaire',
    `${GE_GUIDE} p. 17`,
  ),
  'assessment.pension': money(
    false,
    { en: 'Pensions, as assessed', fr: 'Rentes retenues' },
    'Rentes',
    `${GE_GUIDE} p. 25`,
  ),
  'assessment.health_premiums': money(
    false,
    { en: 'Health insurance premiums, as assessed', fr: 'Primes d’assurance-maladie retenues' },
    'Primes d’assurance-maladie',
    `${GE_GUIDE} p. 29`,
  ),
  'assessment.medical_costs': money(
    false,
    { en: 'Medical costs, as assessed', fr: 'Frais médicaux retenus' },
    'Frais médicaux',
    `${GE_GUIDE} p. 14`,
  ),
  'assessment.childcare': money(
    false,
    { en: 'Childcare costs, as assessed', fr: 'Frais de garde retenus' },
    'Frais de garde des enfants',
    `${GE_GUIDE} p. 30`,
  ),
  'assessment.donations': money(
    false,
    { en: 'Donations, as assessed', fr: 'Dons retenus' },
    'Dons',
    `${GE_GUIDE} p. 15`,
  ),
  'assessment.debt_interest': money(
    false,
    { en: 'Private loan interest, as assessed', fr: 'Intérêts de dettes privées retenus' },
    'Intérêts de dettes privées',
    `${GE_GUIDE} p. 37`,
  ),

  // Bank statements, tax statements, crypto and life insurance: ./document-keys-wealth.ts.
  ...DOCUMENT_KEYS_WEALTH_2026,

  // A short note from the user that settles a "Check this" item (SPEC.md section 5.8): rules-ch.
  ...KEY_CHECK_NOTE_2026,

  // Self-employment: the business's accounts and the AVS statements (./business-keys.ts).
  ...KEYS_BUSINESS_DOCUMENTS_2026,
} as const satisfies KeyRegistry;

export type DocumentKey2026 = keyof typeof DOCUMENT_KEYS_2026;

/**
 * Which values each kind of document can give (the schema Claude reads against, SPEC.md 5.3).
 * Kinds not listed give no values yet: their details (whose, which year, period, issuer) still count.
 */
export const DOCUMENT_FIELDS_2026: Partial<Record<DocumentKind, readonly DocumentKey2026[]>> = {
  salary_certificate: SALARY_CERTIFICATE_FIELDS_2026,
  ...ATTESTATION_FIELDS_2026,
  tax_assessment: [
    'assessment.tax',
    'assessment.notification_date',
    'assessment.taxable_income',
    'assessment.taxable_wealth',
    'assessment.tax_amount',
    'assessment.salary_gross',
    'assessment.social_contributions',
    'assessment.lpp_contributions',
    'assessment.lpp_buyin',
    'assessment.pillar3a',
    'assessment.replacement_income',
    'assessment.pension',
    'assessment.health_premiums',
    'assessment.medical_costs',
    'assessment.childcare',
    'assessment.donations',
    'assessment.debt_interest',
  ],
  ...DOCUMENT_FIELDS_WEALTH_2026,
  ...BUSINESS_FIELDS_2026,
};

/** The keys a document of this kind can give, or none. */
export function documentFields(kind: DocumentKind | undefined): readonly DocumentKey2026[] {
  return (kind && DOCUMENT_FIELDS_2026[kind]) || [];
}
