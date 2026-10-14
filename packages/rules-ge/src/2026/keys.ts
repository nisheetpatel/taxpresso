// Canonical keys for tax year 2026 (SPEC.md section 4), defined once. This first set is the
// profile the questionnaire collects; income, deduction and wealth keys arrive with the intake
// parsers and the rules engine, each with the form field it maps to.
// Official terms: ge-2025-guide-declaration-pp (p. 8 documents to gather, p. 10 attachments).
import type { KeyRegistry } from '@taxpresso/ledger';
import {
  KEYS_ECH0196_2026,
  KEYS_HOUSEHOLD_2026 as H,
  KEYS_SECURITIES_2026,
  KEYS_WEALTH_2026,
} from '@taxpresso/rules-ch';
import { KEYS_ABROAD_PROFILE_2026 } from './abroad-keys.js';
import { KEYS_BUSINESS_PROFILE_2026 } from './business-keys.js';
import { COMMUNES_2026 } from './communes.js';
import { DOCUMENT_KEYS_2026 } from './document-keys.js';
import { sourceTaxTariffs } from '../source-tax/index.js';
import { TOU_FACTS } from './tou.js';
import { KEYS_PRIOR_2026 } from './keys-prior.js';

export const KEYS_2026 = {
  'profile.civil_status': H['profile.civil_status'],
  'profile.children_count': H['profile.children_count'],
  'profile.children_custody': H['profile.children_custody'],
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
  'profile.income_sources': H['profile.income_sources'],
  'profile.employers': H['profile.employers'],
  'profile.residence': H['profile.residence'],
  // Paid by an employer in Switzerland (or its Swiss branch, or the Swiss company in the end): a
  // salary paid directly from abroad is taxed ordinarily (ge-na-law-risp art. 5).
  'profile.employer_in_switzerland': {
    type: 'boolean',
    perPerson: true,
    label: {
      en: 'Salary paid by an employer in Switzerland',
      fr: 'Salaire versé par un employeur en Suisse',
    },
    official: 'débiteur de la prestation imposable (DPI)',
    source: 'ge-na-law-risp art. 5; ge-2026-source-directives p. 6 (ch. 1.1.2)',
  },
  'profile.taxed_at_source': H['profile.taxed_at_source'],
  // Already taxed ordinarily after source tax (TOU) before this year: a fact, which keeps TOU every
  // year while taxed at source (ge-na-law-lisp art. 4 al. 5, art. 5 al. 5). Whether to ask for it is
  // the TOU card's decision, not an answer ('considering' was one until October 2026: asked again).
  'profile.tou': {
    type: 'enum',
    values: ['already', 'no'],
    perPerson: true,
    label: {
      en: 'Already taxed ordinarily after source tax (TOU)',
      fr: 'Déjà en taxation ordinaire ultérieure (TOU)',
    },
    official: 'taxation ordinaire ultérieure (TOU)',
    source: 'ge-na-law-lisp art. 4 al. 5, art. 5 al. 5',
  },
  // A single parent taxed at source living with the children's other parent: barème A0, not H
  // (./../source-tax/tariff.ts).
  'profile.lives_with_other_parent': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'Lives with the children’s other parent, unmarried',
      fr: 'Vit en couple avec l’autre parent des enfants, sans être marié(e)',
    },
    official: 'concubins avec enfant(s) à charge',
    source: 'ge-2026-source-directives p. 30 (ch. 5.5.1)',
  },
  // Self-employment (annexe B), the simple case: how the business is run, its year, its place,
  // what Taxpresso can't prepare yet, earlier losses, and the year's expected profit for the plans
  // (./business-keys.ts).
  ...KEYS_BUSINESS_PROFILE_2026,
  'profile.pillar3a': H['profile.pillar3a'],
  'profile.lpp_buyin': H['profile.lpp_buyin'],
  // Travel to work and lunches away from home (frais de déplacement, frais de repas): what people
  // know, which the engine turns into 31.60, 31.70 and 31.71 (../engine/compute.ts). The rules:
  // ch-2026-ifd-instructions-personnes-physiques p. 6 (federal: public transport paid; bike or
  // moped with a yellow plate, a flat amount; car or motorbike with a white plate, the price of
  // public transport, or by the kilometre when it can't be used; meals per day), and
  // ge-2025-guide-declaration-pp p. 19 to 22 (Geneva: the same costs, a lower cap; meals only when
  // the trip by public transport takes over 2 hours a day).
  'profile.commute': H['profile.commute'],
  'commute.transit_cost': H['commute.transit_cost'],
  'commute.transit_usable': H['commute.transit_usable'],
  'commute.transit_equivalent': H['commute.transit_equivalent'],
  'commute.distance_km': H['commute.distance_km'],
  'commute.drive_days': H['commute.drive_days'],
  'meals.days': H['meals.days'],
  // Shared custody without a partner: who gets the federal parental scale and the child
  // deductions depends on child support (ch-na-circulaire-30-epoux-famille p. 24, p. 32 and 33:
  // ch. 13.4.2, 14.4, 14.5), and the Geneva family charge and splitting too
  // (ge-2025-guide-declaration-pp p. 45 and 46).
  'profile.child_support': H['profile.child_support'],
  'profile.childcare': H['profile.childcare'],
  // Childcare paid for each child: asked only when the invoices for the household pass one child's
  // maximum and there are several children, since the maximum is per child and the split then
  // decides the deduction (ge-2025-guide-declaration-pp p. 30, 59.10 and 59.12).
  'ge.child_care': {
    type: 'money',
    perPerson: true,
    label: { en: 'Childcare paid for this child', fr: 'Frais de garde payés pour cet enfant' },
    official: 'frais de garde des enfants',
    source: 'ge-2025-guide-declaration-pp p. 30 (59.10, 59.12)',
  },
  'profile.banks': H['profile.banks'],
  'profile.crypto': H['profile.crypto'],
  'profile.payments': H['profile.payments'],
  // A home or land abroad is Geneva's own option (data/ge/2026/questionnaire.yaml, special): the
  // other cantons keep the shared list, where real estate anywhere is not supported.
  'profile.special': {
    ...H['profile.special'],
    values: [...H['profile.special'].values, 'property_abroad'],
  },
  // A home or land abroad (immeuble à l'étranger, annexe D), the simple case: what it is and how it
  // is used, whose it is, its country and its age, and the household's rough figures until its
  // documents are in (./abroad-keys.ts; ../engine/abroad.ts).
  ...KEYS_ABROAD_PROFILE_2026,
  // A lump sum from the 2nd pillar (pension fund, vested benefits) or pillar 3a, taxed apart at a
  // fifth of the scale (ge-na-law-lipp art. 45; ch-na-law-lifd art. 38, p. 32), declared at 98.12
  // (ge-2025-guide-declaration-pp p. 13): who received which (../engine/capital.ts). The amount, the
  // date and the reason are read on the attestation (./document-keys.ts).
  'profile.pension_capital': {
    type: 'enum_list',
    values: ['pillar2', 'pillar3a'],
    perPerson: true,
    label: { en: 'Pension capital received', fr: 'Prestations en capital reçues' },
    official: 'prestations en capital du 2e et 3e pilier A',
    source: 'ge-2025-guide-declaration-pp p. 13; ch-na-law-lifd art. 22 al. 1 (p. 17)',
  },
  // Planning inputs for "before 31 December" (SPEC.md section 8, group B). Rough figures the user
  // gives for an estimate; never filed.
  'plan.gross_salary': H['plan.gross_salary'],
  'plan.net_salary': H['plan.net_salary'],
  'plan.has_pension_fund': H['plan.has_pension_fund'],
  'plan.pillar3a_paid': H['plan.pillar3a_paid'],
  // Planning inputs for the pension fund buy-in, the 3a catch-up and TOU (SPEC.md section 8, groups
  // B and C): ./pension.ts, ./tou.ts. Never filed.
  'plan.lpp_buyin_capacity': H['plan.lpp_buyin_capacity'],
  'plan.lpp_buyin_amount': H['plan.lpp_buyin_amount'],
  'plan.pillar3a_paid_2025': H['plan.pillar3a_paid_2025'],
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
  // The securities list (état des titres), one instance per security: rules-ch, keys/securities.ts.
  ...KEYS_SECURITIES_2026,
  // Accounts, crypto, loans, life insurance, valuables and debts the user describes: keys-wealth.ts.
  ...KEYS_WEALTH_2026,
  // Values read from documents, one per document (./document-keys.ts).
  ...DOCUMENT_KEYS_2026,
  // Last year's figures from the prior-year declaration, for comparison only (./keys-prior.ts).
  ...KEYS_PRIOR_2026,
  // Bank accounts and liabilities from e-tax statements, one per account: rules-ch, keys/ech0196.ts.
  ...KEYS_ECH0196_2026,
} as const satisfies KeyRegistry;

export type Key2026 = keyof typeof KEYS_2026;
