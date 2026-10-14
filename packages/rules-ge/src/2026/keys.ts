// Canonical keys for tax year 2026 (SPEC.md section 4), defined once. This first set is the
// profile the questionnaire collects; income, deduction and wealth keys arrive with the intake
// parsers and the rules engine, each with the form field it maps to.
// Official terms: ge-2025-guide-declaration-pp (p. 8 documents to gather, p. 10 attachments).
import type { KeyRegistry } from '@taxpresso/ledger';
import { KEYS_ECH0196_2026, KEYS_SECURITIES_2026, LPP_BUYIN_FACTS } from '@taxpresso/rules-ch';
import { COMMUNES_2026 } from './communes.js';
import { KEYS_WEALTH_2026 } from './keys-wealth.js';
import { DOCUMENT_KEYS_2026 } from './document-keys.js';
import { sourceTaxTariffs } from '../source-tax/index.js';
import { TOU_FACTS } from './tou.js';
import { KEYS_PRIOR_2026 } from './keys-prior.js';

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
  // Travel to work and lunches away from home (frais de déplacement, frais de repas): what people
  // know, which the engine turns into 31.60, 31.70 and 31.71 (../engine/compute.ts). The rules:
  // ch-2026-ifd-instructions-personnes-physiques p. 6 (federal: public transport paid; bike or
  // moped with a yellow plate, a flat amount; car or motorbike with a white plate, the price of
  // public transport, or by the kilometre when it can't be used; meals per day), and
  // ge-2025-guide-declaration-pp p. 19 to 22 (Geneva: the same costs, a lower cap; meals only when
  // the trip by public transport takes over 2 hours a day).
  'profile.commute': {
    type: 'enum',
    values: [
      'public_transport',
      'public_transport_long',
      'car',
      'motorbike',
      'bike',
      'walk',
      'mostly_home',
    ],
    perPerson: true,
    label: { en: 'Way to work', fr: 'Trajet pour le travail' },
    official: 'frais de déplacement',
    source:
      'ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-guide-declaration-pp p. 19, 20 and 22',
  },
  'commute.transit_cost': {
    type: 'money',
    min: 0,
    max: 2_000_000,
    perPerson: true,
    label: {
      en: 'Public transport to work, paid in the year',
      fr: 'Transports publics pour le travail, payés dans l’année',
    },
    official: 'frais de déplacement',
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-guide-declaration-pp p. 22',
  },
  'commute.transit_usable': {
    type: 'enum',
    values: ['yes', 'yes_long', 'no'],
    perPerson: true,
    label: {
      en: 'Could the trip to work be made by public transport',
      fr: 'Le trajet pour le travail était-il possible en transports publics',
    },
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-guide-declaration-pp p. 19',
  },
  'commute.transit_equivalent': {
    type: 'money',
    min: 0,
    max: 2_000_000,
    perPerson: true,
    label: {
      en: 'What public transport to work would have cost',
      fr: 'Ce qu’auraient coûté les transports publics pour le travail',
    },
    official: 'frais de déplacement',
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-guide-declaration-pp p. 20',
  },
  'commute.distance_km': {
    type: 'integer',
    min: 1,
    max: 300,
    perPerson: true,
    label: {
      en: 'Home to work, one way, in kilometres',
      fr: 'Domicile au lieu de travail, aller simple, en kilomètres',
    },
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6',
  },
  'commute.drive_days': {
    type: 'integer',
    min: 1,
    max: 366,
    perPerson: true,
    label: { en: 'Days driven to work', fr: 'Jours de trajet en véhicule pour le travail' },
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6',
  },
  'meals.days': {
    type: 'integer',
    min: 0,
    max: 366,
    perPerson: true,
    label: {
      en: 'Work days with lunch away from home',
      fr: 'Jours de travail avec repas de midi hors du domicile',
    },
    official: 'frais de repas',
    source: 'ch-2026-ifd-instructions-personnes-physiques p. 6; ge-2025-guide-declaration-pp p. 19',
  },
  // Shared custody without a partner: who gets the federal parental scale and the child
  // deductions depends on child support (ch-na-circulaire-30-epoux-famille p. 24, p. 32 and 33:
  // ch. 13.4.2, 14.4, 14.5), and the Geneva family charge and splitting too
  // (ge-2025-guide-declaration-pp p. 45 and 46).
  'profile.child_support': {
    type: 'enum',
    values: ['i_receive', 'i_pay', 'none_i_earn_more', 'none_other_earns_more', 'none_unsure'],
    perPerson: false,
    label: {
      en: 'Child support between the parents',
      fr: 'Contribution d’entretien entre les parents',
    },
    official: 'contribution d’entretien',
    source:
      'ch-na-circulaire-30-epoux-famille p. 24, p. 32 and 33; ge-2025-guide-declaration-pp p. 45 and 46',
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
  // Planning inputs for the pension fund buy-in, the 3a catch-up and TOU (SPEC.md section 8, groups
  // B and C): ./pension.ts, ./tou.ts. Never filed.
  'plan.lpp_buyin_capacity': {
    type: 'money',
    min: 0,
    max: 10_000_000_00,
    perPerson: true,
    label: {
      en: 'Buy-in your pension fund allows (pension certificate)',
      fr: 'Rachat possible selon votre certificat de prévoyance',
    },
    official: 'rachat 2e pilier (LPP)',
    source: LPP_BUYIN_FACTS.capacityFromFund,
  },
  'plan.lpp_buyin_amount': {
    type: 'money',
    min: 0,
    max: 10_000_000_00,
    perPerson: true,
    label: {
      en: 'Pension fund buy-in you plan this year',
      fr: 'Rachat 2e pilier envisagé cette année',
    },
    official: 'rachats de la prévoyance professionnelle',
    source: LPP_BUYIN_FACTS.paidInYear,
  },
  'plan.pillar3a_paid_2025': {
    type: 'money',
    min: 0,
    max: 10_000_000,
    perPerson: true,
    label: { en: 'Paid into 3a in 2025', fr: 'Versé au 3e pilier A en 2025' },
    official: 'cotisations 3e pilier A',
  },
  'plan.source_tax_withheld': {
    type: 'money',
    min: 0,
    max: 10_000_000_00,
    perPerson: true,
    label: {
      en: 'Tax withheld at source for the year',
      fr: 'Impôt retenu à la source pour l’année',
    },
    official: 'retenue de l’impôt à la source (certificat de salaire, chiffre 12)',
  },
  'plan.source_tax_tariff': {
    type: 'enum',
    values: sourceTaxTariffs(2026),
    perPerson: true,
    label: { en: 'Source-tax tariff on the payslip', fr: 'Barème de l’impôt à la source' },
    official: 'barème de l’impôt à la source',
    source: 'ge-na-law-risp art. 1 al. 1; ge-2026-source-tariff-ascii',
  },
  'plan.tou_other_income': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'Other income not taxed at source, over the limit',
      fr: 'Autres revenus non imposés à la source, au-dessus de la limite',
    },
    source: TOU_FACTS.compulsoryCases,
  },
  'plan.tou_taxable_wealth': {
    type: 'boolean',
    perPerson: false,
    label: { en: 'Taxable wealth on 31 December', fr: 'Fortune imposable au 31 décembre' },
    official: 'fortune imposable',
    source: TOU_FACTS.compulsoryCases,
  },
  // The securities list (état des titres), one instance per security: keys-securities.ts.
  ...KEYS_SECURITIES_2026,
  // Accounts, crypto, loans, life insurance, valuables and debts the user describes: keys-wealth.ts.
  ...KEYS_WEALTH_2026,
  // Values read from documents, one per document (./document-keys.ts).
  ...DOCUMENT_KEYS_2026,
  // Last year's figures from the prior-year declaration, for comparison only (./keys-prior.ts).
  ...KEYS_PRIOR_2026,
  // Bank accounts and liabilities from e-tax statements, one per account: keys-ech0196.ts.
  ...KEYS_ECH0196_2026,
} as const satisfies KeyRegistry;

export type Key2026 = keyof typeof KEYS_2026;
