// Zug's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch, keys/),
// with Zug's own choices where its questions differ, and the answers only Zug asks for
// (data/zg/2026/questionnaire.yaml), as ./canton.ts (ZugCantonal) reads them: the commune of 31
// December (by name: the official table has no federal commune numbers), the move, whether each
// child was under 15 on 31 December and a minor, who has the larger share of a shared child's care,
// the net rent (Mietzinsabzug, 407), each adult's parish and Bürgergemeinde, and the childcare paid
// for each child (253: the limit is per child).
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
import { zgParamsFor } from './params.js';

/** The guide: the 2025 one for both years, the 2026 guide is not published yet. */
const GUIDE = 'zg-2025-guide-wegleitung';
const law = (y: number) => `zg-${y === 2025 ? 2025 : 2026}-law-steuergesetz`;
const ORD = 'zg-na-law-verordnung-steuergesetz';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("zug", "oberageri"): the official table has no BFS number. */
  slug: string;
  name: string;
}

/** Zug's 11 communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("oberageri"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.name)?.name : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * German terms of Zug's form K for the values read from the attestations (document cards), with the
 * page of the 2025 guide that explains each line.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Beiträge gebundene Vorsorge, Säule 3a (220/221)', 'p. 36'],
  'lpp.buyin': ['Beiträge an die 2. Säule, Einkaufsbeiträge (250/251)', 'p. 37'],
  'health.premiums': ['Versicherungsprämien und Zinsen von Sparkapitalien (230)', 'p. 37'],
  'medical.costs': ['Krankheits- und Unfallkosten (295)', 'p. 40'],
  'childcare.costs': ['Kinderdrittbetreuungskostenabzug (253)', 'p. 38'],
  'donation.amount': ['Gemeinnützige Zuwendungen (296)', 'p. 41'],
  'debt.interest': ['Private Schuldzinsen (205)', 'p. 34 and 35'],
  'debt.balance': ['Privatschulden (640)', 'p. 45'],
  'replacement.amount': [
    'Erwerbsausfallentschädigungen, Taggelder aus Arbeitslosenversicherung (145 bis 151)',
    'p. 22',
  ],
  'pension.amount': ['AHV-/IV-Renten, Renten/Pensionen (130 bis 136)', 'p. 22'],
};

function zgTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: `${GUIDE} ${term[1]}` } : def];
    }),
  );
}

/** Zug's own keys for a tax year. */
function zgOwn(taxYear: number): KeyRegistry {
  const y = zgParamsFor(taxYear).taxYear;
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  const TABLE = communesFor(y).source;
  const communes = communeOptions(y).map((c) => c.slug);
  return {
    'profile.commune': choice({
      values: communes,
      perPerson: false,
      label: {
        en: 'Commune on 31 December',
        fr: 'Commune de domicile au 31 décembre',
        de: 'Wohngemeinde am 31. Dezember',
      },
      official: 'Gemeinde',
      source: `${TABLE}; ${law(y)} § 171 Abs. 1 (p. 84)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_zg', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 9 (Wegzug aus dem Kanton Zug, Wegzug ins Ausland), p. 24 (unterjährige Steuerpflicht; Zuzug aus einem anderen Kanton)`,
    }),
    'zg.child_under15': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Under 15 on 31 December',
        fr: 'Moins de 15 ans au 31 décembre',
        de: 'Am 31. Dezember jünger als 15 Jahre',
      },
      official: 'Eigenbetreuungsabzug (404), Kinderabzug Zusatz (403a)',
      source: `${law(y)} § 33 Abs. 1 Ziff. 2 and Abs. 2 (p. 25); ${GUIDE} p. 41 (Code 403, 403a, 404)`,
    },
    'zg.child_minor': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'A minor (under 18) on 31 December',
        fr: 'Mineur (moins de 18 ans) au 31 décembre',
        de: 'Am 31. Dezember minderjährig (unter 18)',
      },
      official: 'Steuerfreier Betrag für jedes minderjährige Kind (673)',
      source: `${law(y)} § 44 Abs. 1 (p. 30); ${GUIDE} p. 45 (Code 673)`,
    },
    'zg.main_care': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Has the larger share of the care of the children in shared custody',
        fr: 'Assume la plus grande part de la garde des enfants en garde partagée',
        de: 'Hat den grösseren Anteil an der Betreuung der Kinder in gemeinsamer Obhut',
      },
      official: 'überwiegender Anteil an der tatsächlichen Betreuung',
      source: `${ORD} § 18 Abs. 2 and 3 (p. 6); ${GUIDE} p. 13`,
    },
    'zg.rent': {
      type: 'money',
      perPerson: false,
      label: {
        en: 'Net rent of your home in Zug, without service charges',
        fr: 'Loyer net de votre logement à Zoug, sans les charges',
        de: 'Wohnungsmiete in Zug ohne Nebenkosten',
      },
      official: 'Mietzinsabzug (407)',
      source: `${law(y)} § 33 Abs. 1 Ziff. 5 (p. 25); ${GUIDE} p. 42 (Code 407)`,
    },
    'zg.church': choice({
      values: ['catholic', 'reformed', 'none'],
      perPerson: true,
      label: { en: 'Parish', fr: 'Paroisse', de: 'Kirchgemeinde' },
      official: 'Kirchgemeinde',
      source: `${law(y)} § 1 Abs. 1 (p. 1), § 169 Abs. 1 (p. 84); ${TABLE}`,
    }),
    'zg.citizen_of': choice({
      values: [...communes, 'none'],
      perPerson: true,
      label: {
        en: 'Ortsbürger (citizen) of a Zug commune',
        fr: 'Bourgeois (Ortsbürger) d’une commune zougoise',
        de: 'Ortsbürger einer Zuger Gemeinde',
      },
      official: 'Bürgergemeinde',
      source: `${law(y)} § 170 Abs. 1 to 3 (p. 84); ${TABLE}`,
    }),
    'zg.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderdrittbetreuungskosten',
      },
      official: 'Kinderdrittbetreuungskostenabzug (KDBK)',
      source: `${law(y)} § 30 Abs. 1 Bst. l (p. 23), § 33 Abs. 2bis (p. 25); ${GUIDE} p. 38 (Code 253, Formular KDBK)`,
    },
  };
}

/**
 * Every key of a Zug return: the shared household keys (Zug asks the way to work without the length
 * of the trip by public transport, which only Geneva's meal rule needs), its own, then the documents
 * every canton shares, with form K's German terms.
 */
export function zgKeys(taxYear: number): KeyRegistry {
  const y = zgParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten zwischen Wohn- und Arbeitsort',
      source: `${GUIDE} p. 32 (Code 201, 202, 2) Fahrkosten zwischen Wohn- und Arbeitsort); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${GUIDE} p. 32 (Grundsätzlich werden nur die Fahrkosten für die öffentlichen Verkehrsmittel anerkannt); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...zgOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...zgTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
