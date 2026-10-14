// Zurich's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch, keys/),
// with Zurich's own choices where its questions differ, and the answers only Zurich asks for: the
// commune of 31 December (by its federal number, a part of the commune where the official table
// gives it two multipliers), the move, the church and the parish (data/zh/2026/questionnaire.yaml).
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
import { zhParamsFor } from './params.js';

const GUIDE = 'zh-2025-guide-natuerliche-personen';
const TABLE = 'zh-na-communal-steuerfuesse-seit-2012';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The BFS number, with the part ("198-2") when the commune's parts have different multipliers. */
  slug: string;
  name: string;
}

const distinct = (values: readonly number[]) => new Set(values).size;

/**
 * Zurich's communes for the questionnaire, in the official table's order: one option per commune,
 * or one per part ("Uster, Teil 1 (Steuerfuss 112 %)") when the table gives its parts different
 * multipliers, numbered as the table numbers them.
 */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.flatMap((c) =>
    distinct(c.rates) > 1
      ? c.rates.map((rate, i) => ({
          slug: `${c.bfs}-${i + 1}`,
          name: `${c.name}, Teil ${i + 1} (Steuerfuss ${rate} %)`,
        }))
      : [{ slug: String(c.bfs), name: c.name }],
  );
}

/** The commune and its part from the stored answer ("261", "198-2"), or undefined. */
export function communeOfAnswer(
  taxYear: number,
  value: unknown,
): { bfs: number; variant?: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  if (!option) return undefined;
  const [bfs, part] = value.split('-').map(Number);
  return part ? { bfs: bfs!, variant: part } : { bfs: bfs! };
}

/** Communes whose parishes of one church have different church multipliers, by church. */
export function parishChoices(
  taxYear: number,
): { bfs: number; church: 'reformed' | 'catholic' | 'christ_catholic' }[] {
  const out: { bfs: number; church: 'reformed' | 'catholic' | 'christ_catholic' }[] = [];
  for (const c of communesFor(taxYear).value) {
    if (distinct(c.reformed) > 1) out.push({ bfs: c.bfs, church: 'reformed' });
    if (distinct(c.catholic) > 1) out.push({ bfs: c.bfs, church: 'catholic' });
    if (distinct(c.christCatholic) > 1) out.push({ bfs: c.bfs, church: 'christ_catholic' });
  }
  return out;
}

const H = KEYS_HOUSEHOLD_2026;

/** German terms of the Zurich form for the values read from the attestations (document cards). */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Beiträge an die 3. Säule a', `${GUIDE} p. 15`],
  'lpp.buyin': ['Beiträge an die 2. Säule (Einkauf)', `${GUIDE} p. 16`],
  'health.premiums': ['Versicherungsprämien', `${GUIDE} p. 15`],
  'health.subsidy': ['Prämienverbilligung', `${GUIDE} p. 15`],
  'medical.costs': ['Krankheits- und Unfallkosten', `${GUIDE} p. 19`],
  'childcare.costs': ['Kosten für fremdbetreute Kinder', `${GUIDE} p. 18`],
  'donation.amount': ['Gemeinnützige Zuwendungen', `${GUIDE} p. 19`],
  'debt.interest': ['Schuldzinsen', `${GUIDE} p. 14`],
  'debt.balance': ['Schulden', `${GUIDE} p. 22`],
  'replacement.amount': ['Taggelder, Erwerbsausfallentschädigungen', `${GUIDE} p. 12`],
  'pension.amount': ['Renten / Pensionen', `${GUIDE} p. 11`],
};

function zurichTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: term[1] } : def];
    }),
  );
}

/** Zurich's own keys for a tax year. */
function zurichOwn(taxYear: number): KeyRegistry {
  const law =
    zhParamsFor(taxYear).taxYear === 2025
      ? 'zh-2025-law-steuergesetz-631-1-stand-2025'
      : 'zh-2026-law-steuergesetz-631-1-stand-2026';
  const sheet = `STFUSS${taxYear}`;
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
      source: `${TABLE} sheet ${sheet}; ${law} § 190 (p. 73)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_zurich', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 5 and 6`,
    }),
    'zh.church': choice({
      values: ['reformed', 'catholic', 'christ_catholic', 'none'],
      perPerson: true,
      label: { en: 'Church', fr: 'Église', de: 'Konfession' },
      official: 'Konfession',
      source: `${law} § 201 and § 202 (p. 74)`,
    }),
    // Childcare paid for each child: asked only when the invoices for the household pass one
    // child's limit and there are several children, since the limit is per child and the split
    // then decides the deduction (§ 31 Abs. 1 lit. j).
    'zh.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderbetreuungskosten',
      },
      official: 'Kosten für fremdbetreute Kinder',
      source: `${law} § 31 Abs. 1 lit. j (p. 18); ${GUIDE} p. 18`,
    },
    'zh.parish': choice({
      values: ['1', '2'],
      perPerson: false,
      label: { en: 'Parish', fr: 'Paroisse', de: 'Kirchgemeinde' },
      official: 'Kirchgemeinde',
      source: `${TABLE} sheet ${sheet} (columns I to L)`,
    }),
  };
}

/**
 * Every key of a Zurich return: the shared household keys (Zurich asks the way to work without the
 * length of the trip by public transport, which only Geneva's meal rule needs), Zurich's own, then
 * the documents every canton shares, with the Zurich form's German terms.
 */
export function zurichKeys(taxYear: number): KeyRegistry {
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten',
      source: `${GUIDE} p. 13; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${GUIDE} p. 13; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...zurichOwn(taxYear),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...zurichTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
