// Values Claude reads from a document and proposes (SPEC.md section 5.5), checked here before they
// reach the ledger. Everything is deterministic: money and dates are parsed from the text Claude
// read, never guessed, and anything that doesn't fit is refused with a reason Claude can act on.
import {
  DOCUMENT_KINDS,
  formatMoneyPlain,
  invalidValue,
  parseDate,
  parseMoney,
  type DocumentKind,
  type FactValue,
  type KeyDef,
  type KeyRegistry,
} from '@taxpresso/ledger';
import { documentFields, DOCUMENT_KEYS_2026 } from '@taxpresso/rules-ge';
import { KIND_LABELS } from './kinds.js';

export class ExtractionError extends Error {}

/** Keys Claude may propose from a document, and the user may confirm or correct. */
export const DOCUMENT_VALUE_KEYS = Object.keys(DOCUMENT_KEYS_2026).filter(
  (k) => k !== 'check.note',
) as [string, ...string[]];

export interface ProposedValue {
  key: string;
  value: string | number | boolean;
  page: number;
  box?: string | undefined;
  person?: 'p1' | 'p2' | undefined;
}

export interface ProposedDetails {
  kind?: DocumentKind | undefined;
  person?: 'p1' | 'p2' | 'household' | undefined;
  taxYear?: number | undefined;
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
  issuer?: string | undefined;
}

/** "8." or " 8 " -> "8"; "Ch. 13.2.1" -> "13.2.1"; "lettre E" -> "E". */
export function normalizeBox(box: string): string {
  return box
    .trim()
    .replace(/^(?:ch(?:iffre)?\.?|box|case|lettre|letter|n[o°]\.?)\s*/i, '')
    .replace(/\.$/, '')
    .toUpperCase();
}

/**
 * Turns what Claude read (or the user typed) into the ledger value for `def`. Money must be text
 * exactly as printed: a JSON number could already have lost a centime to floating point.
 */
export function coerceValue(key: string, def: KeyDef, raw: unknown): FactValue {
  let value: FactValue;
  switch (def.type) {
    case 'money': {
      if (typeof raw !== 'string') {
        throw new ExtractionError(
          `${key}: give money as text, exactly as printed, e.g. "12'345.60" (not a number).`,
        );
      }
      const parsed = parseMoney(raw);
      if (!parsed.ok) throw new ExtractionError(`${key}: ${parsed.reason}.`);
      value = parsed.value;
      break;
    }
    case 'date': {
      const parsed = parseDate(String(raw));
      if (!parsed.ok) throw new ExtractionError(`${key}: ${parsed.reason}.`);
      value = parsed.value;
      break;
    }
    case 'boolean':
      if (typeof raw === 'boolean') value = raw;
      else if (raw === 'true' || raw === 'false') value = raw === 'true';
      else throw new ExtractionError(`${key}: expected true or false.`);
      break;
    case 'integer': {
      const n = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : raw;
      if (typeof n !== 'number') throw new ExtractionError(`${key}: expected a whole number.`);
      value = n;
      break;
    }
    case 'enum':
    case 'string':
      if (typeof raw !== 'string') throw new ExtractionError(`${key}: expected text.`);
      value = raw.trim();
      break;
    default:
      throw new ExtractionError(`${key} can't be set this way.`);
  }
  const problem = invalidValue(def, value);
  if (problem) throw new ExtractionError(`${key}: ${problem}.`);
  return value;
}

/** The value as typed into the official form, or undefined when there is nothing to type. */
export function formValue(def: KeyDef, value: FactValue): string | undefined {
  if (def.type === 'money' && typeof value === 'number') return formatMoneyPlain(value);
  if (def.type === 'date' && typeof value === 'string') {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  if (def.type === 'integer' && typeof value === 'number') return String(value);
  if (def.type === 'string' && typeof value === 'string') return value;
  return undefined;
}

/** Labels for the choices of enum keys read from documents, for people (not for the form). */
export const ENUM_LABELS: Record<string, Record<string, { en: string; fr: string }>> = {
  'replacement.type': {
    unemployment: { en: 'Unemployment', fr: 'Chômage' },
    apg_service: { en: 'APG (military or civil service)', fr: 'APG (service militaire ou civil)' },
    maternity_paternity: { en: 'Maternity or paternity', fr: 'Maternité ou paternité' },
    sickness_accident: { en: 'Sickness or accident', fr: 'Maladie ou accident' },
    disability: { en: 'Disability', fr: 'Invalidité' },
    other: { en: 'Other', fr: 'Autre' },
  },
  'pension.type': {
    avs_ai: { en: 'AVS/AI pension', fr: 'Rente AVS/AI' },
    occupational: { en: 'Pension fund (2nd pillar)', fr: 'Prévoyance professionnelle (2e pilier)' },
    other: { en: 'Other pension', fr: 'Autre rente' },
  },
  'securities.income_kind': {
    dividend: { en: 'Dividends', fr: 'Dividendes' },
    interest: { en: 'Interest', fr: 'Intérêts' },
    mixed: { en: 'Dividends and other income', fr: 'Dividendes et autres rendements' },
  },
  'assessment.tax': {
    icc: { en: 'Cantonal and communal tax (ICC)', fr: 'Impôt cantonal et communal (ICC)' },
    ifd: { en: 'Federal direct tax (IFD)', fr: 'Impôt fédéral direct (IFD)' },
    icc_ifd: { en: 'Both (ICC and IFD)', fr: 'Les deux (ICC et IFD)' },
  },
  'capital.reason': {
    retirement: { en: 'Retirement', fr: 'Retraite' },
    home: {
      en: 'Buying or paying off your own home',
      fr: 'Encouragement à la propriété du logement',
    },
    self_employment: {
      en: 'Starting out self-employed',
      fr: 'Début d’une activité lucrative indépendante',
    },
    leaving: { en: 'Leaving Switzerland', fr: 'Départ définitif de la Suisse' },
    other: { en: 'Another reason', fr: 'Autre motif' },
  },
};

/** What Claude should look for on a document of this kind, for get_document_for_review. */
export function fieldsGuide(kind: DocumentKind | undefined, keys: KeyRegistry): string {
  const fields = documentFields(kind);
  if (!kind || fields.length === 0) {
    const kinds = DOCUMENT_KINDS.filter((k) => documentFields(k).length > 0).join(', ');
    return kind
      ? `This kind of document (${KIND_LABELS[kind].en}) gives no values yet: propose only its details.`
      : `Kind not known yet: say what it is (document.kind). Kinds with values: ${kinds}; anything else: other.`;
  }
  const lines = fields.map((key) => {
    const def = keys[key]!;
    const box = def.box ? `box ${def.box}, ` : '';
    const choices = def.type === 'enum' ? ` (one of: ${def.values?.join(', ')})` : '';
    const type = def.type === 'money' ? 'amount as printed' : def.type;
    return `- ${key}: ${box}${def.official ?? def.label.fr} (${def.label.en}); ${type}${choices}`;
  });
  return [`Values to look for on a ${KIND_LABELS[kind].en.toLowerCase()}:`, ...lines].join('\n');
}
