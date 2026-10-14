// Lucerne's ledger keys (SPEC.md section 4): the keys every canton shares (packages/rules-ch,
// keys/), with Lucerne's own choices where its questions differ, and the answers only Lucerne asks
// for (data/lu/2026/questionnaire.yaml), as ./canton.ts (LucerneCantonal) reads them: the commune of
// 31 December (by name: the canton's table of units has no federal commune numbers), the move, each
// adult's and each child's confession (the church tax), whether each child lives with you, was under
// 14 at the end of the year and stays away from home for their education, whether the family
// tariff is yours in shared custody without child support, and the childcare paid for each child
// (Ziffer 360: the limit is per child).
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
import { luParamsFor, type LuTaxYear } from './params.js';

/** The guide: the 2025 one for both years, the regular 2026 guide is not published yet. */
const GUIDE = 'lu-2025-guide-wegleitung';
const law = (y: LuTaxYear) => `lu-${y}-law-steuergesetz`;
const stv = (y: LuTaxYear) => `lu-${y}-law-steuerverordnung`;

/** A commune as the questionnaire offers it: the value stored for profile.commune and its name. */
export interface CommuneOption {
  /** The commune's slug ("luzern", "escholzmatt-marbach"): the official table has no BFS number. */
  slug: string;
  name: string;
}

/** Lucerne's 79 communes for the questionnaire, in the official table's order. */
export function communeOptions(taxYear: number): CommuneOption[] {
  return communesFor(taxYear).value.map((c) => ({ slug: slugOf(c.name), name: c.name }));
}

/** The commune of the stored answer ("luzern"), by its name as the engine takes it, or undefined. */
export function communeOfAnswer(taxYear: number, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const option = communeOptions(taxYear).find((o) => o.slug === value);
  return option ? communeByName(taxYear, option.name)?.name : undefined;
}

const H = KEYS_HOUSEHOLD_2026;

/**
 * German terms of the Lucerne return for the values read from the attestations (document cards),
 * with the page of the 2025 guide that explains each line.
 */
const ATTESTATION_TERMS: Record<string, [string, string]> = {
  'pillar3a.paid': [
    'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge, Säule 3a (260/261)',
    'p. 30',
  ],
  'lpp.buyin': ['Beiträge an 2. Säule, davon Einkauf (280/282)', 'p. 31'],
  'health.premiums': [
    'Versicherungsprämien und Zinsen von Sparkapitalien (270, Formular V)',
    'p. 31',
  ],
  'health.subsidy': ['Prämienverbilligungs-Beiträge (Formular V)', 'p. 31'],
  'medical.costs': ['Krankheits-, Unfall- und behinderungsbedingte Kosten (320)', 'p. 32'],
  'childcare.costs': ['Fremdbetreuungskosten (360)', 'p. 34'],
  'donation.amount': ['Freiwillige Zuwendungen (324)', 'p. 32'],
  'debt.interest': ['Schuldzinsen (252, Formular S)', 'p. 29'],
  'debt.balance': ['Schulden (462, Formular S)', 'p. 36'],
  'replacement.amount': ['Erwerbsausfallentschädigungen (140/141)', 'p. 22'],
  'pension.amount': ['AHV-/IV-Renten, Renten/Pensionen (130 bis 137)', 'p. 22'],
};

function luTerms(keys: KeyRegistry): KeyRegistry {
  return Object.fromEntries(
    Object.entries(keys).map(([k, def]) => {
      const term = ATTESTATION_TERMS[k];
      return [k, term ? { ...def, official: term[0], source: `${GUIDE} ${term[1]}` } : def];
    }),
  );
}

/** The confessions the return asks (Konfession, page 1), as the engine names them. */
export const CONFESSIONS = ['catholic', 'reformed', 'christ_catholic', 'none'] as const;

