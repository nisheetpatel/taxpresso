// Values read from the attestations every canton asks for (SPEC.md section 5.5): pillar 3a, pension
// fund buy-ins, health insurance, medical costs, childcare, donations, loans, benefits and pensions.
// They repeat, one value per document: the instance is the document id. The same documents in every
// canton; the terms and sources below are those of the first canton, Geneva
// (ge-2025-guide-declaration-pp), and of the salary certificate guide (std-lohnausweis-wegleitung-
// 2026-fr). A canton gives its own official term where its form names it differently.
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';

const WAGE_GUIDE = 'std-lohnausweis-wegleitung-2026-fr';
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

export const KEYS_ATTESTATIONS_2026 = {
  'pillar3a.paid': money(
    true,
    { en: 'Paid into pillar 3a', fr: 'Versé au 3e pilier A' },
    'Cotisations 3e pilier A',
    `${GE_GUIDE} p. 18`,
  ),
  'lpp.buyin': money(
    true,
    { en: 'Pension fund buy-in (2nd pillar)', fr: 'Rachat de prévoyance professionnelle' },
    'Rachats de la prévoyance professionnelle',
    `${GE_GUIDE} p. 18`,
  ),
  'health.premiums': money(
    false,
    { en: 'Health insurance premiums paid', fr: 'Primes d’assurance-maladie payées' },
    'Primes d’assurance-maladie',
    `${GE_GUIDE} p. 29`,
  ),
  'health.subsidy': money(
    false,
    { en: 'Health insurance subsidy received', fr: 'Subside d’assurance-maladie reçu' },
    'Subsides de l’assurance-maladie',
    `${GE_GUIDE} p. 27`,
  ),
  'medical.costs': money(
    false,
    { en: 'Medical costs you paid', fr: 'Frais médicaux payés' },
    'Frais médicaux',
    `${GE_GUIDE} p. 14`,
  ),
  'childcare.costs': money(
    false,
    { en: 'Childcare costs paid', fr: 'Frais de garde payés' },
    'Frais de garde des enfants',
    `${GE_GUIDE} p. 30`,
  ),
  'donation.amount': money(false, { en: 'Donation', fr: 'Don' }, 'Dons', `${GE_GUIDE} p. 15`),
  'debt.interest': money(
    false,
    { en: 'Interest paid on a private loan', fr: 'Intérêts payés sur un emprunt privé' },
    'Intérêts de dettes privées',
    `${GE_GUIDE} p. 37`,
  ),
  'debt.balance': money(
    false,
    { en: 'Debt on 31 December', fr: 'Dette au 31 décembre' },
    'Dettes chirographaires et hypothécaires',
    `${GE_GUIDE} p. 37`,
  ),
  'replacement.amount': money(
    true,
    {
      en: 'Benefits received (unemployment, APG, sickness, accident)',
      fr: 'Indemnités reçues (chômage, APG, maladie, accident)',
    },
    'Perte de salaire, chômage, maladie, accident, militaire',
    `${GE_GUIDE} p. 17`,
  ),
  'replacement.type': {
    type: 'enum',
    values: [
      'unemployment',
      'apg_service',
      'maternity_paternity',
      'sickness_accident',
      'disability',
      'other',
    ],
    perPerson: true,
    multiple: true,
    label: { en: 'Kind of benefit', fr: 'Type d’indemnité' },
    official: 'Perte de salaire, chômage, maladie, accident, militaire',
    source: `${GE_GUIDE} p. 17`,
  },
  'replacement.paid_to_employer': {
    type: 'boolean',
    perPerson: true,
    multiple: true,
    label: {
      en: 'Paid to your employer, who passed it on with your salary',
      fr: 'Versé à votre employeur, qui l’a payé avec le salaire',
    },
    official: 'indemnités versées par l’employeur',
    source: `${WAGE_GUIDE} p. 13 (Cm 34, 35)`,
  },
  'pension.amount': money(
    true,
    { en: 'Pension received', fr: 'Rente reçue' },
    'Rentes',
    `${GE_GUIDE} p. 25`,
  ),
  'pension.type': {
    type: 'enum',
    values: ['avs_ai', 'occupational', 'other'],
    perPerson: true,
    multiple: true,
    label: { en: 'Kind of pension', fr: 'Type de rente' },
    official: 'Rentes AVS / AI, rentes de la prévoyance professionnelle, autres rentes',
    source: `${GE_GUIDE} p. 25 and 26`,
  },
} as const satisfies KeyRegistry;

export const KEY_CHECK_NOTE_2026 = {
  // A short note from the user that settles a "Check this" item (SPEC.md section 5.8).
  // The instance is the check id.
  'check.note': {
    type: 'string',
    perPerson: false,
    multiple: true,
    label: { en: 'Your note on something to check', fr: 'Votre remarque sur un point à vérifier' },
  },
} as const satisfies KeyRegistry;

export type AttestationKey = keyof typeof KEYS_ATTESTATIONS_2026;

/**
 * Which values each kind of attestation gives (the schema Claude reads against, SPEC.md 5.3), in
 * every canton.
 */
export const ATTESTATION_FIELDS_2026 = {
  pillar3a_attestation: ['pillar3a.paid'],
  lpp_buyin: ['lpp.buyin'],
  health_premiums: ['health.premiums', 'health.subsidy'],
  medical_invoice: ['medical.costs'],
  childcare_invoice: ['childcare.costs'],
  donation_receipt: ['donation.amount'],
  debt_interest: ['debt.interest', 'debt.balance'],
  replacement_income_certificate: [
    'replacement.amount',
    'replacement.type',
    'replacement.paid_to_employer',
  ],
  pension_certificate: ['pension.amount', 'pension.type'],
} as const satisfies Partial<Record<DocumentKind, readonly AttestationKey[]>>;
