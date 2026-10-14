// Aargau's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch, keys/),
// with Aargau's own choices where its questions differ, and the answers only Aargau asks for
// (data/ag/2026/questionnaire.yaml), as its engine reads them (./canton.ts, AargauCantonal): the
// commune of 31 December (by name: the canton's list has no federal commune numbers), the move,
// each adult's church and, where the commune has a further parish of that church (Zusatzkirche),
// the parish; each child's age band (the child deduction, StG § 42 Abs. 1 lit. a); who mainly bears
// a shared child's upkeep; and the childcare paid for each child (15.0, the limit is per child).
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
import { communeByName, communesFor, slugOf, type Confession } from './communes.js';
import { agParamsFor } from './params.js';

const LAW = 'ag-na-law-steuergesetz';
const GUIDE = 'ag-2025-guide-wegleitung';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("aarau", "brugg-ag"): the canton's list has no BFS number. */
  slug: string;
  name: string;
}

/** Aargau's communes for the questionnaire, in the order of the canton's list. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("brugg-ag"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.name)?.name : undefined;
}

/**
 * A parish of a commune with a further parish (Zusatzkirche), for the parish question: the
 * commune's own parish, or a further one.
 */
export interface ParishOption {
  /** The value stored for ag.parish: "<commune's slug>:<the parish as the list prints it>". */
  value: string;
  /** The commune's slug and name. */
  slug: string;
  commune: string;
  /** The parish as the engine takes it: the commune's own name for its own parish. */
  parish: string;
  /** True for the commune's own parish. */
  own: boolean;
  /**
   * The churches whose members choose: for a further parish, its church; for the commune's own,
   * every church that has a further parish in the commune.
   */
  churches: readonly Exclude<Confession, 'none'>[];
}

/**
 * The parishes of the communes that have a further parish (Zusatzkirche) whose members, in part of
 * the commune, pay another church rate (the canton's list, p. 9): asked only there, and only of a
 * member of that church.
 */
export function parishOptions(taxYear: number): ParishOption[] {
  const out: ParishOption[] = [];
  for (const c of communesFor(taxYear).value) {
    if (!c.extra.length) continue;
    const slug = slugOf(c.name);
    const churches = [...new Set(c.extra.map((p) => p.confession))];
    out.push({
      value: `${slug}:${c.name}`,
      slug,
      commune: c.name,
      parish: c.name,
      own: true,
      churches,
    });
    for (const p of c.extra) {
      out.push({
        value: `${slug}:${p.parish}`,
        slug,
        commune: c.name,
        parish: p.parish,
        own: false,
        churches: [p.confession],
      });
    }
  }
  return out;
}

/** The parish of the stored answer ("aarau:ref. Kirche Rohr"), when it is the commune's. */
export function parishOfAnswer(
  taxYear: number,
  value: unknown,
  commune: string,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = parishOptions(taxYear).find((o) => o.value === value);
  return option && option.commune === commune ? option.parish : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * German terms of the Aargau return for the values read from the attestations (document cards),
 * with the section of the guide that explains each line and its page.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Beiträge Säule 3a (13.2)', 'p. 26'],
  'lpp.buyin': ['Einkäufe Säule 2 (13.1)', 'p. 25 and 26'],
  'health.premiums': ['Versicherungsprämien und Zinsen von Sparkapitalien (14)', 'p. 27'],
  'medical.costs': ['Krankheits- und Unfallkosten (17.1)', 'p. 30'],
  'childcare.costs': ['Kinderbetreuungskosten (15.0)', 'p. 27'],
  'donation.amount': ['Freiwillige Leistungen (Spenden) (15.3)', 'p. 28'],
  'debt.interest': ['Schuldzinsen (11)', 'p. 25'],
  'debt.balance': ['Total der Schulden (34)', 'p. 41'],
  'replacement.amount': ['Erwerbsausfallentschädigungen (3)', 'p. 17'],
  'pension.amount': ['Steuerbare Renten (3)', 'p. 16'],
};

function agTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: `${GUIDE} ${term[1]}` } : def];
    }),
  );
}

/** Aargau's own keys for a tax year. */
function agOwn(taxYear: number): KeyRegistry {
  const y = agParamsFor(taxYear).taxYear;
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  const LIST = communesFor(y).source;
  const list = `ag-${y}-communal-steuerfuesse`;
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
      source: `${LIST}; ${LAW} § 157 Abs. 1 (p. 70)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_ag', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 5 (unterjährige Steuerpflicht), p. 7 (Wer füllt eine Steuererklärung aus?) and p. 8 (Wohnsitzverlegung)`,
    }),
    'ag.church': choice({
      values: ['reformed', 'catholic', 'christ_catholic', 'none'],
      perPerson: true,
      label: { en: 'Church', fr: 'Église', de: 'Konfession' },
      official: 'Konfession',
      source: `${list} p. 1 (Kirche ev.-ref., röm.-kt., christ-kt.); ${LAW} § 154 Abs. 1 (p. 69)`,
    }),
    'ag.parish': choice({
      values: parishOptions(y).map((o) => o.value),
      perPerson: false,
      label: {
        en: 'Parish in a commune with a further parish',
        fr: 'Paroisse dans une commune avec une paroisse supplémentaire',
        de: 'Kirchgemeinde in einer Gemeinde mit Zusatzkirche',
      },
      official: 'Zusatzkirche',
      source: `${list} p. 9 (Zusatzkirchen)`,
    }),
    'ag.child_band': choice({
      values: ['under14', 'under18', 'adult'],
      perPerson: true,
      label: {
        en: 'Child’s age at the end of the year',
        fr: 'Âge de l’enfant à la fin de l’année',
        de: 'Alter des Kindes am Ende des Jahres',
      },
      official: 'Kinderabzug pro Kind',
      source: `${LAW} § 42 Abs. 1 lit. a (p. 27); ${GUIDE} p. 31 and 32 (19.1)`,
    }),
    'ag.main_upkeep': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Mainly bears the upkeep of the children in shared custody',
        fr: 'Assume l’essentiel de l’entretien des enfants en garde partagée',
        de: 'Kommt für den Unterhalt der Kinder in gemeinsamer Sorge überwiegend auf',
      },
      official: 'überwiegend für den Unterhalt des Kindes aufkommen',
      source: `${GUIDE} p. 32 (19.1); ${LAW} § 42 Abs. 1 lit. a (p. 27)`,
    },
    'ag.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderbetreuungskosten',
      },
      official: 'Kinderbetreuungskosten',
      source: `${LAW} § 40 Abs. 1 lit. n (p. 26); ${GUIDE} p. 27 (15.0); ag-2026-deductions-kinderbetreuungskosten p. 7 (4.6, 4.7)`,
    },
  };
}

/**
 * Every key of an Aargau return: the shared household keys (Aargau asks the way to work without
 * the length of the trip by public transport, which only Geneva's meal rule needs), its own, then
 * the documents every canton shares, with the return's German terms.
 */
export function agKeys(taxYear: number): KeyRegistry {
  const y = agParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
      source: `${GUIDE} p. 22 (10.1); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${GUIDE} p. 22 (10.1); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...agOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...agTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
