// The /api/state shape (extension/src/api.ts, dashboardState). Kept in step by the API tests.
import type { Language } from './i18n';
import type { EstimateView } from './Estimate';
import type { LastYearView } from './LastYear';
import type { ReviewView } from './Review';
import type { CopyPanelState } from './types-copy';
import type { FinalCheckState } from './types-final-check';
import type { HoldingsView, SecuritiesView } from './types-holdings';
import type { DocumentsState } from './types-docs';
import type { PlanningState } from './types-planning';

export type QuestionType = 'choice' | 'yesno' | 'number' | 'money' | 'multi' | 'commune';
export type Value = string | number | boolean | string[];

export interface OfficialLink {
  url: string;
  label: string;
}

export interface Question {
  id: string;
  questionId: string;
  person: string;
  who?: string;
  type: QuestionType;
  text: string;
  help?: string;
  explain?: string;
  /** An official page on the topic, shown as "Official page" in the explanation. */
  learnMore?: OfficialLink;
  /** A page of the Taxpresso project, such as the vote for the next canton. */
  link?: OfficialLink;
  options?: { value: string; label: string; notSupported: boolean }[];
  none?: string;
  min?: number;
  max?: number;
  value?: Value;
  skipped?: boolean;
  /** Read from a document (last year's declaration), not an answer yet: the user confirms it. */
  suggested?: Value;
  suggestedFrom?: { kind?: string; year?: number; page?: number };
  /** Taken from other answers (a return started before the canton question). */
  assumed?: boolean;
}

export interface RequirementView {
  id: string;
  label: string;
  reason: string;
  explain?: string;
  learnMore?: OfficialLink;
  /** Same for every person's copy of one requirement (e.g. health premiums for you and your partner). */
  group: string;
  status: 'missing' | 'satisfied' | 'estimated' | 'waived';
  have: number;
  need: number;
  optional: boolean;
  who?: string;
  /** The kind a document uploaded from this row gets. */
  kind?: string;
  person: string;
}

export interface DocumentView {
  id: string;
  filename: string;
  bytes: number;
  addedAt: string;
  kind?: string;
  kindLabel?: string;
  /** How the kind is known: 'export' or 'pdf_text' when read from the file itself (a broker export, last year's declaration); 'claude' while it is only Claude's reading, not confirmed by the user. */
  kindSource?: string;
  person?: string;
  /** Read from its barcode (verified values); "pending" until the user says whose it is. */
  barcode?: 'read' | 'pending';
}

export interface Activity {
  at: string;
  by: 'claude' | 'you';
  what: string;
  detail?: string;
}

/** A tax year that is over (extension/src/planning.ts, yearOverView). */
export interface YearOverView {
  year: number;
  /** The year whose plans apply now (3a, buy-in, 3a catch-up): one step away. */
  plansIn: number;
  paidInYear: string;
  catchUp?: { sources: string[] };
  tou?: {
    deadline: string;
    passed: boolean;
    source: string;
    decision?: { choice: 'request' | 'decline'; decidedAt: string };
  };
}

/** Simple first (docs/design/simple.md; extension/src/journey.ts): the next step and the stages. */
export type StageId = 'about' | 'documents' | 'tax' | 'save' | 'file';

export interface JourneyVars {
  n?: number;
  /** Centimes. */
  amount?: number;
  /** YYYY-MM-DD. */
  date?: string;
  year?: number;
}

export interface Journey {
  next: { id: string; stage: StageId | null; vars: JourneyVars };
  /** The stage open by default. */
  stage: StageId;
  stages: { id: StageId; status: string; vars: JourneyVars }[];
  /** Facts that need no decision, shown as sentences in "About you". */
  about: { id: string; who?: 'p1' | 'p2' | 'both'; vars: JourneyVars }[];
  /** At least one income or wealth figure: only then is there a tax to show. */
  hasFigures: boolean;
  /** All the plans before 31 December together, or null. */
  savings: {
    totalCentimes: number;
    cantonalCentimes: number;
    federalCentimes: number;
    parts: ('pillar3a' | 'pillar3a_catchup' | 'lpp_buyin')[];
    onlyWithTou: boolean;
    assumptions: string[];
    sources: string[];
  } | null;
  /** A real TOU choice: the "Decide" card shows. */
  touChoice: boolean;
  /** The documents are in: the File stage opens. */
  documentsIn: boolean;
  /** 31 December of the tax year has passed. */
  yearEnded: boolean;
}

/** Values read from documents, checks and the assessment: ./types-docs.ts. */
export interface State extends DocumentsState {
  /** The next step and the stages (docs/design/simple.md). */
  journey: Journey;
  version: string;
  /** The open tax year: everything on the page is about it. */
  taxYear: number;
  /** The year switch: every tax year Taxpresso prepares (extension/src/years.ts). */
  years: {
    year: number;
    open: boolean;
    over: boolean;
    cantons: { code: string; name: string }[];
  }[];
  /** A year that is over: what replaces the plans before 31 December, or null. */
  yearOver: YearOverView | null;
  /** The canton of the return, once the user said where they lived on 31 December. */
  canton: {
    code: 'GE' | 'ZH' | 'BE' | 'BL' | 'VD' | 'BS' | 'ZG' | 'LU' | 'SG' | 'FR' | 'TI';
    name: string;
    from: 'answer' | 'earlier_answers' | 'none';
    because: string[];
  } | null;
  lang: Language;
  csrf: string;
  vault: { path: string; exists: boolean; problem?: string };
  people: { id: string; label: string }[];
  progress: { answered: number; total: number };
  question: Question | null;
  chips: string[];
  answers: { id: string; question: string; answer: string; who?: string; assumed?: boolean }[];
  documents: DocumentView[];
  kinds: { value: string; label: string }[];
  requirements: RequirementView[];
  /** The plans before 31 December; null for a year that is over (see yearOver). */
  plan: {
    inputs: {
      person: 'p1' | 'p2';
      gross: number | null;
      net: number | null;
      hasPensionFund: boolean;
      paid: number;
    }[];
    result: {
      people: {
        person: 'p1' | 'p2';
        capCentimes: number;
        capIsMaximum: boolean;
        paidCentimes: number;
        roomCentimes: number;
      }[];
      roomCentimes: number;
      saving?: { totalCentimes: number; cantonalCentimes: number; federalCentimes: number };
      assumptions: string[];
      sources: string[];
    };
  } | null;
  /** Pension fund buy-in, 3a catch-up and TOU: ./types-planning.ts. Null for a year that is over. */
  planning: PlanningState | null;
  notSupported: string[];
  /** The values to type into the official declaration, in the form's order (SPEC.md 10.5). */
  copyPanel: CopyPanelState;
  /** The securities list from broker exports, or null when there is none. */
  securities?: SecuritiesView | null;
  /** The tax from the rules engine ("Your estimate"). */
  estimate?: EstimateView;
  /** "Your securities and accounts": the état des titres as computed, or null when empty. */
  holdings?: HoldingsView | null;
  /** Last year's declaration: main figures to compare, or null when there is none. */
  lastYear?: LastYearView | null;
  /** Last year's return, reviewed (extension/src/last-year-review.ts). */
  review?: ReviewView;
  /** "Final check" before filling in the official form (extension/src/final-check.ts). */
  finalCheck?: FinalCheckState;
  notSupportedMessage: string;
  activity: Activity[];
}

/** The state of a year whose plans before 31 December apply: not over (see yearOver). */
export type PlannedState = State & {
  plan: NonNullable<State['plan']>;
  planning: PlanningState;
};

export const isPlanned = (state: State): state is PlannedState =>
  state.plan !== null && state.planning !== null;
