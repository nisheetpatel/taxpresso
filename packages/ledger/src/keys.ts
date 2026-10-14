// Shape of a canonical key definition. The keys themselves live with the rules, per tax year
// (packages/rules-ge/src/<year>/keys.ts, SPEC.md section 4); the ledger only checks values against them.
import { isIsoDate } from './money.js';
import type { FactValue } from './types.js';

/** `date` values are text written YYYY-MM-DD. */
export type KeyType = 'money' | 'integer' | 'boolean' | 'string' | 'enum' | 'enum_list' | 'date';

export interface KeyDef {
  type: KeyType;
  /** Allowed values for enum and enum_list keys. */
  values?: readonly string[];
  /** true: one value per person (p1, p2, children); false: one value for the household. */
  perPerson: boolean;
  /**
   * true: the key repeats (one value per employer, account, security or document), so every fact
   * names its `instance`. false or unset: one value per person.
   */
  multiple?: boolean;
  min?: number;
  max?: number;
  label: { en: string; fr: string; de?: string; it?: string };
  /** The term used on the official French form or guide, shown next to the gloss. */
  official?: string;
  /** For values read from a document: the box (chiffre) or letter on it, e.g. '8' or 'E'. */
  box?: string;
  /** Where the label, the box number or the rule comes from: manifest id plus page or article. */
  source?: string;
}

export type KeyRegistry = Readonly<Record<string, KeyDef>>;

/** Returns why `value` is not valid for `def`, or undefined if it is. */
export function invalidValue(def: KeyDef, value: FactValue): string | undefined {
  switch (def.type) {
    case 'money':
      // Integer centimes, never floats (SPEC.md section 4).
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        return 'money must be an integer number of centimes';
      }
      break;
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'expected an integer';
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return 'expected true or false';
      return undefined;
    case 'string':
      if (typeof value !== 'string' || value.length > 500) return 'expected a short text';
      return undefined;
    case 'date':
      if (typeof value !== 'string' || !isIsoDate(value)) return 'expected a date (YYYY-MM-DD)';
      return undefined;
    case 'enum':
      if (typeof value !== 'string' || !def.values?.includes(value)) {
        return `expected one of ${def.values?.join(', ')}`;
      }
      return undefined;
    case 'enum_list':
      if (!Array.isArray(value) || !value.every((v) => def.values?.includes(v))) {
        return `expected a list of ${def.values?.join(', ')}`;
      }
      if (new Set(value).size !== value.length) return 'expected each value once';
      return undefined;
  }
  if (def.min !== undefined && value < def.min) return `must be at least ${def.min}`;
  if (def.max !== undefined && value > def.max) return `must be at most ${def.max}`;
  return undefined;
}

/** Instance ids: document ids, ISINs, short slugs. */
export const INSTANCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
