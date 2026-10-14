// The cantons Taxpresso prepares a return for (docs/design/cantons.md, section 2): for each, its
// rules (packages/rules-<c>), its questionnaire (data/<c>/<year>) and its communes, and the questions
// every canton shares, which are all Taxpresso asks until it knows the canton. The canton is the
// answer to the first question (profile.canton); one tax year has one canton.
import type { FactValue, KeyRegistry, Ledger } from '@taxpresso/ledger';
import {
  geQuestionnaire2026,
  QuestionnaireEngine,
  sharedQuestionnaire2026,
  zhQuestionnaire2026,
  type QuestionnaireFile,
} from '@taxpresso/questionnaire';
import {
  KEYS_CANTON_2026,
  SUPPORTED_CANTONS,
  type CantonAnswer,
  type CantonCode,
  type SupportedCanton,
  type Text,
} from '@taxpresso/rules-ch';
import { COMMUNES_2026, rules as genevaRules } from '@taxpresso/rules-ge';
import { communeOptions, rules as zurichRules } from '@taxpresso/rules-zh';

/** A canton's name in the UI languages. */
export interface CantonName extends Text {
  de: string;
}

export interface CantonEntry {
  code: SupportedCanton;
  name: CantonName;
  /** The canton's free official tax software, for "not supported" answers. */
  software: string;
  /** The canton's tax rules behind the canton interface (packages/rules-ch, canton.ts). */
  rules: { canton: CantonCode; taxYears: readonly number[] };
  /** The canton's questionnaire for the year, or undefined while it has none. */
  questionnaire(taxYear: number): QuestionnaireFile | undefined;
  /** Every ledger key of the year: the canton question, the shared keys and the canton's own. */
  keys(taxYear: number): KeyRegistry;
  /** The communes the questionnaire offers, by the value stored for profile.commune. */
  communes(taxYear: number): { slug: string; name: string }[];
  /**
   * For a return started before Taxpresso asked for the canton: the answers that only this canton
   * asks, in words, when there are some (then the return is taken as this canton's).
   */
  inferFrom?(ledger: Ledger): Text[];
}

/** An answer the user gave (stated), not a suggestion read from a document. */
const stated = (ledger: Ledger, key: string): FactValue | undefined => {
  const f = ledger.get(key);
  return f && f.status !== 'extracted' ? f.value : undefined;
};

const GENEVA: CantonEntry = {
  code: 'GE',
  name: { en: 'Geneva', fr: 'Genève', de: 'Genf' },
  software: 'GeTax',
  rules: genevaRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? geQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...genevaRules.keys(taxYear) }),
  communes: () => COMMUNES_2026.map((c) => ({ slug: c.slug, name: c.name })),
  inferFrom(ledger) {
    const why: Text[] = [];
    const commune = stated(ledger, 'profile.commune');
    if (typeof commune === 'string' && COMMUNES_2026.some((c) => c.slug === commune)) {
      why.push({ en: 'your commune is in Geneva', fr: 'votre commune est genevoise' });
    }
    if (stated(ledger, 'profile.moved') === 'within_geneva') {
      why.push({ en: 'you moved within Geneva', fr: 'vous avez déménagé dans le canton' });
    }
    if (['p1', 'p2'].some((p) => ledger.get('profile.tou', p as 'p1')?.status === 'stated')) {
      why.push({ en: 'you answered about TOU', fr: 'vous avez répondu sur la TOU' });
    }
    return why;
  },
};

const ZURICH: CantonEntry = {
  code: 'ZH',
  name: { en: 'Zurich', fr: 'Zurich', de: 'Zürich' },
  software: 'ZHprivateTax',
  rules: zurichRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? zhQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...zurichRules.keys(taxYear) }),
  communes: (taxYear) => communeOptions(taxYear),
};

export const CANTONS: Readonly<Record<SupportedCanton, CantonEntry>> = { GE: GENEVA, ZH: ZURICH };

/** The canton of the year being prepared, and how Taxpresso knows it. */
export interface CantonState {
  /** undefined: not answered yet. 'other': a canton Taxpresso doesn't cover yet. */
  answer: CantonAnswer | undefined;
  /** The canton whose return this is, when Taxpresso covers it. */
  canton: CantonEntry | undefined;
  /** answer: the user said so. earlier_answers: taken from answers only this canton asks. */
  from: 'answer' | 'earlier_answers' | 'none';
  /** With earlier_answers: which answers, in words. */
  because: Text[];
}

/** The questionnaire engines, one per canton and one for the questions every canton shares. */
export class CantonRegistry {
  readonly taxYear: number;
  readonly #engines = new Map<string, QuestionnaireEngine>();
  /** Every key any canton of the year knows: what the ledger accepts (one year, one ledger). */
  readonly ledgerKeys: KeyRegistry;

  constructor(taxYear: number) {
    this.taxYear = taxYear;
    this.ledgerKeys = mergeKeys([
      KEYS_CANTON_2026,
      ...SUPPORTED_CANTONS.map((c) => CANTONS[c].keys(taxYear)),
    ]);
  }

  /** What the canton of the ledger's year is, from the answer or, before it, the other answers. */
  state(ledger: Ledger): CantonState {
    const answer = stated(ledger, 'profile.canton');
    if (answer === 'GE' || answer === 'ZH') {
      return { answer, canton: CANTONS[answer], from: 'answer', because: [] };
    }
    if (answer === 'other') return { answer, canton: undefined, from: 'answer', because: [] };
    for (const code of SUPPORTED_CANTONS) {
      const because = CANTONS[code].inferFrom?.(ledger) ?? [];
      if (because.length) {
        return { answer: code, canton: CANTONS[code], from: 'earlier_answers', because };
      }
    }
    return { answer: undefined, canton: undefined, from: 'none', because: [] };
  }

  /** The keys of a canton's return; before the canton is known, the shared ones. */
  keys(canton: CantonEntry | undefined): KeyRegistry {
    return canton ? canton.keys(this.taxYear) : this.ledgerKeys;
  }

  /** The questionnaire of a canton; its own once it has one, else the questions every canton shares. */
  engine(canton: CantonEntry | undefined): QuestionnaireEngine {
    const file = canton?.questionnaire(this.taxYear);
    const id = file && canton ? canton.code : 'shared';
    let engine = this.#engines.get(id);
    if (!engine) {
      engine =
        file && canton
          ? new QuestionnaireEngine(file, canton.keys(this.taxYear), canton.communes(this.taxYear))
          : new QuestionnaireEngine(sharedQuestionnaire2026(), this.ledgerKeys, []);
      this.#engines.set(id, engine);
    }
    return engine;
  }
}

/**
 * The keys of several registries together. A key two cantons both define must be the same key,
 * except for the values of a choice (each canton's communes), which are joined.
 */
export function mergeKeys(registries: readonly KeyRegistry[]): KeyRegistry {
  const out: Record<string, KeyRegistry[string]> = {};
  for (const reg of registries) {
    for (const [key, def] of Object.entries(reg)) {
      const had = out[key];
      if (!had) {
        out[key] = def;
        continue;
      }
      if (had === def) continue;
      if (
        had.type !== def.type ||
        had.perPerson !== def.perPerson ||
        Boolean(had.multiple) !== Boolean(def.multiple)
      ) {
        throw new Error(`Key ${key} differs between cantons: ${had.type} and ${def.type}`);
      }
      if (had.values || def.values) {
        out[key] = { ...had, values: [...new Set([...(had.values ?? []), ...(def.values ?? [])])] };
      }
    }
  }
  return out;
}
