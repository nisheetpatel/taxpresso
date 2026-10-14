// Keys for self-employment in Geneva (annexe B, activité lucrative indépendante), the simple case:
// a sole proprietor (raison individuelle) with one business in their commune of residence. What the
// questions ask (the profile), the values read from the business's accounts and from the AVS
// statements (one per document: the instance is the document id), and the planning figure for the
// 3a room. Codes and labels as printed on the form (ge-2025-declaration-specimen p. 7 to 10, B1 to
// B4), the rules in the guide for the self-employed (ge-2025-guide-independants) and the main guide
// (ge-2025-guide-declaration-pp p. 23 and 24).
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';

const SPEC = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-independants';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

/** A value of the accounts: money, per person, one per document. */
const line = (
  code: string,
  label: KeyDef['label'],
  official: string,
  guidePage: number,
): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson: true,
  multiple: true,
  label,
  official: `${code} ${official}`,
  source: `${SPEC} p. ${code.startsWith('32') ? 10 : 8}; ${GUIDE} p. ${guidePage}`,
});

/** What the questions ask about the business, per person (data/ge/2026/questionnaire.yaml). */
export const KEYS_BUSINESS_PROFILE_2026 = {
  'profile.business_form': {
    type: 'enum',
    values: ['sole_proprietor', 'partnership'],
    perPerson: true,
    label: { en: 'How the business is organised', fr: 'Nature juridique de l’activité' },
    official:
      'nature juridique (raison individuelle, société simple, en nom collectif, en commandite)',
    source: `${SPEC} p. 7; ${GUIDE} p. 3 and 11`,
  },
  'profile.business_method': {
    type: 'enum',
    values: ['invoice', 'cash'],
    perPerson: true,
    label: { en: 'Accounting method', fr: 'Méthode de comptabilisation' },
    official:
      'méthode de comptabilisation (méthode à la facturation, méthode de l’encaissement-décaissement)',
    source: `${SPEC} p. 7; ${GUIDE} p. 8, 11 and 22`,
  },
  'profile.business_year': {
    type: 'enum',
    values: ['calendar', 'other_closing', 'started', 'no_closing', 'two_closings', 'stopped'],
    perPerson: true,
    label: { en: 'The business year', fr: 'L’exercice comptable' },
    official: 'exercice comptable; début / fin de l’activité indépendante',
    source: `${SPEC} p. 7; ${GUIDE} p. 8, 9, 11 and 12; ge-na-law-lipp art. 62 al. 2, art. 63`,
  },
  'profile.business_place': {
    type: 'enum',
    values: ['home_commune', 'other_commune', 'outside_geneva'],
    perPerson: true,
    label: { en: 'Where the business is', fr: 'Lieu de l’activité' },
    official: 'adresse principale de l’activité professionnelle; code commune',
    source: `${SPEC} p. 7; ${GUIDE} p. 11; ge-na-law-lcp art. 295A`,
  },
  'profile.business_special': {
    type: 'enum_list',
    values: [
      'real_estate',
      'vat',
      'transfer',
      'reserves',
      'method_change',
      'own_pension',
      'spouse_works',
      'private_costs',
      'avs_provision',
      'participations',
      'several',
    ],
    perPerson: true,
    label: {
      en: 'Special situations of the business',
      fr: 'Situations particulières de l’activité',
    },
    source: GUIDE,
  },
  'profile.business_losses': {
    type: 'boolean',
    perPerson: true,
    label: {
      en: 'Business losses of earlier years not deducted yet',
      fr: 'Pertes commerciales d’années précédentes pas encore déduites',
    },
    official: 'pertes non compensées',
    source: `${SPEC} p. 8 (57.20); ${GUIDE} p. 16`,
  },
  // The losses themselves, as the last assessment shows them, for each tax (57.20, B2).
  'business.losses_icc': {
    type: 'money',
    min: 0,
    max: MAX,
    perPerson: true,
    label: {
      en: 'Losses not deducted yet, Geneva tax (ICC)',
      fr: 'Pertes non compensées, impôt cantonal (ICC)',
    },
    official: '57.20 Pertes non compensées (ICC)',
    source: `${SPEC} p. 8; ${GUIDE} p. 16; ge-na-law-lipp art. 30 let. f`,
  },
  'business.losses_ifd': {
    type: 'money',
    min: 0,
    max: MAX,
    perPerson: true,
    label: {
      en: 'Losses not deducted yet, federal tax (IFD)',
      fr: 'Pertes non compensées, impôt fédéral (IFD)',
    },
    official: '57.20 Pertes non compensées (IFD)',
    source: `${SPEC} p. 8; ${GUIDE} p. 16; ch-na-law-lifd art. 31 al. 1 (p. 23)`,
  },
  // Planning "before 31 December": the year's expected result, for the 3a room without a pension
  // fund (SPEC.md section 8, group B). Never filed.
  'plan.business_profit': {
    type: 'money',
    min: 0,
    max: MAX,
    perPerson: true,
    label: {
      en: 'Expected profit of your business this year, after your AVS contributions',
      fr: 'Bénéfice attendu de votre activité cette année, après vos cotisations AVS',
    },
    official: 'revenu déterminant (bénéfice net moins cotisations AVS/AI, APG, AF, Amat)',
    source: `${GUIDE} p. 23 (32.40)`,
  },
} as const satisfies KeyRegistry;

