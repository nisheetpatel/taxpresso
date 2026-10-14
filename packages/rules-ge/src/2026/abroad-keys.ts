// Keys for a home or land abroad (immeuble à l'étranger) in Geneva, the simple case: one property
// abroad, owned by one spouse or both, used by the household, let to tenants, or land. What the
// questions ask (the profile), the values read from the country's tax notice, the deed and the
// management account (one per document: the instance is the document id), the household's own
// rough figures until those are in, and the currency of a loan statement abroad.
//
// Amounts abroad are kept as printed, in the property's currency, and converted by Taxpresso at
// the official rate (rules-ch, withholding/exchange-rates.ts), never by Claude: the value at the
// rate of 31 December (ge-na-valeur-fiscale-page; ge-2025-guide-declaration-pp p. 33), income at
// the year's average rate (ge-2025-taux-donnees-fiscales).
//
// The rules: the property is declared on annexe D, like any property (ge-2025-guide-declaration-pp
// p. 32: "sis à Genève, en Suisse ou à l'étranger"); its rental value, by country, and its rents
// (ge-na-revenu-immobilier-page); its tax value (ge-na-valeur-fiscale-page). The form's lines:
// ge-2025-declaration-specimen p. 15 and 16 (D1 15.10, D2 15.20).
import type { DocumentKind, KeyDef, KeyRegistry } from '@taxpresso/ledger';

const SPEC = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';
const INCOME = 'ge-na-revenu-immobilier-page (Votre bien est situé à l’étranger)';
const VALUE = 'ge-na-valeur-fiscale-page (Votre bien est situé à l’étranger)';

/** The countries asked by name, for the form's Situation ("nom du pays") and France's rule. */
export const ABROAD_COUNTRIES = [
  'france',
  'italy',
  'spain',
  'portugal',
  'germany',
  'united_kingdom',
  'united_states',
  'other',
] as const;
export type AbroadCountry = (typeof ABROAD_COUNTRIES)[number];

/** A printed amount in the property's currency, one per document. */
const printed = (label: KeyDef['label'], official: string, source: string): KeyDef => ({
  type: 'string',
  perPerson: false,
  multiple: true,
  label,
  official,
  source,
});

/** What the questions ask about the property (data/ge/2026/questionnaire.yaml). */
export const KEYS_ABROAD_PROFILE_2026 = {
  'profile.abroad_property': {
    type: 'enum',
    values: ['own_use', 'let', 'land', 'several', 'other'],
    perPerson: false,
    label: { en: 'Your property abroad and how it is used', fr: 'Votre immeuble à l’étranger' },
    official: 'immeubles occupés par le propriétaire (15.10), immeubles locatifs ou loués (15.20)',
    source: `${SPEC} p. 15 and 16; ${GUIDE} p. 32 to 35; ${INCOME}`,
  },
  'profile.abroad_property_owner': {
    type: 'enum',
    values: ['p1', 'p2', 'both', 'others'],
    perPerson: false,
    label: { en: 'Whose the property abroad is', fr: 'À qui appartient l’immeuble à l’étranger' },
    official: 'part contribuable A / contribuable B',
    source: `${SPEC} p. 15; ${GUIDE} p. 32`,
  },
  'profile.abroad_property_country': {
    type: 'enum',
    values: ABROAD_COUNTRIES,
    perPerson: false,
    label: { en: 'Country of the property abroad', fr: 'Pays de l’immeuble à l’étranger' },
    official: 'situation (nom du pays)',
    source: `${GUIDE} p. 32; ${INCOME}`,
  },
  'profile.abroad_property_old': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'The building was more than 10 years old on 1 January',
      fr: 'Le bâtiment avait plus de 10 ans au 1er janvier',
    },
    official: 'âge du bâtiment au 1er janvier',
    source: `${GUIDE} p. 33 and 35; ch-2026-ifd-instructions-personnes-physiques p. 6`,
  },
  'profile.abroad_property_loan': {
    type: 'boolean',
    perPerson: false,
    label: {
      en: 'A loan or mortgage on the property abroad',
      fr: 'Un emprunt ou une hypothèque sur l’immeuble à l’étranger',
    },
    official: 'intérêts et dettes hypothécaires',
    source: `${GUIDE} p. 37; ${SPEC} p. 19; ge-na-law-lipp art. 57`,
  },
  // Until its documents are in: what the user says, in the property's currency ("250000 EUR"),
  // flagged as an estimate (SPEC.md section 9). Never filed.
  'plan.abroad_value': {
    type: 'string',
    perPerson: false,
    label: {
      en: 'What your property abroad is worth, roughly, with its currency',
      fr: 'Valeur approximative de votre immeuble à l’étranger, avec sa monnaie',
    },
    official: 'valeur fiscale ou prix d’achat',
    source: VALUE,
  },
  'plan.abroad_rent': {
    type: 'string',
    perPerson: false,
    label: {
      en: 'Rent received this year from your property abroad, roughly, with its currency',
      fr: 'Loyers encaissés cette année pour votre immeuble à l’étranger, environ, avec leur monnaie',
    },
    official: 'loyers encaissés',
    source: INCOME,
  },
} as const satisfies KeyRegistry;

