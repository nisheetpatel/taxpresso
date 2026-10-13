// Canonical keys for tax year 2026 (SPEC.md section 4), defined once. This first set is the
// profile the questionnaire collects; income, deduction and wealth keys arrive with the intake
// parsers and the rules engine, each with the form field it maps to.
// Official terms: ge-2025-guide-declaration-pp (p. 8 documents to gather, p. 10 attachments).
import type { KeyRegistry } from '@taxpresso/ledger';
import { COMMUNES_2026 } from './communes.js';
import { KEYS_SECURITIES_2026 } from './keys-securities.js';
import { DOCUMENT_KEYS_2026 } from './document-keys.js';

export const KEYS_2026 = {
  'profile.civil_status': {
    type: 'enum',
    values: ['single', 'married', 'registered_partnership', 'separated', 'divorced', 'widowed'],
    perPerson: false,
    label: { en: 'Civil status on 31 December', fr: 'État civil au 31 décembre' },
    official: 'état civil',
  },
  'profile.children_count': {
    type: 'integer',
    min: 0,
    max: 12,
    perPerson: false,
    label: { en: 'Dependent children', fr: 'Enfants à charge' },
    official: 'enfants à charge',
  },
  'profile.children_custody': {
    type: 'enum',
    values: ['with_household', 'shared', 'elsewhere'],
    perPerson: false,
    label: { en: 'Where the children live', fr: 'Où vivent les enfants' },
  },
  'profile.commune': {
    type: 'enum',
    values: COMMUNES_2026.map((c) => c.slug),
    perPerson: false,
    label: { en: 'Commune on 31 December', fr: 'Commune de domicile au 31 décembre' },
    official: 'commune de domicile',
  },
  'profile.moved': {
    type: 'enum',
    values: ['no', 'within_geneva', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
    perPerson: false,
    label: { en: 'Moves in the year', fr: 'Déménagements dans l’année' },
  },
  'profile.income_sources': {
    type: 'enum_list',
    values: ['salary', 'replacement_income', 'pension', 'alimony', 'self_employment'],
    perPerson: true,
    label: { en: 'Kinds of income', fr: 'Types de revenus' },
  },
  'profile.employers': {
    type: 'integer',
    min: 1,
    max: 9,
    perPerson: true,
    label: { en: 'Employers in the year', fr: 'Employeurs dans l’année' },
  },
  'profile.taxed_at_source': {
    type: 'boolean',
    perPerson: true,
    label: { en: 'Taxed at source', fr: 'Imposé à la source' },
    official: 'impôt à la source',
  },
  'profile.tou': {
    type: 'enum',
    values: ['already', 'considering', 'no'],
    perPerson: true,
    label: {
      en: 'Ordinary taxation instead of source tax',
      fr: 'Taxation ordinaire ultérieure (TOU)',
    },
    official: 'taxation ordinaire ultérieure (TOU)',
  },
  'profile.pillar3a': {
    type: 'boolean',
    perPerson: true,
    label: { en: 'Paid into pillar 3a', fr: 'Cotisations au 3e pilier A' },
    official: '3e pilier A',
  },
  'profile.lpp_buyin': {
    type: 'boolean',
    perPerson: true,
    label: { en: 'Pension fund buy-in', fr: 'Rachat de cotisations 2e pilier' },
    official: 'rachat 2e pilier (LPP)',
  },
  'profile.commute': {
    type: 'enum',
    values: ['public_transport', 'car_or_motorbike', 'bike_or_walk', 'mostly_home'],
    perPerson: true,
    label: { en: 'Way to work', fr: 'Trajet pour le travail' },
    official: 'frais de déplacement',
  },
  'profile.childcare': {
    type: 'enum',
    values: ['creche_or_daycare', 'nanny', 'none'],
    perPerson: false,
    label: { en: 'Childcare', fr: 'Frais de garde' },
    official: 'frais de garde',
  },
  'profile.banks': {
    type: 'integer',
    min: 0,
    max: 20,
    perPerson: false,
    label: { en: 'Banks with your accounts', fr: 'Banques où vous avez des comptes' },
    official: 'état des titres',
  },
  'profile.crypto': {
    type: 'boolean',
    perPerson: false,
    label: { en: 'Cryptocurrencies', fr: 'Crypto-monnaies' },
    official: 'crypto-monnaies',
  },
  'profile.payments': {
    type: 'enum_list',
    values: ['medical_costs', 'donations', 'loan_interest', 'alimony_paid'],
    perPerson: false,
    label: { en: 'Costs you paid', fr: 'Frais que vous avez payés' },
  },
  'profile.special': {
    type: 'enum_list',
    values: ['real_estate', 'inheritance_or_gift', 'foreign_income', 'pension_capital'],
    perPerson: false,
    label: { en: 'Special situations', fr: 'Situations particulières' },
  },
  // Planning inputs for "before 31 December" (SPEC.md section 8, group B). Rough figures the user
  // gives for an estimate; never filed.
  'plan.gross_salary': {
    type: 'money',
    min: 0,
    max: 10_000_000_00,
    perPerson: true,
    label: { en: 'Gross salary this year, roughly', fr: 'Salaire brut de l’année, environ' },
  },
  'plan.net_salary': {
    type: 'money',
    min: 0,
    max: 10_000_000_00,
    perPerson: true,
    label: { en: 'Net salary this year', fr: 'Salaire net de l’année' },
    official: 'salaire net (certificat de salaire, chiffre 11)',
  },
  'plan.has_pension_fund': {
    type: 'boolean',
    perPerson: true,
    label: { en: 'Pension fund at work', fr: 'Caisse de pension au travail' },
    official: '2e pilier (LPP)',
  },
  'plan.pillar3a_paid': {
    type: 'money',
    min: 0,
    max: 10_000_000,
    perPerson: true,
    label: { en: 'Already paid into 3a this year', fr: 'Déjà versé au 3e pilier A cette année' },
  },
  // The securities list (état des titres), one instance per security: keys-securities.ts.
  ...KEYS_SECURITIES_2026,
  // Values read from documents, one per document (./document-keys.ts).
  ...DOCUMENT_KEYS_2026,
} as const satisfies KeyRegistry;

export type Key2026 = keyof typeof KEYS_2026;
