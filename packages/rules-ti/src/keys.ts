// Ticino's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with Ticino's own choices where its questions differ, and the answers only Ticino asks for
// (data/ti/2026/questionnaire.yaml), as ./canton.ts (TicinoCantonal) reads them: the commune of 31
// December (by its name in the official table of multipliers, which has no federal commune
// numbers), the move, each person's work rate and whether they worked the whole year (and if not,
// how many months), whether each child was under 18, the childcare paid for each child, and a
// divorce, separation or death of a spouse during the year.
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
import { childRule, communalTax, professionalRule, tariffRule } from './law.js';
import { tiParamsFor } from './params.js';

/** The 2025 instructions, for both years: the 2026 instructions are not published yet. */
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';
const LAW = 'ti-na-law-lt-640-100';
const M4 = 'ti-2025-form-modulo-4';
const M6 = 'ti-2025-form-modulo-6';

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("lugano", "brione-s-minusio"): the official table has no BFS number. */
  slug: string;
  /** The name as the official table prints it, in capitals ("BRIONE S/MINUSIO"). */
  official: string;
  /** The same name in ordinary case, for the questionnaire ("Brione s/Minusio"). */
  name: string;
}

/** Words of a commune's name written in small letters ("Ronco sopra Ascona", "Terre di Pedemonte"). */
const SMALL = new Set(['di', 'sopra', 'e']);

/**
 * A commune's name in ordinary case, from the table's capitals: each word capitalized, the
 * prepositions in small letters, an elided "D’" in small letters ("Collina d’Oro"), "S/" (sopra) in
 * small letters ("Brione s/Minusio"), the typographic apostrophe.
 */