/** Values read from the documents of the property abroad, as printed (in its currency). */
export const KEYS_ABROAD_DOCUMENTS_2026 = {
  'abroad.currency': {
    type: 'string',
    perPerson: false,
    multiple: true,
    label: {
      en: 'Currency of the amounts (EUR, GBP, USD...)',
      fr: 'Monnaie des montants (EUR, GBP, USD...)',
    },
    official: 'monnaie étrangère, convertie en francs suisses',
    source: `${VALUE}; ${GUIDE} p. 33`,
  },
  'abroad.tax_value': printed(
    {
      en: 'Tax value set by the country (valeur fiscale)',
      fr: 'Valeur fiscale fixée par le pays',
    },
    'capital selon estimation fiscale (attestation de valeur fiscale)',
    `${VALUE}; ${SPEC} p. 15`,
  ),
  'abroad.purchase_price': printed(
    { en: 'Purchase price, on the deed', fr: 'Prix d’achat, selon l’acte d’acquisition' },
    'prix d’achat (acte d’acquisition)',
    `${VALUE}; ${GUIDE} p. 32`,
  ),
  'abroad.rental_value': printed(
    {
      en: 'Rental value set by the country (France: “Base d’imposition (valeur locative brute)” of the taxe d’habitation)',
      fr: 'Valeur locative fixée par le pays (France : « Base d’imposition (valeur locative brute) » de la taxe d’habitation)',
    },
    'valeur locative brute (attestation de valeur locative)',
    `${INCOME}; ${GUIDE} p. 33`,
  ),
  'abroad.land_tax_base': printed(
    {
      en: 'France, taxes foncières: the “Base” line, “Commune” column',
      fr: 'France, taxes foncières : la ligne « Base », colonne « Commune »',
    },
    'taxes foncières, ligne Base, colonne Commune (x 2 = valeur locative)',
    INCOME,
  ),
  'abroad.rents': printed(
    { en: 'Rents received in the year', fr: 'Loyers encaissés dans l’année' },
    'loyers encaissés (compte de gestion)',
    `${INCOME}; ${GUIDE} p. 35`,
  ),
  'abroad.costs': printed(
    {
      en: 'Upkeep, insurance and management costs paid in the year (not taxes, not loan interest)',
      fr: 'Frais d’entretien, assurances et gérance payés dans l’année (sans impôts ni intérêts)',
    },
    'charges et frais d’entretien effectifs',
    `${GUIDE} p. 33 to 35`,
  ),
  // A loan abroad (a mortgage on the property): its statement's amounts in its currency, converted
  // by Taxpresso like a bank account's (ge-2025-guide-declaration-pp p. 37, annexe E).
  'debt.currency': {
    type: 'string',
    perPerson: false,
    multiple: true,
    label: { en: 'Currency of the loan', fr: 'Monnaie de l’emprunt' },
    official: 'dette en monnaie étrangère',
    source: `${GUIDE} p. 37`,
  },
  'debt.balance_in_currency': printed(
    {
      en: 'Debt on 31 December, in the loan’s currency',
      fr: 'Dette au 31 décembre, dans la monnaie de l’emprunt',
    },
    'dettes chirographaires et hypothécaires, converties au cours du 31 décembre',
    `${GUIDE} p. 37; ${SPEC} p. 19`,
  ),
  'debt.interest_in_currency': printed(
    {
      en: 'Interest paid in the year, in the loan’s currency',
      fr: 'Intérêts payés dans l’année, dans la monnaie de l’emprunt',
    },
    'intérêts chirographaires et hypothécaires, convertis au cours moyen',
    `${GUIDE} p. 37; ${SPEC} p. 19`,
  ),
} as const satisfies KeyRegistry;

export type AbroadDocumentKey = keyof typeof KEYS_ABROAD_DOCUMENTS_2026;

/**
 * Which values each kind of document gives: the country's tax notice or attestation (tax value,
 * rental value; in France the taxe d'habitation or taxes foncières), the deed of purchase, the
 * management account of a property let abroad, and a loan statement in another currency.
 */
export const ABROAD_FIELDS_2026 = {
  foreign_property_tax_notice: [
    'abroad.currency',
    'abroad.tax_value',
    'abroad.rental_value',
    'abroad.land_tax_base',
  ],
  foreign_property_deed: ['abroad.currency', 'abroad.purchase_price'],
  foreign_property_rent_statement: ['abroad.currency', 'abroad.rents', 'abroad.costs'],
} as const satisfies Partial<Record<DocumentKind, readonly AbroadDocumentKey[]>>;

/** A loan statement's values in its own currency, for a loan abroad. */
export const DEBT_CURRENCY_FIELDS_2026 = [
  'debt.currency',
  'debt.balance_in_currency',
  'debt.interest_in_currency',
] as const satisfies readonly AbroadDocumentKey[];
