// How each kind of document is called, in the guide’s words (ge-2025-guide-declaration-pp p. 8, p. 10, p. 53).
import type { DocumentKind } from '@taxpresso/ledger';

export const KIND_LABELS: Record<DocumentKind, { en: string; fr: string }> = {
  salary_certificate: { en: 'Salary certificate', fr: 'Certificat de salaire' },
  ech0196_statement: { en: 'Bank e-tax statement', fr: 'e-relevé fiscal' },
  bank_attestation: { en: 'Bank statement on 31 December', fr: 'Relevé bancaire au 31 décembre' },
  pillar3a_attestation: { en: 'Pillar 3a attestation', fr: 'Attestation 3e pilier A' },
  lpp_buyin: { en: 'Pension fund buy-in', fr: 'Attestation de rachat 2e pilier' },
  health_premiums: { en: 'Health insurance premiums', fr: 'Primes d’assurance-maladie' },
  medical_invoice: { en: 'Medical costs', fr: 'Frais médicaux' },
  childcare_invoice: { en: 'Childcare invoice', fr: 'Frais de garde' },
  donation_receipt: { en: 'Donation receipt', fr: 'Justificatif de don' },
  debt_interest: { en: 'Loan statement', fr: 'Relevé d’emprunt' },
  prior_declaration: { en: 'Last year’s declaration', fr: 'Déclaration de l’an dernier' },
  replacement_income_certificate: { en: 'Benefits attestation', fr: 'Attestation d’indemnités' },
  pension_certificate: { en: 'Pension certificate', fr: 'Certificat de rente' },
  alimony_proof: { en: 'Alimony proof', fr: 'Justificatif de pension alimentaire' },
  crypto_statement: { en: 'Crypto statement', fr: 'Relevé crypto' },
  separation_judgment: {
    en: 'Separation or divorce judgment',
    fr: 'Jugement de séparation ou de divorce',
  },
  broker_export: { en: 'Broker export (securities)', fr: 'Export du courtier (titres)' },
  other: { en: 'Something else', fr: 'Autre chose' },
  // ge-2025-guide-declaration-pp p. 53: the bordereaux ICC and IFD and the avis de taxation.
  tax_assessment: { en: 'Tax assessment', fr: 'Avis de taxation et bordereau' },
  // ge-2025-guide-declaration-pp p. 8: "Attestation des primes d'assurance-vie et contrat".
  life_insurance_attestation: {
    en: 'Life insurance attestation (pillar 3b)',
    fr: 'Attestation d’assurance-vie (3e pilier B)',
  },
};
