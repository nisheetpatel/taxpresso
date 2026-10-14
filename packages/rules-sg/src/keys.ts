// St. Gallen's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with St. Gallen's own choices where its questions differ, and the answers only St. Gallen
// asks for (data/sg/2026/questionnaire.yaml), as ./canton.ts (StGallenCantonal) reads them: the
// commune of 31 December (by name: the official table has no federal commune numbers), the move,
// each child's stage (not yet of school age, or in school or training) and whether a minor, its
// education costs and scholarships and the childcare paid for it, who mainly bears a shared child's
// upkeep, each adult's church, and the church area where the commune's areas levy different rates.
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
import { communeByName, communesFor, slugOf, type SgCommune } from './communes.js';
import { communeAtYearEnd } from './law.js';
import { sgParamsFor } from './params.js';

/** The guide: the 2025 one for both years, the 2026 guide is not published yet. */
const GUIDE = 'sg-2025-guide-wegleitung';
const law = (y: number) => `sg-${y === 2025 ? 2025 : 2026}-law-steuergesetz`;
const ORD = 'sg-na-law-steuerverordnung';
const FORM10 = 'sg-na-form-ausbildungs-kinderbetreuungskosten';
const FORM4 = 'sg-2025-form-berufskosten';
const CHILD = 'sg-na-deductions-kinderabzug';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("st-gallen", "rapperswil-jona"): the official table has no BFS number. */
  slug: string;
  name: string;
}

/** St. Gallen's 75 political communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("st-gallen"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.name)?.name : undefined;
}

/** The two churches whose rate a church area sets (the Christ Catholic rate is the canton's). */
export type AreaChurch = 'catholic' | 'reformed';

/** A church area the questionnaire offers, in a commune whose areas levy different rates. */
export interface AreaOption {
  /** The value stored for sg.church_area: "<commune slug>:<the area's name in the table>". */
  value: string;
  /** The commune's slug and name. */
  slug: string;
  commune: string;
  /** The area's name as the canton's table prints it. */
  area: string;
  /** The churches whose rate (or footnote) differs between the commune's areas. */
  churches: readonly AreaChurch[];
}

/** The churches whose rate or footnote differs between a commune's areas (./communes.ts, churchRate). */
function differing(c: SgCommune): AreaChurch[] {
  return (['catholic', 'reformed'] as const).filter(
    (f) =>
      new Set(c.areas.map((a) => a[f])).size > 1 ||
      new Set(c.areas.map((a) => a.notes?.[f])).size > 1,
  );
}

/**
 * The church areas of the communes whose areas levy different rates for a church (the canton's
 * table of multipliers, one row per area): asked only there, and only of a member of a church whose
 * rate differs.
 */
export function areaOptions(taxYear: number): AreaOption[] {
  const out: AreaOption[] = [];
  for (const c of communesFor(taxYear).value) {
    if (c.areas.length < 2) continue;
    const churches = differing(c);
    if (!churches.length) continue;
    const slug = slugOf(c.name);
    for (const a of c.areas) {
      out.push({ value: `${slug}:${a.name}`, slug, commune: c.name, area: a.name, churches });
    }
  }
  return out;
}

/** The church area of the stored answer ("st-gallen:St. Gallen Tablat (O)"), when it is the commune's. */
export function areaOfAnswer(taxYear: number, value: unknown, commune: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = areaOptions(taxYear).find((o) => o.value === value);
  return option && option.commune === commune ? option.area : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * Official terms of the St. Gallen return for the values read from the attestations (document
 * cards), with the page of the 2025 guide that explains each line.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Säule 3a (13.1)', 'p. 26'],
  'lpp.buyin': ['Säule 2 (BVG) inkl. Einkaufsbeiträge (13.2)', 'p. 26'],
  'health.premiums': ['Versicherungsprämien und Sparzinsen (14., Formular 6)', 'p. 27'],
  'medical.costs': ['Krankheits- und Unfallkosten (21.1, Formular 6)', 'p. 29'],
  'childcare.costs': ['Kinderbetreuungskosten bei Drittbetreuung (16.2, Formular 10)', 'p. 28'],
  'donation.amount': ['Freiwillige Zuwendungen (21.3, Formular 5)', 'p. 30'],
  'debt.interest': ['Schuldzinsen (11., Formular 5)', 'p. 25'],
  'debt.balance': ['Privatschulden (34.1, Formular 5)', 'p. 34'],
  'replacement.amount': ['Erwerbsausfallentschädigung, Arbeitslosen-Taggelder (3.3, 3.4)', 'p. 19'],
  'pension.amount': ['AHV/IV-Renten, Renten/Pensionen (3.1, 3.2)', 'p. 18'],
};

function sgTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: `${GUIDE} ${term[1]}` } : def];
    }),
  );
}

/** St. Gallen's own keys for a tax year. */
function sgOwn(taxYear: number): KeyRegistry {
  const y = sgParamsFor(taxYear).taxYear;
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
      official: 'Politische Gemeinde',
      source: `${TABLE}; ${communeAtYearEnd(y).source}`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_sg', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 11 (Zuzug aus einem anderen Kanton, Zuzug aus dem Ausland, Wegzug ins Ausland); ${law(y)} Art. 233 Abs. 1 (p. 90)`,
    }),
    'sg.child_stage': choice({
      values: ['preschool', 'school'],
      perPerson: true,
      label: {
        en: 'Not yet of school age, or in school or training',
        fr: 'Pas encore en âge scolaire, ou à l’école ou en formation',
        de: 'Im Vorschulalter, oder in Schule oder Ausbildung',
      },
      official: 'Kinderabzug (23.1, 23.2)',
      source: `${law(y)} Art. 48 Abs. 1 lit. a (p. 25 and 26); ${CHILD} p. 2 (Ziff. 2.1.2); ${GUIDE} p. 13 and 31`,
    }),
    'sg.child_minor': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'A minor (under 18) on 31 December',
        fr: 'Mineur (moins de 18 ans) au 31 décembre',
        de: 'Am 31. Dezember minderjährig (unter 18)',
      },
      official: 'Abzug für jedes minderjährige Kind (36.3)',
      source: `${law(y)} Art. 64 Abs. 1 (p. 29); ${GUIDE} p. 34`,
    },
    'sg.child_education': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Education costs paid for this child',
        fr: 'Frais de formation payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Ausbildungskosten',
      },
      official: 'Ausbildungskosten für Kinder in Schule oder Ausbildung (23.3, Formular 10)',
      source: `${law(y)} Art. 48 Abs. 1 lit. a (p. 26); ${FORM10} p. 1; ${GUIDE} p. 31`,
    },
    'sg.child_scholarships': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Scholarships received for this child',
        fr: 'Bourses reçues pour cet enfant',
        de: 'Für dieses Kind erhaltene Stipendien',
      },
      official: 'Stipendien (Formular 10)',
      source: `${law(y)} Art. 48 Abs. 1 lit. a (p. 26); ${FORM10} p. 1; ${GUIDE} p. 31`,
    },
    'sg.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderbetreuungskosten',
      },
      official: 'Kinderbetreuungskosten bei Drittbetreuung (16.2, Formular 10)',
      source: `${law(y)} Art. 45 Abs. 1 lit. h (p. 24); ${FORM10} p. 2; ${GUIDE} p. 28`,
    },
    'sg.main_upkeep': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Mainly bears the upkeep of the children in shared custody',
        fr: 'Assume l’essentiel de l’entretien des enfants en garde partagée',
        de: 'Kommt zur Hauptsache für den Unterhalt der Kinder unter gemeinsamer Sorge auf',
      },
      official: 'zur Hauptsache für den Unterhalt aufkommen',
      source: `${law(y)} Art. 48 Abs. 1 lit. a (p. 26); ${CHILD} p. 7 (Ziff. 2.3.3)`,
    },
    'sg.church': choice({
      values: ['catholic', 'reformed', 'christ_catholic', 'jewish', 'none'],
      perPerson: true,
      label: { en: 'Church', fr: 'Église', de: 'Konfession' },
      official: 'Konfession',
      source: `${law(y)} Art. 3 and Art. 6 Abs. 2 lit. b (p. 2); ${ORD} Art. 1 Abs. 1 and Art. 2 Abs. 1 (p. 1); ${TABLE}`,
    }),
    'sg.church_area': choice({
      values: areaOptions(y).map((o) => o.value),
      perPerson: false,
      label: { en: 'Church area', fr: 'Paroisse', de: 'Kirchgemeinde' },
      official: 'Kirchgemeinde',
      source: TABLE,
    }),
  };
}

/**
 * Every key of a St. Gallen return: the shared household keys (St. Gallen asks the way to work
 * without the length of the trip by public transport, which only Geneva's meal rule needs), its own,
 * then the documents every canton shares, with the return's terms.
 */
export function sgKeys(taxYear: number): KeyRegistry {
  const y = sgParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten zwischen Wohn- und Arbeitsstätte',
      source: `${FORM4} p. 1 (1. Fahrkosten zwischen Wohn- und Arbeitsstätte); ${GUIDE} p. 23; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${FORM4} p. 1 (1.3 Motorfahrzeug, Begründung); ${GUIDE} p. 23; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...sgOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...sgTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
