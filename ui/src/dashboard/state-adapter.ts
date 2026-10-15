// The three pages' part of GET /state (docs/design/three-pages.md, sections 4 and 9; extension
// src/pages.ts and journey.ts, pageOf): the page the next step belongs to, how sure the tax is, the
// questions by where they are asked, and the rough incomes. Kept in step by the extension's tests.
// The one thing the state leaves out, the commune's long list of options, is fetched once here.
import { useEffect, useState } from 'preact/hooks';
import { api } from './api';
import type { Language } from './i18n';
import type { Question, State } from './types';

export type PageId = 'start' | 'tax' | 'save' | 'file';
export interface PageView {
  current: PageId;
  /** False only on Start. */
  tabs: boolean;
}
export type Confidence = 'rough' | 'close' | 'exact';

export const GROUPS = ['basics', 'special', 'deduction', 'plan', 'detail'] as const;
export type GroupId = (typeof GROUPS)[number];
/** A question as the pages ask it, rendered in the page's language, and whether it is answered. */
export interface GroupQuestion extends Question {
  answered: boolean;
  /** Skipped for now ("I don't know"): asked again last. */
  skipped?: true;
}
export type Groups = Record<GroupId, GroupQuestion[]>;

/** What a rough income comes from: its income source (profile.income_sources). */
export type RoughKind = 'salary' | 'replacement_income' | 'pension' | 'self_employment';
/** POST /plan's field for each rough income. */
export type RoughField = 'gross' | 'benefits' | 'pension' | 'business';

export interface RoughPerson {
  person: 'p1' | 'p2';
  /** The figure the card shows, in centimes; null when none is given. */
  amount: number | null;
  kind: RoughKind | null;
  /** Every rough figure of this person; `used` while no document gives that income. */
  figures: { kind: RoughKind; amount: number; used: boolean }[];
}

export interface RoughView {
  /** False for a year that is over: its documents give the figures. */
  open: boolean;
  /** The kinds this canton takes, in the card's order (a business's profit is Geneva's only). */
  kinds: { kind: RoughKind; key: string; field: RoughField }[];
  people: RoughPerson[];
}

/** The fields GET /state has for the three pages. */
export interface PagesFields {
  page: PageView;
  confidence: Confidence | null;
  groups: Groups;
  rough: RoughView;
}

/** The page to show: Start while nothing is known, else the tab chosen or the next step's page. */
export const shownPage = (page: PageView, tab: PageId | null): PageId =>
  page.current === 'start' ? 'start' : (tab ?? page.current);

/**
 * The tab to show when the next step's page changes from `before` to `now`: the new page while you
 * were on the old one (or on none yet), else the tab you chose; the panel never jumps away.
 */
export const followPage = (shown: PageId | null, before: PageId | null, now: PageId): PageId =>
  shown === null || shown === before ? now : shown;

/** The commune question with its options, when they are known. */
export function withCommunes(state: State, options: Question['options']): PagesFields {
  const commune = state.groups.basics.find((q) => q.type === 'commune' && !q.options);
  const groups =
    commune && options
      ? {
          ...state.groups,
          basics: state.groups.basics.map((q) => (q.id === commune.id ? { ...q, options } : q)),
        }
      : state.groups;
  return { page: state.page, confidence: state.confidence, groups, rough: state.rough };
}

/**
 * The pages' view of the state. GET /state leaves the commune's options out (hundreds of communes,
 * read every second); GET /question gives them, fetched once per canton and language.
 */
export function useCommunes(state: State | null, lang: Language): PagesFields | null {
  const commune = state?.groups.basics.find((q) => q.type === 'commune' && !q.options);
  const key = commune ? `${commune.id}:${state?.canton?.code ?? ''}:${lang}` : '';
  const [loaded, setLoaded] = useState<{ key: string; options: Question['options'] }>({
    key: '',
    options: undefined,
  });
  useEffect(() => {
    if (!commune || key === loaded.key) return;
    let live = true;
    void api.question(commune.id, lang).then(
      (q) => live && setLoaded({ key, options: q.options }),
      () => undefined,
    );
    return () => void (live = false);
  }, [key]);
  if (!state) return null;
  return withCommunes(state, key === loaded.key ? loaded.options : undefined);
}
