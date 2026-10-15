// Fribourg's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with Fribourg's own choices where its questions differ, and the answers only Fribourg
// asks for (data/fr/2026/questionnaire.yaml), as ./canton.ts (FribourgCantonal) reads them: the
// commune of 31 December (by its federal number, which the canton's tables give) and the move; each
// adult's church and, where the commune's parishes of that church differ, the parish; each child's
// age band (the health insurance flat amount, code 4.110, and childcare under 14, code 4.380) and
// the childcare paid for each child (the limit is per child); the health premium subsidy (Fribourg
// deducts a flat amount per insured person, less the subsidy); the life insurance premiums (code
// 4.120) and the interest on savings (code 4.150).
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
import { communesFor, type Church } from './communes.js';
import { frParamsFor } from './params.js';

/** The guide: the 2025 one for both years, the 2026 guide is not published yet. */
const GUIDE = 'fr-2025-guide-instructions-generales';
const LAW = 'fr-2025-law-licd-consolidee';
const guide = (page: number | string, code?: string) =>
  `${GUIDE} p. ${page}${code ? ` (code ${code})` : ''}`;

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's federal number as text ("2196"): the canton's tables give it. */
  slug: string;
  name: string;
}

/** Fribourg's communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: String(c.bfs), name: c.name }));
}

/** The commune of the stored answer ("2196"), by its federal number, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  return communeOptions(taxYear).some((o) => o.slug === value) ? Number(value) : undefined;
}

/** A parish of a commune whose parishes of one church have different coefficients. */
export interface ParishOption {
  /** The value stored for fr.parish: "<BFS>:<church>:<the parish's name in the canton's table>". */
  value: string;
  bfs: number;
  commune: string;
  church: Church;
  parish: string;
}

/**
 * The parishes of the communes whose parishes of one church levy different coefficients (the
 * canton's parish tables): asked only there, and only of a member of that church. Elsewhere the
 * commune's parish, or its parishes' common coefficients, apply (./communes.ts, parishOf).
 */
export function parishOptions(taxYear: number): ParishOption[] {
  const out: ParishOption[] = [];
  for (const c of communesFor(taxYear).value) {
    for (const church of ['catholic', 'reformed'] as const) {
      const ps = c[church];
      if (ps.length < 2 || new Set(ps.map((p) => `${p.income}/${p.wealth}`)).size < 2) continue;
      for (const p of ps) {
        out.push({
          value: `${c.bfs}:${church}:${p.name}`,
          bfs: c.bfs,
          commune: c.name,
          church,
          parish: p.name,
        });
      }
    }
  }
  return out;
}

/** The parish of the stored answer, when it is the commune's and the church's; its name. */
export function parishOfAnswer(
  taxYear: number,
  value: unknown,
  commune: number,
  church: Church,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const o = parishOptions(taxYear).find((x) => x.value === value);
  return o && o.bfs === commune && o.church === church ? o.parish : undefined;
}

/** The churches the questionnaire asks about (the two with a parish tax), and none. */
export const CONFESSIONS = ['catholic', 'reformed', 'none'] as const;

/**
 * A child's age band at the end of the year, as Fribourg's deductions read it: under 14 (childcare,
 * code 4.380), 14 to 17 (the child's flat health amount), 18 to 25 in training at your charge (the
 * young adult's flat health amount, code 4.110), over 25 (not supported: no flat amount for them).
 */
export const CHILD_AGES = ['under14', 'minor', 'young', 'adult'] as const;
export type ChildAge = (typeof CHILD_AGES)[number];

const H = KEYS_HOUSEHOLD_2026;

/** French terms of the Fribourg return for the values read from the attestations (document cards). */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': [
    'Formes reconnues de prévoyance individuelle liée (3e pilier a)',
    guide(25, '4.130'),
  ],
  'lpp.buyin': ['Rachats d’années d’assurance (2e pilier, caisse de pension)', guide(25, '4.140')],
  'health.premiums': ['Caisse-maladie et accidents', guide(24, '4.110')],
  'health.subsidy': ['Réduction de primes (subventions ECAS)', guide(24, '4.110')],
  'medical.costs': ['Frais médicaux', guide('33 and 34', '5.110')],
  'childcare.costs': ['Frais de garde des enfants', guide(32, '4.380')],
  'donation.amount': ['Versements bénévoles', guide(34, '5.120')],
  'debt.interest': ['Intérêts passifs privés', guide('26 and 27', '4.210')],
  'debt.balance': ['Dettes privées (annexe 02)', guide('26 and 27', '4.210')],
  'replacement.amount': ['Indemnités pour perte de gain', `${GUIDE} p. 10 (codes 1.510 to 1.530)`],
  'pension.amount': ['Rentes et pensions', `${GUIDE} p. 14 and 15 (codes 3.110 to 3.140)`],
};

function frTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: term[1] } : def];
    }),
  );
}

/** Fribourg's own keys for a tax year. */
function frOwn(taxYear: number): KeyRegistry {
  const year = frParamsFor(taxYear).taxYear;
  const table = communesFor(year).source;
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  return {
    'profile.commune': choice({
      values: communeOptions(year).map((c) => c.slug),
      perPerson: false,
      label: {
        en: 'Commune on 31 December',
        fr: 'Commune de domicile au 31 décembre',
        de: 'Wohngemeinde am 31. Dezember',
      },
      official: 'Commune de domicile',
      source: `${table}; fr-na-law-lico art. 9 al. 3 (p. 3)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_fr', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `fr-na-law-lico art. 9 al. 2 and 3 (p. 3); ${GUIDE} p. 4`,
    }),
    'fr.church': choice({
      values: CONFESSIONS,
      perPerson: true,
      label: { en: 'Church', fr: 'Confession', de: 'Konfession' },
      official: 'Confession',
      source: `${GUIDE} p. 46 (B. Impôt communal et ecclésiastique); ${table}`,
    }),
    'fr.parish': choice({
      values: parishOptions(year).map((o) => o.value),
      perPerson: false,
      label: { en: 'Parish', fr: 'Paroisse', de: 'Pfarrei' },
      official: 'Paroisse',
      source: `${GUIDE} p. 46 (B. Impôt communal et ecclésiastique); ${table}`,
    }),
    'fr.child_age': choice({
      values: CHILD_AGES,
      perPerson: true,
      label: {
        en: 'Age at the end of the year',
        fr: 'Âge à la fin de l’année',
        de: 'Alter Ende Jahr',
      },
      official: 'Caisse-maladie et accidents (4.110), frais de garde (4.380)',
      source: `${guide(24, '4.110')}; ${guide(32, '4.380')}; fr-na-deductions-primes-assurance art. 1 al. 1 and 2 (p. 1 and 2)`,
    }),
    'fr.child_care': {
      type: 'money',
      min: 0,
      max: 20_000_000,
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Betreuungskosten',
      },
      official: 'Frais de garde des enfants',
      source: `${LAW} art. 34 al. 3 (p. 24); ${guide(32, '4.380')}`,
    },
    'fr.health_subsidy': {
      type: 'money',
      min: 0,
      max: 10_000_000,
      perPerson: false,
      label: {
        en: 'Health premium subsidy received',
        fr: 'Réduction de primes reçue',
        de: 'Erhaltene Prämienverbilligung',
      },
      official: 'Subventions versées par l’ECAS (réduction de primes)',
      source: guide(24, '4.110'),
    },
    'fr.life_insurance': {
      type: 'money',
      min: 0,
      max: 100_000_000,
      perPerson: false,
      label: {
        en: 'Life and other insurance premiums',
        fr: 'Primes d’assurances-vie et autres',
        de: 'Prämien für Lebens- und andere Versicherungen',
      },
      official: 'Autres primes et cotisations (3e pilier b)',
      source: `${guide(24, '4.120')}; ${LAW} art. 34 al. 1 let. g ch. 1.2 (p. 23)`,
    },
    'fr.savings_interest': {
      type: 'money',
      min: 0,
      max: 100_000_000,
      perPerson: false,
      label: {
        en: 'Interest on savings',
        fr: 'Intérêts de capitaux d’épargne',
        de: 'Zinsen auf Sparkapitalien',
      },
      official: 'Déduction des intérêts de capitaux d’épargne',
      source: `${guide(26, '4.150')}; ${LAW} art. 34 al. 1 let. g ch. 1.3 (p. 23)`,
    },
  };
}

/**
 * Every key of a Fribourg return: the shared household keys (Fribourg asks the way to work without
 * the length of the trip by public transport, which only Geneva's meal rule needs), its own, then
 * the documents every canton shares, with the return's French terms.
 */
export function frKeys(taxYear: number): KeyRegistry {
  const y = frParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Frais de transport',
      source: `${guide('11 and 12', '2.110')}; ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${guide(11, '2.110')}; fr-na-deductions-frais-professionnels art. 3 al. 2 and 3 (p. 2); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...frOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...frTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