/** Lucerne's own keys for a tax year. */
function luOwn(taxYear: number): KeyRegistry {
  const y = luParamsFor(taxYear).taxYear;
  const choice = (def: Omit<KeyDef, 'type'>): KeyDef => ({ type: 'enum', ...def });
  const TABLE = communesFor(y).source;
  const communes = communeOptions(y).map((c) => c.slug);
  const church = `${law(y)} § 240 Abs. 1 and 2 (p. 96); ${GUIDE} p. 20 (Konfession)`;
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
      source: `${TABLE}; ${law(y)} § 237 Abs. 1 (p. 95)`,
    }),
    'profile.moved': choice({
      values: ['no', 'within_lu', 'from_other_canton', 'from_abroad', 'leaving_switzerland'],
      perPerson: false,
      label: { en: 'Moves in the year', fr: 'Déménagements dans l’année', de: 'Umzüge im Jahr' },
      source: `${GUIDE} p. 7 (Beendigung der Steuerpflicht), p. 8 (Beginn der Steuerpflicht)`,
    }),
    'lu.church': choice({
      values: CONFESSIONS,
      perPerson: true,
      label: { en: 'Confession', fr: 'Confession', de: 'Konfession' },
      official: 'Konfession',
      source: `${church}; ${TABLE}`,
    }),
    'lu.child_church': choice({
      values: CONFESSIONS,
      perPerson: true,
      label: {
        en: 'Child’s confession',
        fr: 'Confession de l’enfant',
        de: 'Konfession des Kindes',
      },
      official: 'Konfession (Kinder, Ziffer 3)',
      source: church,
    }),
    'lu.child_lives_with_you': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Lives in your household',
        fr: 'Vit dans votre ménage',
        de: 'Lebt in deinem Haushalt',
      },
      official: 'In Ihrem Haushalt?',
      source: `${GUIDE} p. 20 (Ziffer 3); ${law(y)} § 42 Abs. 1 lit. b (p. 24), § 57 Abs. 2 (p. 30)`,
    },
    'lu.child_under14': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Under 14 at the end of the year',
        fr: 'Moins de 14 ans à la fin de l’année',
        de: 'Ende Jahr jünger als 14 Jahre',
      },
      official: 'Abzug für Eigenbetreuung (353), Fremdbetreuungskosten (360)',
      source: `${law(y)} § 42 Abs. 1 lit. b (p. 24); ${GUIDE} p. 34 (353, 360)`,
    },
    'lu.child_away': {
      type: 'boolean',
      perPerson: true,
      label: {
        en: 'Stays away from home for their education',
        fr: 'Séjourne hors du domicile pour sa formation',
        de: 'Ständiger Aufenthalt am auswärtigen Ausbildungsort',
      },
      official: 'Kinderabzug bei ständigem Aufenthalt am auswärtigen Ausbildungsort (352)',
      source: `${law(y)} § 42 Abs. 1 lit. a (p. 24); ${GUIDE} p. 34 (352)`,
    },
    'lu.family_tariff': {
      type: 'boolean',
      perPerson: false,
      label: {
        en: 'The family tariff is yours (shared custody, no child support)',
        fr: 'Le barème des familles vous revient (garde partagée, sans contribution)',
        de: 'Der Familientarif steht dir zu (geteilte Obhut, ohne Unterhaltsbeiträge)',
      },
      official: 'Familientarif (§ 57 Abs. 2)',
      source: `${law(y)} § 57 Abs. 2 and 4 (p. 30); ${GUIDE} p. 20`,
    },
    'lu.child_care': {
      type: 'money',
      perPerson: true,
      label: {
        en: 'Childcare paid for this child',
        fr: 'Frais de garde payés pour cet enfant',
        de: 'Für dieses Kind bezahlte Fremdbetreuungskosten',
      },
      official: 'Fremdbetreuungskosten (360, Formular U/F)',
      source: `${law(y)} § 42 Abs. 1 lit. b (p. 24); ${stv(y)} § 14b (p. 6); ${GUIDE} p. 34 (360)`,
    },
  };
}

/**
 * Every key of a Lucerne return: the shared household keys (Lucerne asks the way to work without
 * the length of the trip by public transport, which only Geneva's meal rule needs), its own, then
 * the documents every canton shares, with the return's German terms.
 */
export function luKeys(taxYear: number): KeyRegistry {
  const y = luParamsFor(taxYear).taxYear;
  return {
    ...H,
    'profile.commute': {
      ...H['profile.commute'],
      values: H['profile.commute'].values.filter((v) => v !== 'public_transport_long'),
      official: 'Fahrkosten zwischen Wohn- und Arbeitsstätte',
      source: `${GUIDE} p. 27 (202 to 208t, Fahrkosten zwischen Wohn- und Arbeitsstätte); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    'commute.transit_usable': {
      ...H['commute.transit_usable'],
      values: H['commute.transit_usable'].values.filter((v) => v !== 'yes_long'),
      source: `${GUIDE} p. 27 (Privatfahrzeug: Fehlen eines öffentlichen Verkehrsmittels, Zeitersparnis); ch-2026-ifd-instructions-personnes-physiques p. 6`,
    },
    ...luOwn(y),
    ...KEYS_SECURITIES_2026,
    ...KEYS_WEALTH_2026,
    ...KEYS_SALARY_CERTIFICATE_2026,
    ...luTerms(KEYS_ATTESTATIONS_2026),
    ...DOCUMENT_KEYS_WEALTH_2026,
    ...KEY_CHECK_NOTE_2026,
    ...KEYS_ECH0196_2026,
  };
}
