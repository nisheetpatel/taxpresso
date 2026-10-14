// Keys for a property in Geneva (annexe D), the simple case: the household's own home (a house, or a
// flat in PPE) or one property let all year in the commune where it lives, owned by one spouse or
// both. What the questions ask (the profile), the values read from its documents (one per document:
// the instance is the document id), and the household's own rough figures until those are in.
//
// The rules: the rental value is set by the AFC and sent each year before 31 March, the rents of a
// property let come with a management account (ge-na-revenu-immobilier-page); the tax value is the
// AFC's, in its letter or the avis de taxation immobilier (ge-na-valeur-fiscale-page; ge-na-law-lefi);
// the abattement for continuous use (ge-na-law-lipp art. 50 let. e); the upkeep costs, flat or actual
// (ge-2025-guide-declaration-pp p. 33 to 35; ge-na-information-1-2021-frais-entretien). The form's
// lines: ge-2025-declaration-specimen p. 15 (D1 15.10), p. 16 (D2 15.20), p. 19 (E1 55.20).
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';

const SPEC = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';
const INCOME = 'ge-na-revenu-immobilier-page (Votre bien est situé dans le canton de Genève)';
const VALUE = 'ge-na-valeur-fiscale-page (Votre bien est situé dans le canton de Genève)';
const UPKEEP = 'ge-na-information-1-2021-frais-entretien p. 2 to 5';
/** Up to CHF 100 million, in centimes. A sanity bound, not a tax constant. */
const MAX = 100_000_000_00;

/** A value read from one of the property's documents, in francs. */
const money = (label: KeyDef['label'], official: string, source: string): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson: false,
  multiple: true,
  label,
  official,
  source,
});

/** A rough figure the user gives until the documents are in, in francs (an estimate). */
const plan = (label: KeyDef['label'], official: string, source: string): KeyDef => ({
  type: 'money',
  min: 0,
  max: MAX,
  perPerson: false,
  label,
  official,
  source,
});

/** What the questions ask about the property (data/ge/2026/questionnaire.yaml). */
export const KEYS_PROPERTY_PROFILE_2026 = {
  'profile.swiss_property': {
    type: 'enum',
    values: ['own_house', 'own_flat', 'let', 'other_canton', 'several', 'other'],
    perPerson: false,
    label: { en: 'Your property in Switzerland', fr: 'Votre immeuble en Suisse' },
    official: 'immeubles occupés par le propriétaire (15.10), immeubles locatifs ou loués (15.20)',
    source: `${SPEC} p. 15 and 16; ${GUIDE} p. 32 to 35; ${INCOME}`,
  },
  'profile.swiss_property_owner': {
    type: 'enum',
    values: ['p1', 'p2', 'both', 'others'],
    perPerson: false,
    label: { en: 'Whose the property is', fr: 'À qui appartient l’immeuble' },
    official: 'part contribuable A / contribuable B',
    source: `${SPEC} p. 15 and 16; ${GUIDE} p. 32`,
  },
  'profile.swiss_property_since': {
    type: 'integer',
    min: 1900,
    max: 2026,
    perPerson: false,
    label: {
      en: 'The year you started living in your home as its owners',
      fr: 'L’année où vous avez commencé à occuper votre logement en tant que propriétaires',
    },
    official: 'occupé dès le (abattement)',
    source: `${SPEC} p. 15; ${GUIDE} p. 32 and 33; ge-na-law-lipp art. 50 let. e`,
  },
  'profile.swiss_property_old': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'The building was more than 10 years old on 1 January',
      fr: 'Le bâtiment avait plus de 10 ans au 1er janvier',
    },
    official: 'âge du bâtiment au 1er janvier',
    source: `${GUIDE} p. 33 and 35; ch-2026-ifd-instructions-personnes-physiques p. 6`,
  },
  'profile.swiss_property_special': {
    type: 'enum_list',
    values: ['moved', 'part_let', 'business', 'works', 'subsidy', 'carried', 'usufruct'],
    perPerson: false,
    label: {
      en: 'What Taxpresso can’t prepare yet about the property',
      fr: 'Ce que Taxpresso ne sait pas encore préparer pour l’immeuble',
    },
    official: 'immeubles (annexe D)',
    source: `${GUIDE} p. 32 to 36; ${UPKEEP}`,
  },
  'profile.swiss_property_loan': {
    type: 'boolean',
    perPerson: false,
    label: { en: 'A mortgage on the property', fr: 'Une hypothèque sur l’immeuble' },
    official: 'intérêts et dettes hypothécaires',
    source: `${GUIDE} p. 37; ${SPEC} p. 19`,
  },
  'profile.swiss_property_other_commune': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'The property let is in another commune than your home',
      fr: 'L’immeuble loué est dans une autre commune que votre domicile',
    },
    official: 'commune de situation (répartition intercommunale)',
    source: 'ge-na-law-lcp art. 293 let. A ch. 1 let. a, art. 295A al. 1 and 2',
  },
  // Until its documents are in: what the user says, in francs, flagged as an estimate (SPEC.md
  // section 9). Never filed.
  'plan.property_value': plan(
    {
      en: 'Your property’s tax value, roughly, as your last tax notice shows it',
      fr: 'Valeur fiscale approximative de votre immeuble, selon votre dernier avis',
    },
    'capital selon estimation fiscale',
    VALUE,
  ),
  'plan.property_rental_value': plan(
    {
      en: 'Your home’s rental value, roughly, as the AFC’s letter shows it',
      fr: 'Valeur locative approximative de votre logement, selon le courrier de l’AFC',
    },
    'valeur locative',
    INCOME,
  ),
  'plan.property_rent': plan(
    {
      en: 'Rent received this year from your property let, roughly',
      fr: 'Loyers encaissés cette année pour votre immeuble loué, environ',
    },
    'loyers encaissés',
    INCOME,
  ),
  'plan.mortgage_balance': plan(
    {
      en: 'What you owe on your mortgage, roughly, on 31 December',
      fr: 'Votre dette hypothécaire approximative au 31 décembre',
    },
    'dettes hypothécaires',
    `${GUIDE} p. 37`,
  ),
  'plan.mortgage_interest': plan(
    {
      en: 'Mortgage interest paid this year, roughly',
      fr: 'Intérêts hypothécaires payés cette année, environ',
    },
    'intérêts hypothécaires',
    `${GUIDE} p. 37`,
  ),
} as const satisfies KeyRegistry;

