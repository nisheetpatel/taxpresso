// Basel-Stadt's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with Basel-Stadt's own choices where its questions differ, and the answers only
// Basel-Stadt asks for (data/bs/2026/questionnaire.yaml, the engine's BaselCantonal): the commune of
// 31 December (Basel, Riehen or Bettingen, by name), the move, each person's work rate (form B) and
// whether they reached the AHV reference age, whether a single parent lives as a couple (main form
// p. 1, section 3), whether they mainly bear the upkeep of a child in shared custody, whether each
// child is under 18, each person's church membership, the childcare paid per child (form F) and
// payments to political parties (form Z).
import type { KeyDef, KeyRegistry } from '@taxpresso/ledger';
import {
  DOCUMENT_KEYS_WEALTH_2026,
  KEY_CHECK_NOTE_2026,
  KEYS_ATTESTATIONS_2026,
  KEYS_ECH0196_2026,
  KEYS_HOUSEHOLD_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  KEYS_SECURITIES_2026,
  KEYS_WEALTH_2026,
} from '@taxpresso/rules-ch';
import { communeByName, communesFor, slugOf } from './communes.js';
import { bsParamsFor } from './params.js';

const GUIDE = 'bs-2025-guide-wegleitung';
const FORM = 'bs-2025-form-hauptformular';
const FORM_B = 'bs-2025-form-b-berufskosten';
const FORM_K = 'bs-2025-form-kzf-krankheit-zuwendung-betreuung';
const STV = 'bs-na-law-stv';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("riehen"): no document gives Basel-Stadt's federal commune numbers. */
  slug: string;
  name: string;
}

/** Basel-Stadt's communes for the questionnaire, in the canton's table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("riehen"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!communeOptions(taxYear).some((o) => o.slug === value)) return undefined;
  return communeByName(taxYear, value)?.name;
}

const H = KEYS_HOUSEHOLD_2026;

/** German terms of the Basel-Stadt form for the values read from the attestations (document cards). */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': [
    'Gebundene Selbstvorsorge (Säule 3a)',
    `${FORM} p. 3 (620/625); ${GUIDE} p. 33`,
  ],
  'lpp.buyin': ['Berufliche Vorsorge (Pensionskasse)', `${FORM} p. 3 (610/615); ${GUIDE} p. 33`],
  'health.premiums': ['Versicherungsprämien', `${FORM} p. 3 (630/631); ${GUIDE} p. 35`],
  'health.subsidy': ['Prämienverbilligung', `${FORM} p. 3 (630/631); ${GUIDE} p. 35`],
  'medical.costs': ['Krankheits- und Unfallkosten', `${FORM_K} p. 1 (K); ${GUIDE} p. 37`],
  'childcare.costs': ['Kinderbetreuungskosten', `${FORM_K} p. 2 (F); ${GUIDE} p. 36`],
  'donation.amount': ['Zuwendungen', `${FORM_K} p. 2 (Z); ${GUIDE} p. 38`],
  'debt.interest': ['Schuldzinsen', `${FORM} p. 3 (550); ${GUIDE} p. 32`],
  'debt.balance': ['Privatschulden', `${FORM} p. 4 (870); ${GUIDE} p. 42`],
  'replacement.amount': ['Erwerbsausfallentschädigungen', `${FORM} p. 2 (260/265); ${GUIDE} p. 23`],
  'pension.amount': ['Renten und Pensionen', `${FORM} p. 2 (200 to 245); ${GUIDE} p. 22`],
};

function baselTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: term[1] } : def];
    }),
  );
}

