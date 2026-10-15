// The three pages' view of the state (docs/design/three-pages.md, section 4): the page the next
// step belongs to, how sure the tax is, the questions by where they are asked, and the rough
// incomes. The extension adds these fields to GET /state; until it does, they are derived here
// from today's state (the journey, the estimate, the next question and the answers). Plain
// functions of the state, so the screens stay plain functions too.
import { useEffect, useState } from 'preact/hooks';
import { api } from './api';
import type { Language } from './i18n';
import type { Question, StageId, State } from './types';

export type PageId = 'start' | 'tax' | 'save' | 'file';
export interface PageView {
  current: PageId;
  /** False only on Start. */
  tabs: boolean;
}
export type Confidence = 'rough' | 'close' | 'exact';

export const GROUPS = ['basics', 'special', 'deduction', 'plan', 'detail'] as const;
export type GroupId = (typeof GROUPS)[number];
/** A question as GET /question renders it, and whether it is answered. */
export interface GroupQuestion extends Question {
  answered: boolean;
}
export type Groups = Record<GroupId, GroupQuestion[]>;

/** What a rough income comes from: the basics card's choice. */
export type RoughKind = 'salary' | 'benefits' | 'pension' | 'business';
export interface RoughIncome {
  person: 'p1' | 'p2';
  /** Centimes, an estimate; null when none is given. */
  amount: number | null;
  kind: RoughKind | null;
}

/** The fields GET /state gains (three-pages.md, section 4). */
export interface PagesFields {
  page: PageView;
  confidence: Confidence | null;
  groups: Groups;
  rough: RoughIncome[];
}

const PAGE_OF: Record<StageId, PageId> = {
  about: 'tax',
  documents: 'tax',
  tax: 'tax',
  save: 'save',
  file: 'file',
};

/** Start while nothing is known (or the folder can't be used); else the next step's page. */
export function pageOf(state: State): PageView {
  if (state.page) return state.page;
  const { id, stage } = state.journey.next;
  const current: PageId =
    id === 'start' || id === 'folder' ? 'start' : stage ? PAGE_OF[stage] : 'tax';
  return { current, tabs: current !== 'start' };
}

/**
 * The tab to show when the next step's page changes from `before` to `now`: the new page while you
 * were on the old one (or on none yet), else the tab you chose; the panel never jumps away.
 */
export const followPage = (shown: PageId | null, before: PageId | null, now: PageId): PageId =>
  shown === null || shown === before ? now : shown;

/** A document of this kind is in for this person (or for the household). */
const hasDocument = (state: State, kind: string, person: string) =>
  state.documents.some((d) => d.kind === kind && (d.person === person || !d.person));

/**
 * Null without a tax; rough when an income comes from a rough figure; exact when nothing is an
 * estimate, nothing waits for the user's OK and no needed document is missing; else close.
 */
export function confidenceOf(state: State): Confidence | null {
  if (state.confidence !== undefined) return state.confidence;
  const est = state.estimate;
  if (!state.journey.hasFigures || !est?.computed || est.total === null) return null;
  const rough = (state.plan?.inputs ?? []).some(
    (i) => i.gross !== null && !hasDocument(state, 'salary_certificate', i.person),
  );
  if (rough) return 'rough';
  const missing = state.requirements.some((r) => r.status === 'missing' && !r.optional);
  if (!est.estimate && est.complete && est.needsOk === 0 && state.toConfirm === 0 && !missing) {
    return 'exact';
  }
  return 'close';
}

const BASICS = new Set([
  'canton',
  'civil_status',
  'children',
  'commune',
  'income_sources',
  'residence',
  'employer_in_switzerland',
  'tou',
]);
const SPECIAL =
  /^(moved|arrival_date|departure_date|special|pension_capital|business_|abroad_property|swiss_property)/;
const DEDUCTION = /^(commute|meal_days|childcare|child_care|payments)/;
const PLAN = new Set(['pillar3a', 'lpp_buyin']);

/** Where a question is asked (three-pages.md, section 3). */
export function groupOf(questionId: string): GroupId {
  if (BASICS.has(questionId)) return 'basics';
  if (PLAN.has(questionId)) return 'plan';
  if (SPECIAL.test(questionId)) return 'special';
  if (DEDUCTION.test(questionId)) return 'deduction';
  return 'detail';
}

const emptyGroups = (): Groups => ({
  basics: [],
  special: [],
  deduction: [],
  plan: [],
  detail: [],
});

/**
 * The questions by group. Without the extension's groups: the questions fetched one by one
 * (`known`), the next question, and the answered ones as far as the state tells.
 */
