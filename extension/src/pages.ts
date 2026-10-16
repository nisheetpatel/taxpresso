// What the three pages need from the workspace (docs/design/three-pages.md, section 4), beside the
// page itself (./journey.ts, pageOf): how sure the tax is, the questions by where they are asked,
// and each person's rough income for the basics card. Derived on every read, never stored; the
// same rules engine result, requirements and questions as everything else.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import {
  QUESTION_GROUPS,
  type Lang,
  type QuestionGroup,
  type RenderedQuestion,
} from '@taxpresso/questionnaire';
import { BARCODE_PENDING, isBarcodeDocument } from './barcode.js';
import type { Journey } from './journey.js';
import type { PlanKey, Workspace } from './workspace.js';

/**
 * The kinds of income the basics card takes a rough yearly figure for: the income source it is
 * (profile.income_sources), the key set_fact saves it under, and POST /plan's field for it. A
 * business's profit is Geneva's only (its key exists in Geneva's keys alone).
 */
export const ROUGH_INCOME = [
  { kind: 'salary', key: 'plan.gross_salary', field: 'gross' },
  { kind: 'replacement_income', key: 'plan.replacement_income', field: 'benefits' },
  { kind: 'pension', key: 'plan.pension_income', field: 'pension' },
  { kind: 'self_employment', key: 'plan.business_profit', field: 'business' },
] as const satisfies readonly { kind: string; key: PlanKey; field: string }[];

export type RoughKind = (typeof ROUGH_INCOME)[number]['kind'];
const ROUGH_KEYS: ReadonlySet<string> = new Set(ROUGH_INCOME.map((r) => r.key));

/** How sure the tax is, in words on the "how sure" bar: Rough estimate, Getting close, Exact. */
export type Confidence = 'rough' | 'close' | 'exact';

/** The fact ids the tax rests on, and whether a figure the user gave as an estimate is among them. */
function taxInputs(ws: Workspace): { used: ReadonlySet<string>; estimate: boolean } {
  const e = ws.estimate();
  if (!e.result || !e.entry) return { used: new Set(), estimate: false };
  const lines = e.entry.view.allLines(e.result);
  return {
    used: new Set(lines.flatMap((l) => l.facts ?? [])),
    estimate: lines.some((l) => l.estimates?.includes('input-estimate')),
  };
}

/** The tax while it rests on a rough income figure: its total, those figures, and what it counts. */
export interface RoughBasis {
  /** Centimes. */
  total: number;
  rough: Fact[];
  used: ReadonlySet<string>;
}

/**
 * The tax as the rough income figures make it, while it rests on one of them; nothing to compute
 * when no rough income figure is given (Workspace notes it before each change).
 */
export function roughBasis(ws: Workspace): RoughBasis | undefined {
  const given = ROUGH_INCOME.flatMap((r) =>
    (['p1', 'p2'] as const).flatMap((p) => {
      const fact = ws.ledger.get(r.key, p);
      return fact && typeof fact.value === 'number' && fact.value > 0 ? [fact] : [];
    }),
  );
  if (!given.length) return undefined;
  const total = ws.estimate().result?.total;
  if (total === null || total === undefined) return undefined;
  const { used } = taxInputs(ws);
  const rough = given.filter((f) => used.has(f.id));
  return rough.length ? { total, rough, used } : undefined;
}

/**
 * After a change: a document replaced a rough income figure the tax rested on before. That figure
 * is still given but no longer counted, and a value read from a document now counts instead (not
 * a person gone from the household, nor a figure taken back).
 */
export function replacedByDocument(ws: Workspace, before: RoughBasis): boolean {
  const { used } = taxInputs(ws);
  const dropped = before.rough.some(
    (f) => ws.ledger.get(f.key, f.person)?.id === f.id && !used.has(f.id),
  );
  return (
    dropped &&
    ws
      .countedFacts()
      .some((f) => f.source.docId !== undefined && used.has(f.id) && !before.used.has(f.id))
  );
}

/**
 * Null when there is no tax (the tax stage waits for an income). Rough when an income figure comes
 * from a rough plan figure. Exact when no input is an estimate, no value waits for the user's OK
 * and no required document is missing. Otherwise close.
 */
export function confidenceOf(ws: Workspace, j: Journey, inputs = taxInputs(ws)): Confidence | null {
  // The tax stage shows a tax (estimate or computed), or waits for an income figure.
  const tax = j.stages.find((s) => s.id === 'tax');
  if (!tax || tax.status === 'waiting') return null;
  const rough = ws.countedFacts().some((f) => ROUGH_KEYS.has(f.key) && inputs.used.has(f.id));
  if (rough) return 'rough';
  const waiting = ws.toConfirm().length > 0;
  const missing = ws.requirements().some((r) => r.status === 'missing' && !r.optional);
  return !inputs.estimate && !waiting && !missing ? 'exact' : 'close';
}

/**
 * A question as the pages ask it: rendered in the page's language (Workspace.render), with whether
 * it is answered. A commune question comes without its options, the canton's hundreds of communes,
 * the same at every read: GET /question?id=<id> gives the question with them.
 */
export type GroupQuestion = RenderedQuestion & {
  answered: boolean;
  /** The user skipped it for now ("I don't know"): asked again last. */
  skipped?: true;
};

/**
 * The questions that apply and are asked (never the derived ones), by where the pages ask them, in
 * the questionnaire's order within each group, each with its current value or suggestion.
 */