/** Basel-Stadt's own keys for a tax year. */
function baselOwn(taxYear: number): KeyRegistry {
  const P = bsParamsFor(taxYear);
  const law = P.taxYear === 2025 ? 'bs-2025-law-stg' : 'bs-na-law-stg';
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  return {
    'profile.commune': choice({
      values: communeOptions(taxYear).map((c) => c.slug),
      perPerson: false,
      label: {
        en: 'Commune on 31 December',
        fr: 'Commune de domicile au 31 décembre',
        de: 'Wohngemeinde am 31. Dezember',
      },
      official: 'Gemeinde',
      source: `${P.communes.source}; ${GUIDE} p. 8 (Wohnsitzwechsel) and p. 9 (Steuerberechnung)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_basel', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 8 (Wohnsitzwechsel)`,
    }),
    'bs.work_rate': {
      type: 'integer',
      min: 1,
      max: 100,
      perPerson: true,
      label: {
        en: 'Work rate, in percent of full time',
        fr: 'Taux d’activité, en pour-cent d’un plein temps',
        de: 'Beschäftigungsgrad in Prozent',
      },
      official: 'Beschäftigungsgrad / Pensum in Prozent',
      source: `${FORM_B} p. 1 and 2; ${GUIDE} p. 30 (500/520 Pauschalabzug für Berufskosten)`,
    },
    'bs.reference_age': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Reached the AHV reference age by 31 December',
        fr: 'Âge de référence AVS atteint au 31 décembre',
        de: 'AHV-Referenzalter am 31. Dezember erreicht',
      },
      official: 'Referenzalter (Art. 21 Abs. 1 AHVG)',
      source: `${STV} § 43 (p. 12); ${GUIDE} p. 39 (770 Abzug für alleinstehende Rentner/innen)`,
    },
    'bs.cohabiting': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'A single parent living as a couple (Konkubinat)',
        fr: 'Parent seul vivant en couple (Konkubinat)',
        de: 'Alleinerziehend im Konkubinat',
      },
      official:
        'Leben Sie in einer Konkubinatspartnerschaft mit gemeinsamen / nicht gemeinsamen Kindern?',
      source: `${FORM} p. 1 (3. Alleinerziehende Personen mit Kindern); ${GUIDE} p. 39 (765)`,
    },
    'bs.main_upkeep': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Mainly bears the upkeep of the children in shared custody',
        fr: 'Assume principalement l’entretien des enfants en garde partagée',
        de: 'Kommt hauptsächlich für den Unterhalt der Kinder in geteilter Obhut auf',
      },
      official: 'zur Hauptsache für den Unterhalt aufkommen',
      source: `${STV} § 42 (p. 11); ${GUIDE} p. 39 (765)`,
    },
    'bs.child_minor': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Under 18 on 31 December',
        fr: 'Moins de 18 ans au 31 décembre',
        de: 'Am 31. Dezember unter 18',
      },
      official: 'Minderjährige Kinder',
      source: `${FORM} p. 1 (2. Minderjährige); ${law} § 49 al. 1 lit. c (p. 20); ${GUIDE} p. 43 (892)`,
    },
    'bs.church': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Member of a recognised church',
        fr: 'Membre d’une Église reconnue',
        de: 'Mitglied einer anerkannten Kirche',
      },
      official: 'Kirchensteuer',
      source: `${law} § 2a (p. 1)`,
    },
    'bs.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderbetreuungskosten',
      },
      official: 'Kinderbetreuungskosten',
      source: `${FORM_K} p. 2 (F); ${GUIDE} p. 36 (670)`,
    },
    'bs.party': {
      type: 'money',
      perPerson: false,
      label: {
        en: 'Paid to political parties',
        fr: 'Versé aux partis politiques',
        de: 'Beiträge an politische Parteien',
      },
      official: 'Beiträge an politische Parteien',
      source: `${FORM_K} p. 2 (Z); ${GUIDE} p. 36 (680)`,
    },
  };
}

/**
 * Every key of a Basel-Stadt return: the shared household keys (Basel-Stadt asks the way to work
 * without the length of the trip by public transport, which only Geneva's meal rule needs, and
 * payments to political parties apart from donations), Basel-Stadt's own, then the documents every
 * canton shares, with the Basel-Stadt form's German terms.
 */
export function bsKeys(taxYear: number): KeyRegistry {
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten',
      source: `${GUIDE} p. 30 (503/523); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${GUIDE} p. 30 (503/523); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'profile.payments': {
      ...H['profile.payments'],
      values: [...H['profile.payments'].values, 'political_party'],
    },
    ...baselOwn(taxYear),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...baselTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