/** Values read from the business's accounts or simple records, and from the AVS statements. */
export const KEYS_BUSINESS_DOCUMENTS_2026 = {
  'business.name': {
    type: 'string',
    perPerson: true,
    multiple: true,
    label: { en: 'Name of the business', fr: 'Nom et/ou raison sociale' },
    official: 'Nom et /ou raison sociale de l’activité professionnelle',
    source: `${SPEC} p. 7; ${GUIDE} p. 10`,
  },
  'business.period_from': {
    type: 'date',
    perPerson: true,
    multiple: true,
    label: { en: 'Business year from', fr: 'Exercice comptable du' },
    official: 'Exercice comptable du',
    source: `${SPEC} p. 7; ${GUIDE} p. 9 and 11`,
  },
  'business.period_to': {
    type: 'date',
    perPerson: true,
    multiple: true,
    label: { en: 'Business year to', fr: 'Exercice comptable au' },
    official: 'Exercice comptable au',
    source: `${SPEC} p. 7; ${GUIDE} p. 9 and 11`,
  },
  'business.turnover': line(
    '12.08',
    { en: 'Turnover: fees, sales', fr: 'Chiffre d’affaires brut' },
    'Chiffre d’affaires brut',
    12,
  ),
  'business.benefits': line(
    '12.09',
    { en: 'Benefits received for lost earnings', fr: 'Indemnités pour pertes de gains reçues' },
    'Indemnités pour pertes de gains reçues',
    12,
  ),
  'business.financial_income': line(
    '12.15',
    { en: 'Financial income of the business', fr: 'Produits financiers' },
    'Produits financiers',
    12,
  ),
  'business.other_income': line(
    '12.16',
    { en: 'Other income of the business', fr: 'Autres produits' },
    'Autres produits',
    13,
  ),
  'business.costs_goods': line(
    '12.21',
    {
      en: 'Materials, goods and services bought',
      fr: 'Charges de matières, marchandises et services',
    },
    'Charges de matières premières, de marchandises et de services',
    13,
  ),
  'business.costs_staff': line(
    '12.22',
    {
      en: 'Staff costs (not your own pay)',
      fr: 'Charges du personnel (sans votre propre salaire)',
    },
    'Charges du personnel',
    13,
  ),
  'business.depreciation': line(
    '12.23',
    { en: 'Depreciation', fr: 'Amortissements' },
    'Amortissements',
    14,
  ),
  'business.provisions': line('12.24', { en: 'Provisions', fr: 'Provisions' }, 'Provisions', 14),
  'business.interest': line(
    '12.41',
    { en: 'Interest on business debts', fr: 'Intérêts de dettes commerciales' },
    'Intérêts de dettes',
    14,
  ),
  'business.costs_other': line(
    '12.42',
    { en: 'Overheads and other operating costs', fr: 'Frais généraux et autres charges' },
    'Frais généraux et autres charges d’exploitation',
    15,
  ),
  'business.current_assets': line(
    '12.48',
    { en: 'Current assets on the closing date', fr: 'Actifs circulants à la clôture' },
    'Actifs circulants',
    17,
  ),
  'business.fixed_assets': line(
    '12.49',
    { en: 'Fixed assets on the closing date', fr: 'Actifs immobilisés à la clôture' },
    'Actifs immobilisés',
    17,
  ),
  'business.liabilities': line(
    '57.50',
    { en: 'Business debts on the closing date', fr: 'Passifs commerciaux (dettes) à la clôture' },
    'Passifs commerciaux (dettes)',
    17,
  ),
  'avs.contributions_year': line(
    '32.10',
    {
      en: 'Your own AVS/AI/APG contributions for the business year',
      fr: 'Vos acomptes AVS/AI, APG, AF, AMat pour l’exercice',
    },
    'Acompte(s) AVS/AI, APG, AF, AMat de l’exploitant versés',
    22,
  ),
  'avs.contributions_earlier': line(
    '32.11',
    {
      en: 'Further AVS/AI/APG contributions after final decisions for earlier years',
      fr: 'Cotisations complémentaires AVS/AI, APG, AF, AMat selon les décisions de l’année',
    },
    'Cotisations complémentaires AVS/AI, APG, AF, AMat de l’exploitant',
    22,
  ),
} as const satisfies KeyRegistry;

export type BusinessDocumentKey = keyof typeof KEYS_BUSINESS_DOCUMENTS_2026;

/**
 * Which values each kind of document gives: the accounts (bilan et compte de résultat) or the simple
 * records (relevé des recettes et dépenses, état des actifs et passifs), and the statements of the
 * AVS compensation fund (ge-2025-guide-independants p. 6 and 25).
 */
export const BUSINESS_FIELDS_2026 = {
  business_accounts: [
    'business.name',
    'business.period_from',
    'business.period_to',
    'business.turnover',
    'business.benefits',
    'business.financial_income',
    'business.other_income',
    'business.costs_goods',
    'business.costs_staff',
    'business.depreciation',
    'business.provisions',
    'business.interest',
    'business.costs_other',
    'business.current_assets',
    'business.fixed_assets',
    'business.liabilities',
  ],
  avs_contributions: ['avs.contributions_year', 'avs.contributions_earlier'],
} as const satisfies Partial<Record<DocumentKind, readonly BusinessDocumentKey[]>>;
