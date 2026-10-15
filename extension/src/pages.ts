// What the three pages need from the workspace (docs/design/three-pages.md, section 4), beside the
// page itself (./journey.ts, pageOf): how sure the tax is, the questions by where they are asked,
// and each person's rough income for the basics card. Derived on every read, never stored; the
// same rules engine result, requirements and questions as everything else.
import {
  QUESTION_GROUPS,
  type Lang,
  type QuestionGroup,
  type RenderedQuestion,
} from '@taxpresso/questionnaire';
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
    // The state is read every second: the long list of communes stays with GET /question.
    if (rendered.type === 'commune') delete rendered.options;
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
}

/** Each person's rough income and its kind, for the basics card ("Yearly income, roughly"). */
export function roughOf(ws: Workspace, inputs = taxInputs(ws)): RoughView {
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
  return {
    open: !ws.yearOver(),
    kinds: kinds.map(({ kind, key, field }) => ({ kind, key, field })),
    people,
  };
}

/** The three pages' state, computed once from the journey (./api.ts, GET /state). */
export function pagesState(ws: Workspace, j: Journey, lang: Lang) {
  const inputs = taxInputs(ws);
  return {
    confidence: confidenceOf(ws, j, inputs),
    groups: groupsOf(ws, lang),
    rough: roughOf(ws, inputs),
  };
}
