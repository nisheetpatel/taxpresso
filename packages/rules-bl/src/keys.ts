// Basel-Landschaft's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with Basel-Landschaft's own choices where its questions differ, and the answers only
// Basel-Landschaft asks for (data/bl/2026/questionnaire.yaml): the commune of 31 December (by name:
// the official table has no federal commune numbers), the move, each pensioner's kind of pension
// (AHV or IV, 770 and 771 from 2026), whether each child has taxable income of its own (the 2026
// form's column "stb. Einkommen vorhanden?"), who mainly bears a shared child's upkeep, each adult's
// church, and the childcare paid for each child (640, the limit is per child).
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
import { blParamsFor } from './params.js';

const LAW = 'bl-na-steuergesetz-331';
/** The guide and the return of the year (2026: the edition of 20 March 2026). */
const guide = (y: number) => `bl-${y === 2025 ? 2025 : 2026}-wegleitung`;
const form = (y: number) => `bl-${y === 2025 ? 2025 : 2026}-steuererklaerung-form`;

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("liestal", "burg-i-l"): the official table has no BFS number. */
  slug: string;
  name: string;
}

/** Basel-Landschaft's communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("liestal"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.name)?.name : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * German terms of the Basel-Landschaft return for the values read from the attestations (document
 * cards), with the page of the 2026 guide that explains each line.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Beiträge 3. Säule (610/615)', 'p. 30'],
  'lpp.buyin': ['Einkäufe 2. Säule / Beiträge (600/605)', 'p. 30'],
  'health.premiums': ['Versicherungsprämien und Zinsen von Sparkapitalien (620 bis 630)', 'p. 31'],
  'medical.costs': ['Krankheits- und Unfallkosten (720)', 'p. 35'],
  'childcare.costs': ['Kinderbetreuung durch Dritte (640)', 'p. 32'],
  'donation.amount': ['Freiwillige Zuwendungen (738)', 'p. 36'],
  'debt.interest': ['Private übrige Schuldzinsen (555)', 'p. 29'],
  'debt.balance': ['Private übrige Schulden (891)', 'p. 45'],
  'replacement.amount': ['Erwerbsausfallentschädigungen (260/270)', 'p. 17'],
  'pension.amount': ['Renten (200 bis 235)', 'p. 16'],
};

function blTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [
        k,
        term ? { ...def, official: term[0], source: `bl-2026-wegleitung ${term[1]}` } : def,
      ];
    }),
  );
}

/** Basel-Landschaft's own keys for a tax year. */
function blOwn(taxYear: number): KeyRegistry {
  const y = blParamsFor(taxYear).taxYear;
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  const TABLE = communesFor(y).source;
  return {
    'profile.commune': choice({
      values: communeOptions(y).map((c) => c.slug),
      perPerson: false,
      label: {
        en: 'Commune on 31 December',
        fr: 'Commune de domicile au 31 décembre',
        de: 'Wohngemeinde am 31. Dezember',
      },
      official: 'Gemeinde',
      source: `${TABLE}; ${guide(y)} p. 3 (Umzug innerhalb des Kantons Basel-Landschaft)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_bl', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${guide(y)} p. 3 and 4`,
    }),
    'bl.pension_kind': choice({
      values: ['ahv', 'iv', 'none'],
      perPerson: true,
      label: {
        en: 'Kind of AHV or IV pension',
        fr: 'Type de rente AVS ou AI',
        de: 'Art der AHV- oder IV-Rente',
      },
      official: 'Abzug für AHV-Rentnerinnen/Rentner (770), für IV-Rentnerinnen/Rentner (771)',
      source: `bl-2026-steuererklaerung-form p. 3 (770, 771); bl-2026-wegleitung p. 39 and 40`,
    }),
    'bl.child_income': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Child’s own taxable income above the tax-free amount',
        fr: 'Revenu imposable propre de l’enfant au-dessus du montant exonéré',
        de: 'Eigenes steuerbares Einkommen des Kindes über dem steuerfreien Betrag',
      },
      official: 'stb. Einkommen vorhanden?',
      source: `bl-2026-steuererklaerung-form p. 1; ${LAW} § 34 Abs. 4 (p. 28); bl-2026-wegleitung p. 37 (750)`,
    },
    'bl.main_upkeep': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Mainly bears the upkeep of the children in shared custody',
        fr: 'Assume l’essentiel de l’entretien des enfants en garde partagée',
        de: 'Bestreitet den Unterhalt der Kinder in gemeinsamer Sorge zur Hauptsache',
      },
      official: 'Kinder, deren Unterhalt Sie zur Hauptsache bestreiten',
      source: `${form(y)} p. 1; ${LAW} § 34 Abs. 4 (p. 28); bl-na-steuerbuch p. 211 to 213 (34 Nr. 1, Ziffer 5 and 7)`,
    },
    'bl.church': choice({
      values: ['catholic', 'reformed', 'christ_catholic', 'none'],
      perPerson: true,
      label: { en: 'Church', fr: 'Église', de: 'Konfession' },
      official: 'Konfession',
      source: `bl-2026-communal-steuerfuesse (Kirchensteuer: Röm.-kath., Evang.-ref. und Christ.kath. Kirche); bl-na-steuerbuch p. 229 (36 Nr. 1)`,
    }),
    'bl.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kosten der Kinderbetreuung durch Dritte',
      },
      official: 'Kinderbetreuung durch Dritte',
      source: `${form(y)} p. 1 (Wird das Kind fremdbetreut?) and p. 3 (640); ${LAW} § 29 Abs. 1 lit. c (p. 23); ${guide(y)} p. 32`,
    },
  };
}

/**
 * Every key of a Basel-Landschaft return: the shared household keys (Basel-Landschaft asks the way
 * to work without the length of the trip by public transport, which only Geneva's meal rule needs),
 * its own, then the documents every canton shares, with the return's German terms.
 */
export function blKeys(taxYear: number): KeyRegistry {
  const y = blParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
      source: `${guide(y)} p. 25 and 26 (500/505); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${guide(y)} p. 25 (500/505); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...blOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...blTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
