// Bern's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch, keys/),
// with Bern's own choices where its questions differ, and the answers only Bern asks for
// (data/be/2026/questionnaire.yaml): the commune of 31 December (by its federal number), the move,
// whether you keep your own household alone (form 1.2), the church of each person and the part of
// the commune whose parish levies a different rate, the tariff and the wealth deduction of a parent
// sharing custody without child support (from the last assessment), payments to political parties
// per person (form 4.4) and education costs per child (form 2.1).
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
import { communesFor } from './communes.js';
import { beParamsFor } from './params.js';

const GUIDE = 'be-2025-wegleitung-np-de';
const FORM = 'be-2025-steuererklaerung-formulare-de';
const TABLE = 'be-na-communal-steueranlagen-1983-2026';

/** A page of the 2025 guide: the PDF's page, with the guide's own number (9 pages earlier). */
const guide = (seite: number) => `${GUIDE} p. ${seite + 9} (Seite ${seite})`;

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The BFS number. */
  slug: string;
  name: string;
}

/** Bern's communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: String(c.bfs), name: c.name }));
}

/** The commune of the stored answer ("351"), by its BFS number, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  return communeOptions(taxYear).some((o) => o.slug === value) ? Number(value) : undefined;
}

const RATES = ['reformed', 'catholic', 'christCatholic'] as const;

/** A part of a commune whose parishes levy different church tax rates, for the parish question. */
export interface ParishOption {
  /** The value stored for be.parish: "<BFS>:<the part's name in the canton's table>". */
  value: string;
  bfs: number;
  commune: string;
  part: string;
  /** The churches whose rates differ between the commune's parts. */
  churches: readonly ('reformed' | 'catholic' | 'christ_catholic')[];
}

/**
 * The parts of the communes whose parishes levy different church tax rates (the canton's table of
 * Steueranlagen, one row per part): asked only there, and only of a member of a church whose rate
 * differs.
 */
export function parishOptions(taxYear: number): ParishOption[] {
  const out: ParishOption[] = [];
  for (const c of communesFor(taxYear).value) {
    if (c.parishes.length < 2) continue;
    const churches = RATES.filter((f) => new Set(c.parishes.map((p) => p[f])).size > 1).map((f) =>
      f === 'christCatholic' ? 'christ_catholic' : f,
    );
    if (!churches.length) continue;
    for (const p of c.parishes) {
      out.push({
        value: `${c.bfs}:${p.name}`,
        bfs: c.bfs,
        commune: c.name,
        part: p.name,
        churches,
      });
    }
  }
  return out;
}

/** The part of the commune from the stored answer ("304:Golaten"), when it is the commune's. */
export function partOfAnswer(taxYear: number, value: unknown, commune: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = parishOptions(taxYear).find((o) => o.value === value);
  return option && option.bfs === commune ? option.part : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/** German terms of the Bern form for the values read from the attestations (document cards). */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Beiträge an die Säule 3a', guide(192)],
  'lpp.buyin': ['Beiträge an die 2. Säule (Einkauf)', guide(190)],
  'health.premiums': ['Versicherungsprämien', guide(171)],
  'health.subsidy': ['Prämienverbilligung', guide(171)],
  'medical.costs': ['Krankheits- und Unfallkosten', guide(204)],
  'childcare.costs': ['Kinderdrittbetreuungskosten', guide(14)],
  'donation.amount': ['Vergabungen', guide(199)],
  'debt.interest': ['Schuldzinsen', guide(172)],
  'debt.balance': ['Schulden', guide(172)],
  'replacement.amount': ['Erwerbsausfallentschädigungen', guide(106)],
  'pension.amount': ['Renten und Pensionen', guide(103)],
};

function bernTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: term[1] } : def];
    }),
  );
}

/** Bern's own keys for a tax year. */
function bernOwn(taxYear: number): KeyRegistry {
  const law = beParamsFor(taxYear).taxYear === 2025 ? 'be-2025-stg-de' : 'be-2026-stg-de';
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
      source: `${TABLE} sheet Daten Gde (STJ ${taxYear}); ${law} Art. 67 Abs. 3`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_bern', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: guide(1),
    }),
    'be.own_household': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Keeps their own household alone',
        fr: 'Tient seul son propre ménage',
        de: 'Führt alleine einen eigenen Haushalt',
      },
      official: 'Führen Sie alleine einen eigenen Haushalt?',
      source: `${FORM} p. 1 (1.2); ${guide(10)}`,
    },
    'be.church': choice({
      values: ['reformed', 'catholic', 'christ_catholic', 'none'],
      perPerson: true,
      label: { en: 'Church', fr: 'Église', de: 'Konfession' },
      official: 'Konfession',
      source: `${TABLE} sheet Daten Gde (STJ ${taxYear}, church rates); ${FORM} p. 9`,
    }),
    'be.parish': choice({
      values: parishOptions(taxYear).map((o) => o.value),
      perPerson: false,
      label: { en: 'Parish', fr: 'Paroisse', de: 'Kirchgemeinde' },
      official: 'Kirchgemeinde',
      source: `${TABLE} sheet Daten Gde (STJ ${taxYear}, church rates)`,
    }),
    'be.married_tariff': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Tariff for married couples and single parents on the last assessment',
        fr: 'Barème des couples mariés et familles monoparentales sur la dernière taxation',
        de: 'Verheiratetentarif auf der letzten Veranlagung',
      },
      official: 'Tarif für Verheiratete und Alleinerziehende (Art. 42 Abs. 1)',
      source: `${law} Art. 42`,
    },
    'be.child_wealth': choice({
      values: ['full', 'half'],
      perPerson: false,
      label: {
        en: 'Wealth deduction per child on the last assessment',
        fr: 'Déduction de fortune par enfant sur la dernière taxation',
        de: 'Kinderabzug auf dem Vermögen auf der letzten Veranlagung',
      },
      official: 'Kinderabzug (Vermögen)',
      source: `${law} Art. 64`,
    }),
    'be.party': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Paid to political parties',
        fr: 'Versé aux partis politiques',
        de: 'Beiträge an politische Parteien',
      },
      official: 'Mitgliederbeiträge und Zuwendungen an politische Parteien',
      source: `${FORM} p. 4 (4.4); ${guide(198)}`,
    },
    'be.education': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Education costs away from home or extra education costs for a child',
        fr: 'Frais de formation hors du domicile ou supplémentaires pour un enfant',
        de: 'Auswärtige oder zusätzliche Ausbildungskosten für ein Kind',
      },
      official: 'Auswärtige bzw. zusätzliche Ausbildungskosten',
      source: `${FORM} p. 2 (2.1); ${guide(14)}`,
    },
    'be.child_education': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Education costs away from home or extra education costs',
        fr: 'Frais de formation hors du domicile ou supplémentaires',
        de: 'Auswärtige oder zusätzliche Ausbildungskosten',
      },
      official: 'Auswärtige bzw. zusätzliche Ausbildungskosten',
      source: `${FORM} p. 2 (2.1); ${law} Art. 40 Abs. 3`,
    },
  };
}

/**
 * Every key of a Bern return: the shared household keys (Bern asks the way to work without the
 * length of the trip by public transport, which only Geneva's meal rule needs, and payments to
 * political parties apart from donations), Bern's own, then the documents every canton shares,
 * with the Bern form's German terms.
 */
export function bernKeys(taxYear: number): KeyRegistry {
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten',
      source: `${guide(176)}; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${guide(176)}; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'profile.payments': {
      ...H['profile.payments'],
      values: [...H['profile.payments'].values, 'political_party'],
    },
    ...bernOwn(taxYear),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...bernTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