export function groupsOf(state: State, known: GroupQuestion[] = []): Groups {
  if (state.groups) return state.groups;
  const out = emptyGroups();
  const seen = new Set<string>();
  const add = (q: GroupQuestion) => {
    if (seen.has(q.id)) return;
    seen.add(q.id);
    out[groupOf(q.questionId)].push(q);
  };
  known.forEach(add);
  if (state.question) add({ ...state.question, answered: false });
  for (const a of state.answers) {
    const [questionId = a.id, person = 'household'] = a.id.split(':');
    add({
      id: a.id,
      questionId,
      person,
      type: 'choice',
      text: a.question,
      ...(a.who ? { who: a.who } : {}),
      answered: true,
    });
  }
  return out;
}

/** Each person's rough income and what it comes from. */
export function roughOf(state: State): RoughIncome[] {
  if (state.rough) return state.rough;
  return (state.plan?.inputs ?? []).map((i) => ({
    person: i.person,
    amount: i.gross,
    kind: i.gross !== null ? ('salary' as const) : null,
  }));
}

export function pagesOf(state: State, known: GroupQuestion[] = []): PagesFields {
  return {
    page: pageOf(state),
    confidence: confidenceOf(state),
    groups: groupsOf(state, known),
    rough: roughOf(state),
  };
}

/** The questions the panel shows by itself, fetched while GET /state has no groups. */
const PROBE = [
  'canton',
  'civil_status',
  'children',
  'commune',
  'moved',
  'special',
  'childcare',
  'payments',
];
const PROBE_PER_PERSON = [
  'income_sources',
  'residence',
  'employer_in_switzerland',
  'tou',
  'pillar3a',
  'lpp_buyin',
  'commute',
  'meal_days',
];
/** Asked once their first question is answered: per person, or for the household. */
const THEN_PER_PERSON: Record<string, string[]> = {
  commute: [
    'commute_transit_cost',
    'commute_transit_usable',
    'commute_transit_equivalent',
    'commute_distance',
    'commute_drive_days',
  ],
  moved: ['arrival_date', 'departure_date'],
  special: ['pension_capital'],
  income_sources: ['business_form', 'business_year', 'business_place', 'business_method'],
};
const THEN: Record<string, string[]> = {
  special: [
    'swiss_property',
    'swiss_property_owner',
    'swiss_property_since',
    'swiss_property_old',
    'swiss_property_loan',
    'abroad_property',
    'abroad_property_owner',
    'abroad_property_country',
    'abroad_property_old',
    'abroad_property_loan',
  ],
  childcare: ['child_care:child1', 'child_care:child2', 'child_care:child3', 'child_care:child4'],
};

/** The question ids to fetch: those of the card, the chips and the costs, and what follows. */
export function probeIds(state: State): string[] {
  const people = state.people.map((p) => p.id);
  const answered = new Set(state.answers.map((a) => a.id.split(':')[0]!));
  return [
    ...new Set([
      ...PROBE,
      ...PROBE_PER_PERSON.flatMap((q) => people.map((p) => `${q}:${p}`)),
      ...Object.entries(THEN_PER_PERSON).flatMap(([root, then]) =>
        answered.has(root) ? then.flatMap((q) => people.map((p) => `${q}:${p}`)) : [],
      ),
      ...Object.entries(THEN).flatMap(([root, then]) => (answered.has(root) ? then : [])),
      ...state.answers.map((a) => a.id).filter((id) => groupOf(id.split(':')[0]!) !== 'detail'),
    ]),
  ];
}

/**
 * Until GET /state has `groups`: the questions of the basics card, the chips and the costs,
 * fetched as GET /question renders them (a question that doesn't apply is refused and left out).
 */
export function useKnownQuestions(state: State | null, lang: Language): GroupQuestion[] {
  const [known, setKnown] = useState<{ key: string; list: GroupQuestion[] }>({
    key: '',
    list: [],
  });
  const key = state
    ? JSON.stringify([
        lang,
        state.taxYear,
        state.question?.id,
        state.answers.map((a) => [a.id, a.answer]),
        state.documents.length,
      ])
    : '';
  useEffect(() => {
    if (!state || state.groups || key === known.key) return;
    let live = true;
    void Promise.allSettled(probeIds(state).map((id) => api.question(id, lang))).then((all) => {
      if (!live) return;
      const list = all.flatMap((r) =>
        r.status === 'fulfilled' ? [{ ...r.value, answered: r.value.value !== undefined }] : [],
      );
      setKnown({ key, list });
    });
    return () => void (live = false);
  }, [key]);
  return state?.groups ? [] : known.list;
}
