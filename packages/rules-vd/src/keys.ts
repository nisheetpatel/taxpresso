// Vaud's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch, keys/),
// with Vaud's own choices where its questions differ, and the answers only Vaud asks for
// (data/vd/2026/questionnaire.yaml): the commune of 31 December (by its slug: the official tables
// carry no federal number) and, in L'Abbaye and Le Chenit, the part of the commune; the move;
// whether a parent who is not married keeps a household alone with the children (annex 03) and,
// sharing custody without child support, whether they mainly bear the children's upkeep; the net
// rent (code 660); the household contents (code 440) when they may be taxed; childcare per child
// (code 670); the interest on savings (code 480).
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
import { communesFor, foldName, slugOf } from './communes.js';
import { vdParamsFor } from './params.js';

const GUIDE = 'vd-2025-guide';
const FORM = 'vd-2025-form-21010';
const RIFAM = 'vd-na-law-rifam';
const guide = (page: number | string) => `${GUIDE} p. ${page}`;

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("chateau-d-oex"). */
  slug: string;
  name: string;
}

/** Vaud's communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("lausanne"), by its slug, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return communeOptions(taxYear).some((o) => o.slug === value) ? value : undefined;
}

/** A part of a commune with fractions (fractions de commune), for the part question. */
export interface PartOption {
  /** The value stored for vd.commune_part: "<commune slug>:<part slug>". */
  value: string;
  /** The commune's slug. */
  commune: string;
  communeName: string;
  /** The fraction's name, or the commune's own name for the rest of the commune. */
  part: string;
  /** The fraction's own rate, in hundredths of a percent; 0 for the rest of the commune. */
  rate: number;
}

/**
 * The parts of the communes with fractions (L'Abbaye; Le Chenit), as the communal table lists them
 * after their commune: the rest of the commune first, then each fraction.
 */
export function partOptions(taxYear: number): PartOption[] {
  const out: PartOption[] = [];
  for (const c of communesFor(taxYear).value) {
    if (!c.fractions?.length) continue;
    const commune = slugOf(c.name);
    out.push({
      value: `${commune}:${commune}`,
      commune,
      communeName: c.name,
      part: c.name,
      rate: 0,
    });
    for (const f of c.fractions) {
      out.push({
        value: `${commune}:${slugOf(f.name)}`,
        commune,
        communeName: c.name,
        part: f.name,
        rate: f.rate,
      });
    }
  }
  return out;
}

/** The part of the commune from the stored answer ("le-chenit:le-brassus"), when it is the commune's. */
export function partOfAnswer(taxYear: number, value: unknown, commune: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = partOptions(taxYear).find((o) => o.value === value);
  return option && foldName(option.commune) === foldName(commune) ? option.part : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/** French terms of the Vaud return for the values read from the attestations (document cards). */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': ['Prévoyance individuelle liée (3e pilier A)', `${guide(30)} (code 310)`],
  'lpp.buyin': ['Rachats d’années d’assurance (2e pilier)', `${guide(31)} (code 320)`],
  'health.premiums': [
    'Assurances maladie et accidents, assurances sur la vie',
    `${guide(29)} (code 300)`,
  ],
  'health.subsidy': [
    'Montant des subsides',
    `${FORM} p. 1 (form page 4, chiffre 10); ${guide(29)} (code 300)`,
  ],
  'medical.costs': ['Frais médicaux et dentaires', `${guide(48)} (code 710)`],
  'childcare.costs': ['Déduction pour frais de garde', `${guide(44)} (code 670)`],
  'donation.amount': ['Dons à des institutions d’utilité publique', `${guide(49)} (code 720)`],
  'debt.interest': ['Intérêts des dettes privées', `${guide(41)} (code 610)`],
  'debt.balance': ['Dettes privées', `${guide(41)} (code 610)`],
  'replacement.amount': ['Indemnités pour perte de gain', `${guide(26)} (codes 200 à 220)`],
  'pension.amount': ['Rentes et pensions', `${guide(27)} (codes 240 à 280)`],
};

function vaudTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: term[1] } : def];
    }),
  );
}