/** Values read from the property's documents, in francs. */
export const KEYS_PROPERTY_DOCUMENTS_2026 = {
  'property.tax_value': money(
    {
      en: 'Tax value of the property for the year (valeur fiscale, capital selon estimation fiscale)',
      fr: 'Valeur fiscale de l’immeuble pour l’année (capital selon estimation fiscale)',
    },
    'capital selon estimation fiscale',
    `${VALUE}; ${SPEC} p. 15 and 16`,
  ),
  'property.rental_value': money(
    {
      en: 'Rental value of the home for the year, before the abattement (valeur locative)',
      fr: 'Valeur locative du logement pour l’année, avant abattement',
    },
    'valeur locative brute',
    `${INCOME}; ${GUIDE} p. 33`,
  ),
  'property.parcel': {
    type: 'string',
    perPerson: false,
    multiple: true,
    label: {
      en: 'Cadastral commune and parcel number (commune cadastrale / numéro de parcelle)',
      fr: 'Commune cadastrale / numéro de parcelle',
    },
    official: 'commune cadastrale / numéro de parcelle',
    source: `${GUIDE} p. 32; ${SPEC} p. 15 and 16`,
  },
  'property.rents': money(
    { en: 'Rents received in the year', fr: 'Loyers encaissés dans l’année' },
    'loyers encaissés (compte de gestion)',
    `ge-na-revenu-immobilier-page (Si vous louez votre bien); ${GUIDE} p. 35`,
  ),
  'property.costs': money(
    {
      en: 'Upkeep, insurance and management costs paid in the year (not heating charges paid by the tenants, not taxes, not loan interest)',
      fr: 'Frais d’entretien, assurances et gérance payés dans l’année (sans chauffage à charge des locataires, impôts ni intérêts)',
    },
    'charges et frais d’entretien effectifs',
    `${GUIDE} p. 33 to 35; ${UPKEEP}`,
  ),
  'property.upkeep': money(
    {
      en: 'Deductible upkeep in the year: repairs that keep its value, energy-saving work, building insurance, the impôt immobilier complémentaire billed, the PPE renovation fund and common parts (not heating, hot water or works that add value)',
      fr: 'Frais d’entretien déductibles de l’année : réparations qui maintiennent sa valeur, économies d’énergie, assurance du bâtiment, impôt immobilier complémentaire facturé, fonds de rénovation et parties communes PPE (sans chauffage, eau chaude ni travaux à plus-value)',
    },
    'frais d’entretien effectifs (ECO et ENT)',
    `${GUIDE} p. 33 and 34; ${UPKEEP}; ${SPEC} p. 18`,
  ),
} as const satisfies KeyRegistry;

export type PropertyDocumentKey = keyof typeof KEYS_PROPERTY_DOCUMENTS_2026;

/**
 * Which values each kind of document gives: the AFC's letter or avis de taxation immobilier (tax
 * value, rental value, parcel), the management account of a property let (rents, costs), the
 * upkeep invoices and the PPE charges statement (the deductible upkeep). The mortgage statement gives
 * the debt and the interest, like any loan statement (./document-keys.ts).
 */
export const PROPERTY_FIELDS_2026 = {
  property_values: ['property.tax_value', 'property.rental_value', 'property.parcel'],
  property_rent_statement: ['property.rents', 'property.costs'],
  property_upkeep_invoices: ['property.upkeep'],
  ppe_charges_statement: ['property.upkeep'],
} as const satisfies Partial<Record<DocumentKind, readonly PropertyDocumentKey[]>>;