export function communeName(official: string): string {
  const word = (w: string, first: boolean): string => {
    const lower = w.toLowerCase();
    if (!first && SMALL.has(lower)) return lower;
    if (lower.startsWith('s/')) return `s/${word(w.slice(2), true)}`;
    if (lower.startsWith('(')) return `(${word(w.slice(1), true)}`;
    if (w.includes('-'))
      return w
        .split('-')
        .map((x) => word(x, true))
        .join('-');
    const apostrophe = w.search(/['’]/);
    if (apostrophe > 0) {
      const head = w.slice(0, apostrophe);
      const tail = w.slice(apostrophe + 1);
      const h = head.toLowerCase() === 'd' && !first ? 'd' : word(head, true);
      return `${h}’${word(tail, true)}`;
    }
    return `${lower[0]!.toUpperCase()}${lower.slice(1)}`;
  };
  return official
    .split(' ')
    .map((w, i) => word(w, i === 0))
    .join(' ');
}

/** Ticino's communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({
    slug: slugOf(c.name),
    official: c.name,
    name: communeName(c.name),
  }));
}

/** The commune of the stored answer ("lugano"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.official)?.name : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * Official terms of the Ticino return for the values read from the attestations (document cards),
 * with the page of the 2025 instructions that explains each line.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Previdenza individuale vincolata, 3° pilastro A (11.1, 11.2)', 'p. 25'],
  'lpp.buyin': ['Previdenza professionale, riscatti di anni di assicurazione (10.3)', 'p. 25'],
  'health.premiums': [
    'Oneri assicurativi e interessi di capitali a risparmio (12, Modulo 6)',
    'p. 26',
  ],
  'medical.costs': ['Spese per malattia e infortunio (22.1, Modulo 6)', 'p. 30'],
  'childcare.costs': [
    'Deduzione cure prestate da terzi a figli di età inferiore ai 14 anni (20, Modulo 6)',
    'p. 29',
  ],
  'donation.amount': ['Liberalità a enti di pubblica utilità (24, Modulo 5)', 'p. 30'],
  'debt.interest': ['Interessi passivi privati (13.2, Modulo 5)', 'p. 27'],
  'debt.balance': ['Debiti privati (33.1, Modulo 5)', 'p. 36'],
  'replacement.amount': [
    'Indennità per perdita di guadagno, indennità giornaliere (3.4, 3.5)',
    'p. 16',
  ],
  'pension.amount': [
    'Rendite AVS e AI, pensioni della previdenza professionale (3.1, 3.2)',
    'p. 16',
  ],
};

function tiTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: `${GUIDE} ${term[1]}` } : def];
    }),
  );
}

/** Ticino's own keys for a tax year. */
function tiOwn(taxYear: number): KeyRegistry {
  const y = tiParamsFor(taxYear).taxYear;
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
        it: 'Comune di domicilio al 31 dicembre',
      },
      official: 'Comune',
      source: `${TABLE}; ${communalTax(y).source}`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_ti', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: {
        en: 'Moves in the year',
        fr: 'Déménagements dans l’année',
        de: 'Umzüge im Jahr',
        it: 'Traslochi nell’anno',
      },
      source: `${GUIDE} p. 6 and 7 (Obbligo fiscale); ${LAW} art. 277 cpv. 1`,
    }),
    'ti.work_rate': {
      type: 'integer',
      perPerson: true,
      min: 1,
      max: 100,
      label: {
        en: 'Work rate in percent of full time',
        fr: 'Taux d’activité en pour-cent d’un plein temps',
        de: 'Beschäftigungsgrad in Prozent einer Vollzeitstelle',
        it: 'Grado di occupazione in percentuale di un tempo pieno',
      },
      official: 'Grado di occupazione (Modulo 4)',
      source: `${M4} p. 1 (Per gradi di occupazione inferiori al 100% indicarne la percentuale); ${professionalRule(y).source}`,
    },
    'ti.full_year': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Worked the whole year',
        fr: 'A travaillé toute l’année',
        de: 'Hat das ganze Jahr gearbeitet',
        it: 'Ha lavorato tutto l’anno',
      },
      official: 'Durata dell’attività professionale (Modulo 4, cifra 1)',
      source: `${M4} p. 1 (1. Durata dell’attività professionale: annuale, inferiore all’anno); ${professionalRule(y).source}`,
    },
    'ti.months_worked': {
      type: 'integer',
      perPerson: true,
      min: 1,
      max: 11,
      label: {
        en: 'Months worked in the year',
        fr: 'Mois travaillés dans l’année',
        de: 'Im Jahr gearbeitete Monate',
        it: 'Mesi lavorati nell’anno',
      },
      official: 'Durata dell’attività professionale inferiore all’anno (Modulo 4, cifra 1)',
      source: `${M4} p. 1 (1. Durata dell’attività professionale); ${professionalRule(y).source}`,
    },
    'ti.child_minor': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Under 18 on 31 December',
        fr: 'Moins de 18 ans au 31 décembre',
        de: 'Am 31. Dezember unter 18',
        it: 'Minorenne al 31 dicembre',
      },
      official: 'Deduzione sociale per ogni figlio minorenne (35.2)',
      source: `${LAW} art. 48 lett. b; ${GUIDE} p. 36`,
    },
    'ti.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Kinderbetreuungskosten',
        it: 'Spese per cure prestate da terzi pagate per questo figlio',
      },
      official: 'Cura prestata da terzi a figli/ie di età inferiore ai 14 anni (20, Modulo 6)',
      source: `${LAW} art. 32a; ${M6} p. 1; ${GUIDE} p. 29`,
    },
    'ti.status_change': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Divorced, separated or widowed during the year',
        fr: 'Divorce, séparation ou veuvage pendant l’année',
        de: 'Scheidung, Trennung oder Tod des Ehegatten im Jahr',
        it: 'Divorzio, separazione o decesso del coniuge nell’anno',
      },
      official: 'Matrimonio, separazione o divorzio',
      source: `${tariffRule(y).source}; ${LAW} art. 53 cpv. 3; ${childRule(y).source}`,
    },
  };
}

/**
 * Every key of a Ticino return: the shared household keys (Ticino asks the way to work without the
 * length of the trip by public transport, which only Geneva's meal rule needs), its own, then the
 * documents every canton shares, with the return's terms.
 */
export function tiKeys(taxYear: number): KeyRegistry {
  const y = tiParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Spese di trasporto dal domicilio al luogo di lavoro (Modulo 4, cifra 2)',
      source: `${M4} p. 1 (2. Spese di trasporto dal domicilio al luogo di lavoro); ${GUIDE} p. 23; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${M4} p. 1 (2.2 Veicolo privato, Motivazione); ${GUIDE} p. 23; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...tiOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...tiTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
