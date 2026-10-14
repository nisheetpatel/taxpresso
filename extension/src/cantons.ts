// The cantons Taxpresso prepares a return for (docs/design/cantons.md, section 2): for each, its
// rules (packages/rules-<c>), its questionnaire (data/<c>/<year>) and its communes, and the questions
// every canton shares, which are all Taxpresso asks until it knows the canton. The canton is the
// answer to the first question (profile.canton); one tax year has one canton.
import { FORM_2025, FORM_2026, LEDGER_ROUTES_2026 } from '@taxpresso/filing-ge';
import { zurichFormMap, zurichLineOf } from '@taxpresso/filing-zh';
import type { Fact, FactValue, KeyRegistry, Ledger, VaultDocument } from '@taxpresso/ledger';
import {
  geQuestionnaire2026,
  QuestionnaireEngine,
  sharedQuestionnaire2026,
  zhQuestionnaire2026,
  type QuestionnaireFile,
} from '@taxpresso/questionnaire';
import {
  cantonInputFromFacts,
  KEYS_CANTON_2026,
  SUPPORTED_CANTONS,
  type CantonAnswer,
  type CantonCode,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type CantonRules,
  type CantonTerms,
  type ResultView,
  type SupportedCanton,
  type TaxResult,
  type Text,
} from '@taxpresso/rules-ch';
import {
  COMMUNES_2026,
  computeReturn as genevaReturn,
  engineInputFromFacts,
  rules as genevaRules,
  view as genevaView,
} from '@taxpresso/rules-ge';
import {
  communeOptions,
  NOTE_VALUABLES,
  rules as zurichRules,
  view as zurichView,
  ZH_FORM_NOTE,
  ZH_TERMS,
  ZURICH_READING,
} from '@taxpresso/rules-zh';
import { movableWealth } from './wealth.js';

/** A canton's name in the UI languages. */
export interface CantonName extends Text {
  de: string;
}

/** What a canton's tax is computed from: the values that count, for the tax year. */
export interface LedgerContext {
  taxYear: number;
  /** The ledger's current facts, without those of documents replaced or gone. */
  facts: readonly Fact[];
  /** The documents that count. */
  documents: readonly VaultDocument[];
  /** The people of the household. */
  people: readonly ('p1' | 'p2')[];
}

/** The tax of the year from the ledger: null while answers it needs are missing. */
export interface LedgerEstimate {
  result: TaxResult | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

/** The canton's official form, as the generic views place values on it. */
export interface CantonFilingEntry {
  /** Where each line code stands on the official form (lower first); undefined: not on it. */
  formOrder(taxYear: number): (code: string) => number | undefined;
  /** The line a ledger value goes to on the form, for this person (the final check's titles). */
  lineOf(key: string, person: string): string | undefined;
  /** The line of a person's salary, for a rough salary given as an estimate. */
  salaryLine(person: string): string;
  /** Shown when the form's codes and labels come from an earlier year. */
  formNote(taxYear: number): Text | undefined;
  /** Taxpresso checks the PDF of the canton's declaration (reconcile_official_pdf): Geneva only. */
  checksPdf: boolean;
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
  /** The tax of the year: the ledger read into the canton's household input, then its engine. */
  estimate(ctx: LedgerContext): LedgerEstimate;
  /** How its result reads in the generic views (compute_tax, the estimate card, the plans). */
  view: ResultView;
  /** The official form. */
  filing: CantonFilingEntry;
  /**
   * The official terms of the canton's form for the generic texts (final check, plans, copy
   * panel). Absent for Geneva, whose texts are the defaults everywhere.
   */
  terms?: CantonTerms;
  /**
   * Every canton but Geneva (whose engine reads its own input, with the état des titres): the
   * ledger read into the shared household input, with the canton's own part (`cantonal`).
   */
  household?(ctx: LedgerContext): CantonLedgerInput<unknown>;
}

/**
 * A canton read through the shared ledger reading (rules-ch, cantonInputFromFacts) and computed by
 * its rules behind the canton interface: everything but its own answers is generic.
 * `valuables`: the note when the canton's form has its own lines for cash, gold and vehicles.
 */
export function sharedLedger<Cantonal extends object>(
  reading: CantonLedgerReading<Cantonal>,
  rules: CantonRules<Cantonal, TaxResult>,
  valuables?: Text,
): Pick<CantonEntry, 'estimate' | 'household'> {
  const household = (ctx: LedgerContext) =>
    cantonInputFromFacts(
      ctx.taxYear,
      ctx.facts,
      ctx.documents,
      reading,
      movableWealth(ctx.taxYear, ctx.people, ctx.facts, ctx.documents, valuables),
    );
  return {
    household,
    estimate(ctx) {
      const { input, missing, notes } = household(ctx);
      return { result: input ? rules.computeReturn(input) : null, missing, notes };
    },
  };
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
  // Geneva's engine reads its own input, with the état des titres (@taxpresso/rules-ge).
  estimate(ctx) {
    const { input, missing, notes } = engineInputFromFacts(ctx.taxYear, ctx.facts, ctx.documents);
    return { result: input ? genevaReturn(input) : null, missing, notes };
  },
  view: genevaView,
  filing: {
    formOrder(taxYear) {
      // The place of each rubric code on the official form, page by page.
      const form = taxYear === 2025 ? FORM_2025 : FORM_2026;
      const order = new Map<string, number>();
      form.rubrics.forEach((r, i) => {
        const code = r.code ?? r.key;
        if (!order.has(code)) order.set(code, i);
      });
      return (code) => order.get(code);
    },
    lineOf(key, person) {
      // The rubric a ledger value goes to, for this person (@taxpresso/filing-ge's routes).
      const route = LEDGER_ROUTES_2026.find((r) => r.key === key);
      if (!route) return undefined;
      if (typeof route.to === 'string')
        return /^\d{2}\.\d{2}$/.test(route.to) ? route.to : undefined;
      return person === 'p2' ? route.to.B : route.to.A;
    },
    salaryLine: (person) => (person === 'p2' ? '21.10' : '11.10'),
    formNote(taxYear) {
      const form = taxYear === 2025 ? FORM_2025 : FORM_2026;
      return form.provisional && form.note ? form.note : undefined;
    },
    checksPdf: true,
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
  ...sharedLedger(ZURICH_READING, zurichRules, NOTE_VALUABLES),
  view: zurichView,
  filing: {
    formOrder(taxYear) {
      // The form's order: the main form's lines first (p. 2 to 4), then the annexes' own lines.
      const form = zurichFormMap(taxYear);
      const main = form.rubrics.filter((r) => r.page.startsWith('S'));
      const order = new Map<string, number>();
      [...main, ...form.rubrics.filter((r) => !main.includes(r))].forEach((r, i) => {
        if (!order.has(r.key)) order.set(r.key, i);
      });
      return (code) => order.get(code);
    },
    lineOf: zurichLineOf,
    salaryLine: (person) => zurichLineOf('salary.gross', person)!,
    formNote: () => ZH_FORM_NOTE,
    checksPdf: false,
  },
  terms: ZH_TERMS,
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