/** Vaud's own keys for a tax year. */
function vaudOwn(taxYear: number): KeyRegistry {
  const year = vdParamsFor(taxYear).taxYear;
  const law = `vd-${year}-law-li`;
  const table = `vd-${year}-communal-arretes-imposition`;
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
      official: 'commune de domicile',
      source: `${table} sheet arreteImposition; vd-na-law-licom art. 9 (p. 6), art. 15 al. 1 (p. 7)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_vaud', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${guide(6)} (règles d’assujettissement); ${guide(60)}`,
    }),
    'vd.commune_part': choice({
      values: partOptions(taxYear).map((o) => o.value),
      perPerson: false,
      label: {
        en: 'Part of the commune',
        fr: 'Partie de la commune',
        de: 'Teil der Gemeinde',
      },
      official: 'fraction de commune',
      source: `${table} sheet arreteImposition (rows "(fraction)"); vd-na-law-licom art. 1 al. 1 (p. 1)`,
    }),
    'vd.own_household': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Keeps a household alone with the children',
        fr: 'Tient un ménage indépendant seul avec les enfants',
        de: 'Führt allein mit den Kindern einen eigenen Haushalt',
      },
      official: 'Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s) ?',
      source: `vd-2025-annexes-02-03 p. 1 (annexe 03); ${guide(10)} (famille monoparentale); ${law} art. 43 al. 2 lit. c`,
    },
    'vd.main_upkeep': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Mainly bears the children’s upkeep',
        fr: 'Assume principalement l’entretien des enfants',
        de: 'Kommt hauptsächlich für den Unterhalt der Kinder auf',
      },
      official: 'assume principalement l’entretien de l’enfant',
      source: `${RIFAM} art. 5 al. 2 (p. 3)`,
    },
    'vd.rent': {
      type: 'money',
      min: 0,
      max: 50_000_000,
      perPerson: false,
      label: {
        en: 'Yearly net rent of your home, without charges',
        fr: 'Loyer annuel net de votre logement, sans les charges',
        de: 'Jährliche Nettomiete deiner Wohnung, ohne Nebenkosten',
      },
      official: 'Loyer annuel net',
      source: `${FORM} p. 2 (form page 3, code 660); ${guide(44)} (code 660); ${law} art. 39`,
    },
    'vd.contents_high': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'Household contents insured for more than the value left untaxed',
        fr: 'Objets mobiliers assurés pour plus que la valeur non imposable',
        de: 'Hausrat höher versichert als der steuerfreie Wert',
      },
      official: 'Objets mobiliers',
      source: `${FORM} p. 2 (form page 3, code 440); ${guide(39)} (code 440)`,
    },
    'vd.contents_value': {
      type: 'money',
      min: 0,
      max: 1_000_000_000,
      perPerson: false,
      label: {
        en: 'Fire insurance value of your household contents',
        fr: 'Valeur d’assurance incendie de vos objets mobiliers',
        de: 'Feuerversicherungswert deines Hausrats',
      },
      official: 'valeur d’assurance incendie',
      source: `${FORM} p. 2 (form page 3, code 440); ${guide(39)} (code 440)`,
    },
    'vd.child_care': {
      type: 'money',
      min: 0,
      max: 20_000_000,
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Betreuungskosten',
      },
      official: 'Déduction pour frais de garde',
      source: `${FORM} p. 2 (form page 3, code 670); ${guide(44)} (code 670)`,
    },
    'vd.savings_interest': {
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
      source: `${FORM} p. 2 (form page 3, code 480); ${guide(40)} (code 480)`,
    },
  };
}

/**
 * Every key of a Vaud return: the shared household keys (Vaud asks the way to work without the
 * length of the trip by public transport, which only Geneva's meal rule needs), Vaud's own, then the
 * documents every canton shares, with the Vaud return's French terms.
 */
export function vaudKeys(taxYear: number): KeyRegistry {
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Frais de transport',
      source: `${guide(19)} (code 140); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${guide(20)} (code 140); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...vaudOwn(taxYear),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...vaudTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