export function groupsOf(ws: Workspace, lang: Lang): Record<QuestionGroup, GroupQuestion[]> {
  const snap = ws.snapshot();
  const groups = Object.fromEntries(
    QUESTION_GROUPS.map((g) => [g, [] as GroupQuestion[]]),
  ) as Record<QuestionGroup, GroupQuestion[]>;
  for (const slot of snap.slots) {
    const rendered = ws.render(slot, lang, snap);
    // The state is read every second: the long list of communes stays with GET /question. A
    // commune question's own choices besides the communes (outside the canton) stay.
    if (rendered.type === 'commune') {
      const own = new Set((slot.question.options ?? []).map((o) => o.value));
      const kept = rendered.options?.filter((o) => own.has(o.value)) ?? [];
      if (kept.length) rendered.options = kept;
      else delete rendered.options;
    }
    groups[slot.question.group].push({
      ...rendered,
      answered: slot.value !== undefined,
      ...(ws.skipped.includes(slot.id) ? { skipped: true as const } : {}),
    });
  }
  return groups;
}

/** One rough income figure of one person. */
export interface RoughFigure {
  kind: RoughKind;
  /** Centimes. */
  amount: number;
  /** The tax shown now counts it: that person has no document for this income yet. */
  used: boolean;
}

export interface RoughView {
  /** Rough income can be given: false for a year that is over, whose documents give the figures. */
  open: boolean;
  /** The kinds this canton takes, in the card's order: the key for set_fact, the field for /plan. */
  kinds: { kind: RoughKind; key: PlanKey; field: (typeof ROUGH_INCOME)[number]['field'] }[];
  people: {
    person: 'p1' | 'p2';
    /** The figure the card shows: the latest one given, in centimes; null when none. */
    amount: number | null;
    kind: RoughKind | null;
    /** Every rough income figure of this person, in the card's order (Claude may give several). */
    figures: RoughFigure[];
  }[];
  /**
   * How far the documents moved the tax from what the rough numbers said, in centimes (below zero:
   * less), once a document replaced a rough figure (Workspace.roughTaxNoted) and the tax no longer
   * rests on one; null otherwise. "CHF 660 less than your rough numbers said."
   */
  moved: number | null;
}

/** Each person's rough income and its kind, for the basics card ("Yearly income, roughly"). */
export function roughOf(
  ws: Workspace,
  inputs = taxInputs(ws),
  confidence: Confidence | null = null,
): RoughView {
  const kinds = ROUGH_INCOME.filter((r) => ws.keys[r.key]);
  const people = ws
    .snapshot()
    .people.filter((p): p is 'p1' | 'p2' => p === 'p1' || p === 'p2')
    .map((person) => {
      const given = kinds.flatMap((r) => {
        const fact = ws.ledger.get(r.key, person);
        return fact && typeof fact.value === 'number' && fact.value > 0
          ? [
              {
                kind: r.kind,
                amount: fact.value,
                used: inputs.used.has(fact.id),
                at: fact.createdAt,
              },
            ]
          : [];
      });
      // The latest given is what the card shows: a kind changed there is the newest figure.
      const latest = given.reduce<(typeof given)[number] | undefined>(
        (best, g) => (!best || g.at > best.at ? g : best),
        undefined,
      );
      return {
        person,
        amount: latest?.amount ?? null,
        kind: latest?.kind ?? null,
        figures: given.map(({ kind, amount, used }) => ({ kind, amount, used })),
      };
    });
  const noted = ws.roughTaxNoted();
  const total = ws.estimate().result?.total;
  const moved =
    noted !== undefined &&
    (confidence === 'close' || confidence === 'exact') &&
    total !== null &&
    total !== undefined
      ? total - noted
      : null;
  return {
    open: !ws.yearOver(),
    kinds: kinds.map(({ kind, key, field }) => ({ kind, key, field })),
    people,
    moved,
  };
}

/**
 * What a file turned out to be, as "Make it exact" says it (docs/design/three-pages.md, A4): whose
 * a certificate read from its barcode is, still to say; not identified yet; values that wait for
 * the user's OK; to read (Claude reads it, once the user agrees); read on its own from its
 * barcode; or done. From the same counts as the next step (./journey.ts).
 */
export type DocumentStatus = 'whose' | 'unknown' | 'confirm' | 'read' | 'barcode' | 'done';

/** Each document's status, for GET /state's documents. */
export function documentStatus(ws: Workspace): (doc: VaultDocument) => DocumentStatus {
  const toRead = new Set(ws.toRead().map((d) => d.id));
  const toConfirm = new Set(ws.toConfirm().flatMap((f) => f.source.docId ?? []));
  return (d) =>
    d.parse.method === BARCODE_PENDING
      ? 'whose'
      : !d.kind
        ? 'unknown'
        : toConfirm.has(d.id)
          ? 'confirm'
          : isBarcodeDocument(d)
            ? 'barcode'
            : toRead.has(d.id)
              ? 'read'
              : 'done';
}

/** The three pages' state, computed once from the journey (./api.ts, GET /state). */
export function pagesState(ws: Workspace, j: Journey, lang: Lang) {
  const inputs = taxInputs(ws);
  const confidence = confidenceOf(ws, j, inputs);
  return {
    confidence,
    groups: groupsOf(ws, lang),
    rough: roughOf(ws, inputs, confidence),
  };
}
